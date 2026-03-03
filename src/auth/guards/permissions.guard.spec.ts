import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from '../entities/user.entity';
import { Permission } from '../enums/permission.enum';
import { UserRole } from '../enums/user-role.enum';
import { PermissionsGuard } from './permissions.guard';

const createContext = (user: Partial<User> | null): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any);

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const makeUser = (
    role: UserRole,
    permissions: Permission[] = [],
  ): Partial<User> => ({ role, permissions });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('should allow when no permissions required (null)', () => {
    reflector.getAllAndOverride.mockReturnValue(null);

    expect(guard.canActivate(createContext(makeUser(UserRole.USER)))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      PERMISSIONS_KEY,
      expect.any(Array),
    );
  });

  it('should allow when required permissions array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(createContext(makeUser(UserRole.USER)))).toBe(true);
  });

  it('should allow when user has the permission via their role', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.CATALOG_READ]);
    // UserRole.USER includes CATALOG_READ by default in ROLE_PERMISSIONS
    expect(guard.canActivate(createContext(makeUser(UserRole.USER)))).toBe(true);
  });

  it('should allow when user has an individually granted permission', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.USERS_READ]);
    const user = makeUser(UserRole.USER, [Permission.USERS_READ]);

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('should allow ADMIN to access any permission', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.PERMISSIONS_MANAGE]);

    expect(guard.canActivate(createContext(makeUser(UserRole.ADMIN)))).toBe(true);
  });

  it('should deny when user lacks the required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.ROLES_MANAGE]);

    expect(guard.canActivate(createContext(makeUser(UserRole.USER)))).toBe(false);
  });

  it('should deny when no user is present in request', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.CATALOG_READ]);

    expect(guard.canActivate(createContext(null))).toBe(false);
  });

  it('should deny when user lacks one of multiple required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.CATALOG_READ,
      Permission.CATALOG_CREATE,
      Permission.ROLES_MANAGE, // SUPERVISOR does not have this
    ]);

    expect(
      guard.canActivate(createContext(makeUser(UserRole.SUPERVISOR))),
    ).toBe(false);
  });

  it('should allow when user has all required permissions from role + individual', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.CATALOG_READ,
      Permission.USERS_READ,
    ]);
    // USER has CATALOG_READ via role, USERS_READ individually
    const user = makeUser(UserRole.USER, [Permission.USERS_READ]);

    expect(guard.canActivate(createContext(user))).toBe(true);
  });
});
