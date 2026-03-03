import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderItemsDto {
  /** Повний впорядкований список id позицій у бажаному порядку */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds: string[];
}
