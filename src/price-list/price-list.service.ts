import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { CatalogColumn } from '../catalog/entities/catalog-column.entity';
import { CatalogRow } from '../catalog/entities/catalog-row.entity';
import { AddItemFromCatalogDto } from './dto/add-item-from-catalog.dto';
import { AddItemDto } from './dto/add-item.dto';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdatePriceListDto } from './dto/update-price-list.dto';
import { PriceListItem } from './entities/price-list-item.entity';
import { PriceListTemplate } from './entities/price-list-template.entity';
import { PriceList } from './entities/price-list.entity';
import { buildPriceListPdf } from './pdf/pdf.builder';

@Injectable()
export class PriceListService {
  private readonly siteUrl: string;

  constructor(
    @InjectRepository(PriceList)
    private readonly priceListRepo: Repository<PriceList>,
    @InjectRepository(PriceListItem)
    private readonly itemRepo: Repository<PriceListItem>,
    @InjectRepository(PriceListTemplate)
    private readonly templateRepo: Repository<PriceListTemplate>,
    @InjectRepository(CatalogRow)
    private readonly catalogRowRepo: Repository<CatalogRow>,
    @InjectRepository(CatalogColumn)
    private readonly catalogColumnRepo: Repository<CatalogColumn>,
    private readonly config: ConfigService,
  ) {
    this.siteUrl =
      this.config.get<string>('SITE_URL') ?? 'https://price-craft.com';
  }

  // ─── Price list CRUD ─────────────────────────────────────────────────────────

