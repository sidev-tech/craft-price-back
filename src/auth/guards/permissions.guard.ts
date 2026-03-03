import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_PERMISSIONS } from '../constants/role-permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../enums/permission.enum';
import { User } from '../entities/user.entity';

/**
 * Перевіряє дозволи користувача.
 * Ефективні дозволи = базові дозволи ролі + індивідуальні permissions користувача.
 *
 * Використовується разом із @UseGuards(JwtAuthGuard, PermissionsGuard)
 * та @Permissions(Permission.CATALOG_CREATE).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user: User }>();
    const user = request.user;
    if (!user) return false;

    const rolePerms = ROLE_PERMISSIONS[user.role] ?? [];
    const userPerms = user.permissions ?? [];
    const effective = new Set([...rolePerms, ...userPerms]);

    return required.every((p) => effective.has(p));
  }
}
