import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderColumnsDto {
  /** Full ordered list of column IDs in the new desired order */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  columnIds: string[];
}
