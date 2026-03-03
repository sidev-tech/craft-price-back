import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Додати позицію вручну (без каталогу) */
export class AddItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  displayData?: Record<string, unknown>;

  /** Ключі колонок із displayData, які показувати в PDF */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleColumnKeys?: string[];

  /** Мітки для visibleColumnKeys: { key → label } */
  @IsOptional()
  @IsObject()
  columnLabels?: Record<string, string>;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
