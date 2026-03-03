export enum Permission {
  // Каталог
  CATALOG_READ = 'catalog:read',
  CATALOG_CREATE = 'catalog:create',
  CATALOG_UPDATE = 'catalog:update',
  CATALOG_DELETE = 'catalog:delete',

  // Користувачі
  USERS_READ = 'users:read',
  USERS_CREATE = 'users:create',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',

  // Адміністрування
  ROLES_MANAGE = 'roles:manage',
  PERMISSIONS_MANAGE = 'permissions:manage',
}
