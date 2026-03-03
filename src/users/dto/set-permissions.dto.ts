import { IsArray, IsEnum } from 'class-validator';
import { Permission } from '../../auth/enums/permission.enum';

export class SetPermissionsDto {
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
