import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { RolesGuard } from './roles.guard';

const createContext = (user: Partial<User>): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any);

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should allow access when no roles are required (null)', () => {
    reflector.getAllAndOverride.mockReturnValue(null);

    expect(guard.canActivate(createContext({ role: UserRole.USER }))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('should allow access when required roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(createContext({ role: UserRole.USER }))).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(createContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('should allow access when user role matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.SUPERVISOR, UserRole.ADMIN]);

    expect(guard.canActivate(createContext({ role: UserRole.SUPERVISOR }))).toBe(true);
  });

  it('should deny access when user does not have the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(createContext({ role: UserRole.USER }))).toBe(false);
  });

  it('should deny access when user is undefined', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(createContext({}))).toBe(false);
  });

  it('should deny access for SUPERVISOR when only ADMIN is required', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(createContext({ role: UserRole.SUPERVISOR }))).toBe(false);
  });
});
