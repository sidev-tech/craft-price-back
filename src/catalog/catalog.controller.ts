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
import { CatalogService } from './catalog.service';
import { AddColumnDto } from './dto/add-column.dto';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { CreateRowDto } from './dto/create-row.dto';
import { GetRowsQueryDto } from './dto/get-rows-query.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { SearchRowsDto } from './dto/search-rows.dto';
import { UpdateRowDto } from './dto/update-row.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
@Controller('catalogs')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ─── Catalogs ──────────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.catalogService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateCatalogDto, @CurrentUser() user: User) {
    return this.catalogService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.catalogService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.catalogService.remove(id, user);
  }

  // ─── Columns ───────────────────────────────────────────────────────────────

  @Get(':id/columns')
  getColumns(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.getColumns(id, user);
  }

  @Post(':id/columns')
  addColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddColumnDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.addColumn(id, dto, user);
  }

  @Put(':id/columns/reorder')
  reorderColumns(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderColumnsDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.reorderColumns(id, dto, user);
  }

  @Patch(':id/columns/:columnId')
  updateColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() dto: UpdateColumnDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.updateColumn(id, columnId, dto, user);
  }

  @Delete(':id/columns/:columnId')
  deleteColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.deleteColumn(id, columnId, user);
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  @Get(':id/export/csv')
  async exportCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, csv } = await this.catalogService.exportCsv(id, user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    });
    return new StreamableFile(csv);
  }

  // ─── Rows ──────────────────────────────────────────────────────────────────

  @Get(':id/rows')
  getRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetRowsQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.getRows(id, query, user);
  }

  @Post(':id/rows/search')
  searchRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SearchRowsDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.searchRows(id, dto, user);
  }

  @Post(':id/rows')
  createRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRowDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.createRow(id, dto, user);
  }

  @Get(':id/rows/:rowId')
  getRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.getRow(id, rowId, user);
  }

  @Patch(':id/rows/:rowId')
  updateRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() dto: UpdateRowDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.updateRow(id, rowId, dto, user);
  }

  @Delete(':id/rows/:rowId')
  deleteRow(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.deleteRow(id, rowId, user);
  }
}
