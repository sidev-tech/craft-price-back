import { IsObject } from 'class-validator';

export class CreateRowDto {
  /** Values keyed by column key. Missing keys default to null in the stored data. */
  @IsObject()
  data: Record<string, unknown>;
}
