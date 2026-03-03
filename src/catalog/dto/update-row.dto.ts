import { IsObject } from 'class-validator';

export class UpdateRowDto {
  /** Partial or full set of column values. Only provided keys are updated (merged). */
  @IsObject()
  data: Record<string, unknown>;
}
