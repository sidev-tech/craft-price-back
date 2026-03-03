import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddItemFromCatalogDto } from './dto/add-item-from-catalog.dto';
import { AddItemDto } from './dto/add-item.dto';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdatePriceListDto } from './dto/update-price-list.dto';
import { PriceListService } from './price-list.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
@Controller('price-lists')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  // ─── Price lists ───────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.priceListService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreatePriceListDto, @CurrentUser() user: User) {
    return this.priceListService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.priceListService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListDto,
    @CurrentUser() user: User,
  ) {
    return this.priceListService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.priceListService.remove(id, user);
  }

  // ─── PDF Export ────────────────────────────────────────────────────────────

  /**
   * @param mode 'public' — без прихованих рядків (за замовчуванням)
   *             'full'   — з усіма рядками (для внутрішнього використання)
   */
  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('mode') mode: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfMode: 'full' | 'public' = mode === 'full' ? 'full' : 'public';

    const { filename, buffer } = await this.priceListService.exportPdf(
      id,
      user,
      pdfMode,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  // ─── Items ─────────────────────────────────────────────────────────────────

  @Post(':id/items')
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemDto,
    @CurrentUser() user: User,
  ) {
    return this.priceListService.addItem(id, dto, user);
  }

  @Post(':id/items/from-catalog')
  addItemFromCatalog(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemFromCatalogDto,
    @CurrentUser() user: User,
  ) {
    return this.priceListService.addItemFromCatalog(id, dto, user);
  }

  @Put(':id/items/reorder')
  reorderItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderItemsDto,
    @CurrentUser() user: User,
  ) {
    return this.priceListService.reorderItems(id, dto, user);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: User,
  ) {
    return this.priceListService.updateItem(id, itemId, dto, user);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: User,
  ) {
    return this.priceListService.removeItem(id, itemId, user);
  }
}
