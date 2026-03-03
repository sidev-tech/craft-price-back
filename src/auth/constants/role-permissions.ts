import { Permission } from '../enums/permission.enum';
import { UserRole } from '../enums/user-role.enum';

/**
 * Базовий набір дозволів для кожної ролі.
 * Окремим користувачам можна додавати або розширювати через поле permissions на User.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [Permission.CATALOG_READ],

  [UserRole.SUPERVISOR]: [
    Permission.CATALOG_READ,
    Permission.CATALOG_CREATE,
    Permission.CATALOG_UPDATE,
    Permission.CATALOG_DELETE,
    Permission.USERS_READ,
    Permission.USERS_CREATE,
    Permission.USERS_DELETE,
  ],

  [UserRole.ADMIN]: Object.values(Permission),
};
