import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { User } from './auth/entities/user.entity';
import { CatalogModule } from './catalog/catalog.module';
import { CatalogColumn } from './catalog/entities/catalog-column.entity';
import { CatalogRow } from './catalog/entities/catalog-row.entity';
import { Catalog } from './catalog/entities/catalog.entity';
import { PriceListItem } from './price-list/entities/price-list-item.entity';
import { PriceListTemplate } from './price-list/entities/price-list-template.entity';
import { PriceList } from './price-list/entities/price-list.entity';
import { PriceListModule } from './price-list/price-list.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [
          User,
          RefreshToken,
          Catalog,
          CatalogColumn,
          CatalogRow,
          PriceList,
          PriceListItem,
          PriceListTemplate,
        ],
        synchronize: true, // вимкнути у production, використовувати міграції
        ssl: false,
      }),
    }),
    AuthModule,
    UsersModule,
    CatalogModule,
    PriceListModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
