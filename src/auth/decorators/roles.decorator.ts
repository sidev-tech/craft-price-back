import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/** Вказує, яка роль потрібна для доступу до ендпоінту */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
