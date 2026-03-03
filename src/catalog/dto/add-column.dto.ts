import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ColumnType } from '../enums/column-type.enum';

export class AddColumnDto {
  @IsString()
  @MaxLength(100)
  label: string;

  @IsEnum(ColumnType)
  type: ColumnType;

  /** Required when type = 'select' */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];
}
