import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../auth/entities/user.entity';
import { Permission } from '../auth/enums/permission.enum';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockAdmin: Partial<User> = {
  id: 'admin-uuid',
  email: 'admin@test.com',
  role: UserRole.ADMIN,
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usersService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      createUser: jest.fn(),
      createAdmin: jest.fn(),
      delete: jest.fn(),
      getEffectivePermissions: jest.fn(),
      setPermissions: jest.fn(),
      grantPermissions: jest.fn(),
      revokePermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('findAll — delegates to usersService.findAll', async () => {
    usersService.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(usersService.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('findOne — delegates to usersService.findOne with id', async () => {
    const user = { id: 'user-uuid' };
    usersService.findOne.mockResolvedValue(user);

    const result = await controller.findOne('user-uuid');

    expect(usersService.findOne).toHaveBeenCalledWith('user-uuid');
    expect(result).toBe(user);
  });

  it('createUser — delegates to usersService.createUser', async () => {
    usersService.createUser.mockResolvedValue({ id: 'new-id', role: UserRole.USER });

    await controller.createUser({ email: 'new@test.com' });

    expect(usersService.createUser).toHaveBeenCalledWith({ email: 'new@test.com' });
  });

  it('createAdmin — delegates to usersService.createAdmin', async () => {
    usersService.createAdmin.mockResolvedValue({ id: 'admin-id', role: UserRole.ADMIN });

    await controller.createAdmin({ email: 'admin@test.com' });

    expect(usersService.createAdmin).toHaveBeenCalledWith({ email: 'admin@test.com' });
  });

  it('delete — passes id and current user to usersService.delete', async () => {
    usersService.delete.mockResolvedValue({ message: 'ok' });

    await controller.delete('target-id', mockAdmin as User);

    expect(usersService.delete).toHaveBeenCalledWith('target-id', mockAdmin);
  });

  it('getEffectivePermissions — delegates to usersService', async () => {
    const perms = {
      role: UserRole.USER,
      rolePermissions: [],
      userPermissions: [],
      effective: [],
    };
    usersService.getEffectivePermissions.mockResolvedValue(perms);

    const result = await controller.getEffectivePermissions('user-uuid');

    expect(usersService.getEffectivePermissions).toHaveBeenCalledWith('user-uuid');
    expect(result).toBe(perms);
  });

  it('setPermissions — delegates to usersService with id and dto', async () => {
    usersService.setPermissions.mockResolvedValue({ id: 'user-uuid' });

    await controller.setPermissions('user-uuid', {
      permissions: [Permission.CATALOG_READ],
    });

    expect(usersService.setPermissions).toHaveBeenCalledWith('user-uuid', {
      permissions: [Permission.CATALOG_READ],
    });
  });

  it('grantPermissions — delegates to usersService with id and dto', async () => {
    usersService.grantPermissions.mockResolvedValue({ id: 'user-uuid' });

    await controller.grantPermissions('user-uuid', {
      permissions: [Permission.CATALOG_CREATE],
    });

    expect(usersService.grantPermissions).toHaveBeenCalledWith('user-uuid', {
      permissions: [Permission.CATALOG_CREATE],
    });
  });

  it('revokePermissions — delegates to usersService with id and dto', async () => {
    usersService.revokePermissions.mockResolvedValue({ id: 'user-uuid' });

    await controller.revokePermissions('user-uuid', {
      permissions: [Permission.CATALOG_CREATE],
    });

    expect(usersService.revokePermissions).toHaveBeenCalledWith('user-uuid', {
      permissions: [Permission.CATALOG_CREATE],
    });
  });
});
