import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { AddColumnDto } from './dto/add-column.dto';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { CreateRowDto } from './dto/create-row.dto';
import { FilterGroupDto } from './dto/filter-group.dto';
import { GetRowsQueryDto } from './dto/get-rows-query.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { SearchRowsDto } from './dto/search-rows.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { CatalogColumn } from './entities/catalog-column.entity';
import { CatalogRow } from './entities/catalog-row.entity';
import { Catalog } from './entities/catalog.entity';
import { ColumnType } from './enums/column-type.enum';
import { FilterOperator } from './enums/filter-operator.enum';

const DEFAULT_COLUMNS = [
  { key: 'order_number', label: '№ п/п', type: ColumnType.NUMBER, order: 0 },
  { key: 'name', label: 'Назва', type: ColumnType.TEXT, order: 1 },
  { key: 'price', label: 'Вартість', type: ColumnType.NUMBER, order: 2 },
  { key: 'unit', label: 'Одиниця виміру', type: ColumnType.TEXT, order: 3 },
] as const;

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Catalog)
    private readonly catalogRepo: Repository<Catalog>,
    @InjectRepository(CatalogColumn)
    private readonly columnRepo: Repository<CatalogColumn>,
    @InjectRepository(CatalogRow)
    private readonly rowRepo: Repository<CatalogRow>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Catalog CRUD ────────────────────────────────────────────────────────────

  async findAll(user: User): Promise<Catalog[]> {
    const where = user.role === UserRole.ADMIN ? {} : { ownerId: user.id };
    return this.catalogRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Catalog> {
    const catalog = await this.catalogRepo.findOne({
      where: { id },
      relations: ['columns'],
      order: { columns: { order: 'ASC' } },
    });
    if (!catalog) throw new NotFoundException('Каталог не знайдено');
    this.assertAccess(catalog, user);
    return catalog;
  }

  async create(dto: CreateCatalogDto, user: User): Promise<Catalog> {
    return this.dataSource.transaction(async (manager) => {
      const catalog = manager.create(Catalog, {
        name: dto.name,
        description: dto.description ?? null,
        ownerId: user.id,
      });
      const saved = await manager.save(catalog);

      const columns = DEFAULT_COLUMNS.map((col) =>
        manager.create(CatalogColumn, {
          ...col,
          isDefault: true,
          options: null,
          catalogId: saved.id,
        }),
      );
      await manager.save(columns);
      saved.columns = columns;
      return saved;
    });
  }

  async update(
    id: string,
    dto: UpdateCatalogDto,
    user: User,
  ): Promise<Catalog> {
    const catalog = await this.findOne(id, user);
    if (dto.name !== undefined) catalog.name = dto.name;
    if (dto.description !== undefined) catalog.description = dto.description;
    return this.catalogRepo.save(catalog);
  }

  async remove(id: string, user: User): Promise<{ message: string }> {
    const catalog = await this.findOne(id, user);
    await this.catalogRepo.delete(catalog.id);
    return { message: 'Каталог успішно видалено' };
  }

  // ─── Column management ───────────────────────────────────────────────────────

  async getColumns(catalogId: string, user: User): Promise<CatalogColumn[]> {
    await this.findOne(catalogId, user); // access check
    return this.columnRepo.find({
      where: { catalogId },
      order: { order: 'ASC' },
    });
  }

  async addColumn(
    catalogId: string,
    dto: AddColumnDto,
    user: User,
  ): Promise<CatalogColumn> {
    await this.findOne(catalogId, user); // access check

    if (dto.type === ColumnType.SELECT && !dto.options?.length) {
      throw new BadRequestException(
        'Для типу "select" необхідно вказати масив options',
      );
    }

    const maxOrder = await this.columnRepo
      .createQueryBuilder('col')
      .select('MAX(col.order)', 'max')
      .where('col.catalogId = :catalogId', { catalogId })
      .getRawOne<{ max: number | null }>();

    const nextOrder = (maxOrder?.max ?? -1) + 1;
    const key = this.generateKey(dto.label);

    const column = this.columnRepo.create({
      catalogId,
      key,
      label: dto.label,
      type: dto.type,
      order: nextOrder,
      isDefault: false,
      options: dto.options ?? null,
    });
    return this.columnRepo.save(column);
  }

  async updateColumn(
    catalogId: string,
    columnId: string,
    dto: UpdateColumnDto,
    user: User,
  ): Promise<CatalogColumn> {
    await this.findOne(catalogId, user); // access check
    const column = await this.findColumn(catalogId, columnId);

    if (dto.label !== undefined) column.label = dto.label;
    if (dto.type !== undefined) column.type = dto.type;
    if (dto.options !== undefined) column.options = dto.options;

    if (column.type === ColumnType.SELECT && !column.options?.length) {
      throw new BadRequestException(
        'Для типу "select" необхідно вказати масив options',
      );
    }

    return this.columnRepo.save(column);
  }

  async deleteColumn(
    catalogId: string,
    columnId: string,
    user: User,
  ): Promise<{ message: string }> {
    await this.findOne(catalogId, user); // access check
    const column = await this.findColumn(catalogId, columnId);

    if (column.isDefault) {
      throw new BadRequestException('Базові колонки не можна видаляти');
    }

    await this.columnRepo.delete(column.id);
    return { message: 'Колонку успішно видалено' };
  }

  async reorderColumns(
    catalogId: string,
    dto: ReorderColumnsDto,
    user: User,
  ): Promise<CatalogColumn[]> {
    await this.findOne(catalogId, user); // access check

    const columns = await this.columnRepo.find({ where: { catalogId } });
    const columnMap = new Map(columns.map((c) => [c.id, c]));

    if (dto.columnIds.length !== columns.length) {
      throw new BadRequestException(
        'columnIds має містити всі колонки каталогу',
      );
    }
    for (const id of dto.columnIds) {
      if (!columnMap.has(id)) {
        throw new BadRequestException(`Колонку з id=${id} не знайдено`);
      }
    }

    const updates = dto.columnIds.map((id, index) => {
      const col = columnMap.get(id)!;
      col.order = index;
      return col;
    });

    await this.columnRepo.save(updates);
    return updates.sort((a, b) => a.order - b.order);
  }

  // ─── Row CRUD ────────────────────────────────────────────────────────────────

  async getRows(
    catalogId: string,
    query: GetRowsQueryDto,
    user: User,
  ): Promise<{
    data: CatalogRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.findOne(catalogId, user); // access check

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [data, total] = await this.rowRepo.findAndCount({
      where: { catalogId },
      order: { rowNumber: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async searchRows(
    catalogId: string,
    dto: SearchRowsDto,
    user: User,
  ): Promise<{
    data: CatalogRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.findOne(catalogId, user); // access check

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;

    const qb = this.rowRepo
      .createQueryBuilder('row')
      .where('row.catalogId = :catalogId', { catalogId });

    if (dto.filter) {
      const { sql, params } = this.buildFilterSql(dto.filter);
      qb.andWhere(sql, params);
    }

    qb.orderBy('row.rowNumber', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getRow(
    catalogId: string,
    rowId: string,
    user: User,
  ): Promise<CatalogRow> {
    await this.findOne(catalogId, user); // access check
    const row = await this.rowRepo.findOne({
      where: { id: rowId, catalogId },
    });
    if (!row) throw new NotFoundException('Рядок не знайдено');
    return row;
  }

  async createRow(
    catalogId: string,
    dto: CreateRowDto,
    user: User,
  ): Promise<CatalogRow> {
    await this.findOne(catalogId, user); // access check

    const maxResult = await this.rowRepo
      .createQueryBuilder('row')
      .select('MAX(row.rowNumber)', 'max')
      .where('row.catalogId = :catalogId', { catalogId })
      .getRawOne<{ max: number | null }>();

    const nextRowNumber = (maxResult?.max ?? 0) + 1;

    const row = this.rowRepo.create({
      catalogId,
      data: dto.data,
      rowNumber: nextRowNumber,
    });
    return this.rowRepo.save(row);
  }

  async updateRow(
    catalogId: string,
    rowId: string,
    dto: UpdateRowDto,
    user: User,
  ): Promise<CatalogRow> {
    const row = await this.getRow(catalogId, rowId, user);
    row.data = { ...row.data, ...dto.data };
    return this.rowRepo.save(row);
  }

  async deleteRow(
    catalogId: string,
    rowId: string,
    user: User,
  ): Promise<{ message: string }> {
    await this.getRow(catalogId, rowId, user); // existence + access check
    await this.rowRepo.delete(rowId);
    return { message: 'Рядок успішно видалено' };
  }

  // ─── CSV export ──────────────────────────────────────────────────────────────

  async exportCsv(
    catalogId: string,
    user: User,
  ): Promise<{ filename: string; csv: Buffer }> {
    const catalog = await this.findOne(catalogId, user);

    const columns = await this.columnRepo.find({
      where: { catalogId },
      order: { order: 'ASC' },
    });

    const rows = await this.rowRepo.find({
      where: { catalogId },
      order: { rowNumber: 'ASC' },
    });

    const header = columns.map((c) => this.csvEscape(c.label)).join(',');

    const body = rows
      .map((row) =>
        columns
          .map((col) => {
            const val = row.data[col.key];
            return this.csvEscape(val == null ? '' : String(val));
          })
          .join(','),
      )
      .join('\r\n');

    // UTF-8 BOM so Excel opens Cyrillic text correctly
    const csv = '\uFEFF' + header + '\r\n' + body;

    const safeName = catalog.name.replace(/[/\\?%*:|"<>]/g, '_');
    return { filename: safeName, csv: Buffer.from(csv, 'utf-8') };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private assertAccess(catalog: Catalog, user: User): void {
    if (user.role !== UserRole.ADMIN && catalog.ownerId !== user.id) {
      throw new ForbiddenException('Доступ до цього каталогу заборонено');
    }
  }

  private async findColumn(
    catalogId: string,
    columnId: string,
  ): Promise<CatalogColumn> {
    const column = await this.columnRepo.findOne({
      where: { id: columnId, catalogId },
    });
    if (!column) throw new NotFoundException('Колонку не знайдено');
    return column;
  }

  /**
   * Builds a parameterized WHERE clause from a FilterGroupDto.
   * Returns raw SQL + named params safe for TypeORM QueryBuilder.
   */
  private buildFilterSql(group: FilterGroupDto): {
    sql: string;
    params: Record<string, unknown>;
  } {
    const parts: string[] = [];
    const params: Record<string, unknown> = {};
    let idx = 0;

    const RANGE_OPS = new Set<FilterOperator>([
      FilterOperator.GTE,
      FilterOperator.LTE,
      FilterOperator.GT,
      FilterOperator.LT,
    ]);

    for (const cond of group.conditions) {
      const safe = this.safeKey(cond.key);
      if (!safe) continue;

      const p = () => `f${idx++}`;
      const raw = `row.data->>'${safe}'`;

      const effectiveCastAs =
        cond.castAs ?? (RANGE_OPS.has(cond.operator) ? 'number' : 'text');
      const cast =
        effectiveCastAs === 'number'
          ? `(${raw})::numeric`
          : effectiveCastAs === 'date'
            ? `(${raw})::date`
            : raw;

      let sql = '';

      switch (cond.operator) {
        case FilterOperator.EQ: {
          const pn = p();
          sql = `${raw} = :${pn}`;
          params[pn] = String(cond.value ?? '');
          break;
        }
        case FilterOperator.NEQ: {
          const pn = p();
          sql = `(${raw} != :${pn} OR ${raw} IS NULL)`;
          params[pn] = String(cond.value ?? '');
          break;
        }
        case FilterOperator.CONTAINS: {
          const pn = p();
          sql = `${raw} ILIKE :${pn}`;
          params[pn] = `%${cond.value ?? ''}%`;
          break;
        }
        case FilterOperator.NOT_CONTAINS: {
          const pn = p();
          sql = `(${raw} NOT ILIKE :${pn} OR ${raw} IS NULL)`;
          params[pn] = `%${cond.value ?? ''}%`;
          break;
        }
        case FilterOperator.IN: {
          const pn = p();
          sql = `${raw} = ANY(:${pn})`;
          params[pn] = cond.values ?? [];
          break;
        }
        case FilterOperator.NOT_IN: {
          const pn = p();
          sql = `(${raw} != ALL(:${pn}) OR ${raw} IS NULL)`;
          params[pn] = cond.values ?? [];
          break;
        }
        case FilterOperator.GTE: {
          const pn = p();
          sql = `${cast} >= :${pn}`;
          params[pn] = cond.value;
          break;
        }
        case FilterOperator.LTE: {
          const pn = p();
          sql = `${cast} <= :${pn}`;
          params[pn] = cond.value;
          break;
        }
        case FilterOperator.GT: {
          const pn = p();
          sql = `${cast} > :${pn}`;
          params[pn] = cond.value;
          break;
        }
        case FilterOperator.LT: {
          const pn = p();
          sql = `${cast} < :${pn}`;
          params[pn] = cond.value;
          break;
        }
        case FilterOperator.IS_NULL: {
          sql = `(${raw} IS NULL OR NOT jsonb_exists(row.data, '${safe}'))`;
          break;
        }
        case FilterOperator.IS_NOT_NULL: {
          sql = `(${raw} IS NOT NULL AND jsonb_exists(row.data, '${safe}'))`;
          break;
        }
      }

      if (sql) parts.push(`(${sql})`);
    }

    if (!parts.length) return { sql: '1=1', params: {} };

    const joined = parts.join(` ${group.logic} `);
    return { sql: group.not ? `NOT (${joined})` : `(${joined})`, params };
  }

  /** Strips all chars that are not alphanumeric or underscore (prevents JSONB key injection) */
  private safeKey(key: string): string {
    return key.replace(/[^a-z0-9_]/gi, '');
  }

  /** RFC 4180 CSV cell escaping */
  private csvEscape(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /** Generates a safe snake_case key from a label, e.g. "Моя Колонка" → "moia_kolonka" */
  private generateKey(label: string): string {
    const base = label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яёіїєґ]/gi, '')
      .slice(0, 50);
    return `col_${base}_${Date.now()}`;
  }
}
