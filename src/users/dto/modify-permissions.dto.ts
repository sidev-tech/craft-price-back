import { ArrayMinSize, IsArray, IsEnum } from 'class-validator';
import { Permission } from '../../auth/enums/permission.enum';

export class ModifyPermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
