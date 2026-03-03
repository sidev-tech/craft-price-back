import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PriceListTemplate } from './entities/price-list-template.entity';

@Injectable()
export class PriceListTemplateService {
  constructor(
    @InjectRepository(PriceListTemplate)
    private readonly repo: Repository<PriceListTemplate>,
  ) {}

  async findAll(user: User): Promise<PriceListTemplate[]> {
    const where = user.role === UserRole.ADMIN ? {} : { ownerId: user.id };
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, user: User): Promise<PriceListTemplate> {
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Шаблон не знайдено');
    this.assertAccess(tpl, user);
    return tpl;
  }

  async create(dto: CreateTemplateDto, user: User): Promise<PriceListTemplate> {
    const tpl = this.repo.create({
      name: dto.name,
      headerText: dto.headerText ?? null,
      footerText: dto.footerText ?? null,
      logoUrl: dto.logoUrl ?? null,
      ownerId: user.id,
    });
    return this.repo.save(tpl);
  }

  async update(
    id: string,
    dto: UpdateTemplateDto,
    user: User,
  ): Promise<PriceListTemplate> {
    const tpl = await this.findOne(id, user);
    if (dto.name !== undefined) tpl.name = dto.name;
    if (dto.headerText !== undefined) tpl.headerText = dto.headerText;
    if (dto.footerText !== undefined) tpl.footerText = dto.footerText;
    if (dto.logoUrl !== undefined) tpl.logoUrl = dto.logoUrl;
    return this.repo.save(tpl);
  }

  async remove(id: string, user: User): Promise<{ message: string }> {
    const tpl = await this.findOne(id, user);
    await this.repo.delete(tpl.id);
    return { message: 'Шаблон успішно видалено' };
  }

  private assertAccess(tpl: PriceListTemplate, user: User): void {
    if (user.role !== UserRole.ADMIN && tpl.ownerId !== user.id) {
      throw new ForbiddenException('Доступ до цього шаблону заборонено');
    }
  }
}
