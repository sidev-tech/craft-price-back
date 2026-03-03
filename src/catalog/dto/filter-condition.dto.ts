import { IsArray, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { FilterOperator } from '../enums/filter-operator.enum';

export class FilterConditionDto {
  /** Ключ колонки (CatalogColumn.key) */
  @IsString()
  key: string;

  @IsEnum(FilterOperator)
  operator: FilterOperator;

  /** Значення для однозначних операторів (eq, neq, contains, gte, lte, gt, lt) */
  @IsOptional()
  value?: string | number;

  /** Список значень для операторів in / not_in */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];

  /**
   * Тип приведення JSONB-значення для порівняння.
   * - 'text'   — рядок (за замовчуванням для eq/neq/contains/in)
   * - 'number' — числове порівняння (за замовчуванням для gte/lte/gt/lt)
   * - 'date'   — порівняння дат
   */
  @IsOptional()
  @IsIn(['text', 'number', 'date'])
  castAs?: 'text' | 'number' | 'date';
}
