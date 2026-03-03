import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { FilterConditionDto } from './filter-condition.dto';

export class FilterGroupDto {
  /** Логіка об'єднання умов */
  @IsIn(['AND', 'OR'])
  logic: 'AND' | 'OR';

  /** Якщо true — вся група заперечується (NOT) */
  @IsOptional()
  @IsBoolean()
  not?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FilterConditionDto)
  conditions: FilterConditionDto[];
}
