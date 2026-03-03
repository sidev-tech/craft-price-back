import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CatalogColumn } from '../catalog/entities/catalog-column.entity';
import { CatalogRow } from '../catalog/entities/catalog-row.entity';
import { PriceListItem } from './entities/price-list-item.entity';
import { PriceListTemplate } from './entities/price-list-template.entity';
import { PriceList } from './entities/price-list.entity';
import { PriceListTemplateController } from './price-list-template.controller';
import { PriceListTemplateService } from './price-list-template.service';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PriceList,
      PriceListItem,
      PriceListTemplate,
      CatalogRow,
      CatalogColumn,
    ]),
    AuthModule,
  ],
  controllers: [PriceListController, PriceListTemplateController],
  providers: [PriceListService, PriceListTemplateService],
})
export class PriceListModule {}
