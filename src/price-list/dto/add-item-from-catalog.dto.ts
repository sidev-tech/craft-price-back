import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/** Імпортувати позицію з рядка каталогу */
export class AddItemFromCatalogDto {
  @IsUUID()
  catalogId: string;

  @IsUUID()
  catalogRowId: string;

  /**
   * Ключі колонок із каталогу, які відображати у прайсі.
   * Мітки підтягуються автоматично з визначень каталогу.
   */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  visibleColumnKeys: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  /**
   * Ціна за одиницю.
   * Якщо не вказано — береться зі значення колонки 'price' рядка каталогу.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