  async findAll(user: User): Promise<PriceList[]> {
    const where = user.role === UserRole.ADMIN ? {} : { ownerId: user.id };
    return this.priceListRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<PriceList> {
    const pl = await this.priceListRepo.findOne({
      where: { id },
      relations: ['items'],
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!pl) throw new NotFoundException('Прайс не знайдено');
    this.assertAccess(pl, user);
    return pl;
  }

  async create(dto: CreatePriceListDto, user: User): Promise<PriceList> {
    let tplHeaderText: string | null = null;
    let tplFooterText: string | null = null;
    let tplLogoUrl: string | null = null;

    if (dto.templateId) {
      const tpl = await this.templateRepo.findOne({
        where: { id: dto.templateId },
      });
      if (!tpl) throw new NotFoundException('Шаблон не знайдено');
      if (user.role !== UserRole.ADMIN && tpl.ownerId !== user.id) {
        throw new ForbiddenException('Доступ до цього шаблону заборонено');
      }
      tplHeaderText = tpl.headerText;
      tplFooterText = tpl.footerText;
      tplLogoUrl = tpl.logoUrl;
    }

    const pl = this.priceListRepo.create({
      name: dto.name,
      headerText: dto.headerText ?? tplHeaderText,
      footerText: dto.footerText ?? tplFooterText,
      logoUrl: dto.logoUrl ?? tplLogoUrl,
      photos: dto.photos ?? [],
      vatRate: dto.vatRate ?? 20,
      notes: dto.notes ?? null,
      ownerId: user.id,
    });
    return this.priceListRepo.save(pl);
  }

  async update(
    id: string,
    dto: UpdatePriceListDto,
    user: User,
  ): Promise<PriceList> {
    const pl = await this.findOne(id, user);

    if (dto.name !== undefined) pl.name = dto.name;
    if (dto.headerText !== undefined) pl.headerText = dto.headerText;
    if (dto.footerText !== undefined) pl.footerText = dto.footerText;
    if (dto.logoUrl !== undefined) pl.logoUrl = dto.logoUrl;
    if (dto.photos !== undefined) {
      if (dto.photos.length > 5)
        throw new BadRequestException('Максимум 5 фотографій');
      pl.photos = dto.photos;
    }
    if (dto.vatRate !== undefined) pl.vatRate = dto.vatRate;
    if (dto.notes !== undefined) pl.notes = dto.notes;

    return this.priceListRepo.save(pl);
  }

  async remove(id: string, user: User): Promise<{ message: string }> {
    const pl = await this.findOne(id, user);
    await this.priceListRepo.delete(pl.id);
    return { message: 'Прайс успішно видалено' };
  }

  // ─── Item management ─────────────────────────────────────────────────────────

  async addItem(
    priceListId: string,
    dto: AddItemDto,
    user: User,
  ): Promise<PriceListItem> {
    await this.findOne(priceListId, user); // access check

    const sortOrder = await this.nextSortOrder(priceListId);
    const item = this.itemRepo.create({
      priceListId,
      name: dto.name,
      displayData: dto.displayData ?? {},
      visibleColumnKeys: dto.visibleColumnKeys ?? [],
      columnLabels: dto.columnLabels ?? {},
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      isHidden: dto.isHidden ?? false,
      note: dto.note ?? null,
      sortOrder: dto.sortOrder ?? sortOrder,
      catalogRowId: null,
      catalogId: null,
    });
    return this.itemRepo.save(item);
  }

  async addItemFromCatalog(
    priceListId: string,
    dto: AddItemFromCatalogDto,
    user: User,
  ): Promise<PriceListItem> {
    await this.findOne(priceListId, user); // access check

    // Fetch and verify catalog row
    const catalogRow = await this.catalogRowRepo.findOne({
      where: { id: dto.catalogRowId, catalogId: dto.catalogId },
    });
    if (!catalogRow) throw new NotFoundException('Рядок каталогу не знайдено');

    // Fetch column definitions for labels
    const columns = await this.catalogColumnRepo.find({
      where: { catalogId: dto.catalogId },
    });
    const columnMap = new Map(columns.map((c) => [c.key, c]));

    // Build columnLabels from selected keys
    const columnLabels: Record<string, string> = {};
    for (const key of dto.visibleColumnKeys) {
      const col = columnMap.get(key);
      if (col) columnLabels[key] = col.label;
    }

    // Determine item name from 'name' column or fallback
    const name =
      String(catalogRow.data['name'] ?? catalogRow.data['order_number'] ?? '—');

    // Determine unit price from 'price' column or dto
    const catalogPrice = parseFloat(String(catalogRow.data['price'] ?? 0));
    const unitPrice = dto.unitPrice ?? catalogPrice;

    const sortOrder = await this.nextSortOrder(priceListId);

    const item = this.itemRepo.create({
      priceListId,
      name,
      displayData: catalogRow.data,
      visibleColumnKeys: dto.visibleColumnKeys,
      columnLabels,
      quantity: dto.quantity ?? 1,
      unitPrice,
      isHidden: dto.isHidden ?? false,
      note: dto.note ?? null,
      sortOrder,
      catalogRowId: dto.catalogRowId,
      catalogId: dto.catalogId,
    });
    return this.itemRepo.save(item);
  }

  async updateItem(
    priceListId: string,
    itemId: string,
    dto: UpdateItemDto,
    user: User,
  ): Promise<PriceListItem> {
    await this.findOne(priceListId, user); // access check
    const item = await this.findItem(priceListId, itemId);

    if (dto.name !== undefined) item.name = dto.name;
    if (dto.visibleColumnKeys !== undefined)
      item.visibleColumnKeys = dto.visibleColumnKeys;
    if (dto.columnLabels !== undefined) item.columnLabels = dto.columnLabels;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) item.unitPrice = dto.unitPrice;
    if (dto.isHidden !== undefined) item.isHidden = dto.isHidden;
    if (dto.note !== undefined) item.note = dto.note;

    return this.itemRepo.save(item);
  }

  async removeItem(
    priceListId: string,
    itemId: string,
    user: User,
  ): Promise<{ message: string }> {
    await this.findOne(priceListId, user); // access check
    await this.findItem(priceListId, itemId);
    await this.itemRepo.delete(itemId);
    return { message: 'Позицію успішно видалено' };
  }

  async reorderItems(
    priceListId: string,
    dto: ReorderItemsDto,
    user: User,
  ): Promise<PriceListItem[]> {
    await this.findOne(priceListId, user); // access check

    const items = await this.itemRepo.find({ where: { priceListId } });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    if (dto.itemIds.length !== items.length) {
      throw new BadRequestException('itemIds має містити всі позиції прайсу');
    }
    for (const id of dto.itemIds) {
      if (!itemMap.has(id))
        throw new BadRequestException(`Позицію з id=${id} не знайдено`);
    }

    const updates = dto.itemIds.map((id, index) => {
      const item = itemMap.get(id)!;
      item.sortOrder = index;
      return item;
    });

    await this.itemRepo.save(updates);
    return updates.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ─── PDF export ──────────────────────────────────────────────────────────────

  async exportPdf(
    id: string,
    user: User,
    mode: 'full' | 'public',
  ): Promise<{ filename: string; buffer: Buffer }> {
    const pl = await this.findOne(id, user);
    const buffer = await buildPriceListPdf(pl, mode, this.siteUrl);
    const safeName = pl.name.replace(/[/\\?%*:|"<>]/g, '_');
    const suffix = mode === 'public' ? '' : '_full';
    return { filename: `${safeName}${suffix}`, buffer };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private assertAccess(pl: PriceList, user: User): void {
    if (user.role !== UserRole.ADMIN && pl.ownerId !== user.id) {
      throw new ForbiddenException('Доступ до цього прайсу заборонено');
    }
  }

  private async findItem(
    priceListId: string,
    itemId: string,
  ): Promise<PriceListItem> {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, priceListId },
    });
    if (!item) throw new NotFoundException('Позицію не знайдено');
    return item;
  }

  private async nextSortOrder(priceListId: string): Promise<number> {
    const result = await this.itemRepo
      .createQueryBuilder('item')
      .select('MAX(item.sortOrder)', 'max')
      .where('item.priceListId = :priceListId', { priceListId })
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? -1) + 1;
  }
}
