import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/entities/user.entity';
import { Permission } from '../auth/enums/permission.enum';
import { UserRole } from '../auth/enums/user-role.enum';
import { MailService } from '../mail/mail.service';
import { UsersService } from './users.service';

jest.mock('bcrypt');

const mockUserRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockMailService = { sendTempPassword: jest.fn() };

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    email: 'user@test.com',
    password: 'hashed',
    role: UserRole.USER,
    permissions: [] as Permission[],
    avatar: null,
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
    ...overrides,
  } as User);

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all users ordered by createdAt DESC', async () => {
      const users = [makeUser(), makeUser({ id: 'user-2' })];
      mockUserRepo.find.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toBe(users);
      expect(mockUserRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return user by id', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('user-uuid');

      expect(result).toBe(user);
      expect(mockUserRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-uuid' } }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createUser ───────────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('should create user with USER role, send temp password, and strip sensitive fields', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const saved = makeUser({ email: 'new@test.com', role: UserRole.USER });
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);
      mockMailService.sendTempPassword.mockResolvedValue(undefined);

      const result = await service.createUser({ email: 'new@test.com' });

      expect(mockMailService.sendTempPassword).toHaveBeenCalledWith(
        'new@test.com',
        expect.any(String),
        UserRole.USER,
      );
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('emailVerificationToken');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('role');
    });

    it('should throw ConflictException when email is already taken', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        service.createUser({ email: 'user@test.com' }),
      ).rejects.toThrow(ConflictException);

      expect(mockMailService.sendTempPassword).not.toHaveBeenCalled();
    });

    it('should create user with isEmailVerified = true', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const saved = makeUser({ isEmailVerified: true });
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);
      mockMailService.sendTempPassword.mockResolvedValue(undefined);

      await service.createUser({ email: 'new@test.com' });

      const createCall = mockUserRepo.create.mock.calls[0][0];
      expect(createCall.isEmailVerified).toBe(true);
    });
  });

  // ─── createAdmin ──────────────────────────────────────────────────────────────

  describe('createAdmin', () => {
    it('should create user with ADMIN role', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const saved = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);
      mockMailService.sendTempPassword.mockResolvedValue(undefined);

      await service.createAdmin({ email: 'admin@test.com' });

      expect(mockMailService.sendTempPassword).toHaveBeenCalledWith(
        'admin@test.com',
        expect.any(String),
        UserRole.ADMIN,
      );
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a user and return success message', async () => {
      const requestingUser = makeUser({ id: 'supervisor-id', role: UserRole.SUPERVISOR });
      const target = makeUser({ id: 'target-id', role: UserRole.USER });
      mockUserRepo.findOne.mockResolvedValue(target);
      mockUserRepo.delete.mockResolvedValue({});

      const result = await service.delete('target-id', requestingUser);

      expect(result).toEqual({ message: 'Користувача успішно видалено' });
      expect(mockUserRepo.delete).toHaveBeenCalledWith('target-id');
    });

    it('should throw BadRequestException when trying to delete own account', async () => {
      const user = makeUser();

      await expect(service.delete(user.id, user)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when target user not found', async () => {
      const requestingUser = makeUser({ id: 'admin-id', role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('bad-id', requestingUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when SUPERVISOR tries to delete ADMIN', async () => {
      const supervisor = makeUser({ id: 'sup-id', role: UserRole.SUPERVISOR });
      const admin = makeUser({ id: 'admin-id', role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValue(admin);

      await expect(service.delete('admin-id', supervisor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });

    it('should allow ADMIN to delete SUPERVISOR', async () => {
      const admin = makeUser({ id: 'admin-id', role: UserRole.ADMIN });
      const supervisor = makeUser({ id: 'sup-id', role: UserRole.SUPERVISOR });
      mockUserRepo.findOne.mockResolvedValue(supervisor);
      mockUserRepo.delete.mockResolvedValue({});

      await expect(service.delete('sup-id', admin)).resolves.toBeDefined();
    });
  });

  // ─── getEffectivePermissions ──────────────────────────────────────────────────

  describe('getEffectivePermissions', () => {
    it('should return role permissions, individual permissions and effective union', async () => {
      const user = makeUser({
        role: UserRole.USER,
        permissions: [Permission.USERS_READ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.getEffectivePermissions('user-uuid');

      expect(result.role).toBe(UserRole.USER);
      expect(result.rolePermissions).toContain(Permission.CATALOG_READ);
      expect(result.userPermissions).toContain(Permission.USERS_READ);
      expect(result.effective).toContain(Permission.CATALOG_READ);
      expect(result.effective).toContain(Permission.USERS_READ);
    });

    it('should not duplicate permissions that exist in both role and individual', async () => {
      // SUPERVISOR already has CATALOG_READ via role; add it individually too
      const user = makeUser({
        role: UserRole.SUPERVISOR,
        permissions: [Permission.CATALOG_READ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.getEffectivePermissions('user-uuid');

      const count = result.effective.filter(
        (p) => p === Permission.CATALOG_READ,
      ).length;
      expect(count).toBe(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getEffectivePermissions('bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── setPermissions ───────────────────────────────────────────────────────────

  describe('setPermissions', () => {
    it('should replace user permissions entirely', async () => {
      const user = makeUser({
        permissions: [Permission.CATALOG_CREATE, Permission.USERS_READ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      await service.setPermissions(user.id, {
        permissions: [Permission.ROLES_MANAGE],
      });

      expect(user.permissions).toEqual([Permission.ROLES_MANAGE]);
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should allow setting empty permissions array', async () => {
      const user = makeUser({ permissions: [Permission.CATALOG_CREATE] });
      mockUserRepo.findOne.mockResolvedValue(user);

      await service.setPermissions(user.id, { permissions: [] });

      expect(user.permissions).toEqual([]);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.setPermissions('bad-id', { permissions: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── grantPermissions ─────────────────────────────────────────────────────────

  describe('grantPermissions', () => {
    it('should add new permissions to existing ones', async () => {
      const user = makeUser({ permissions: [Permission.CATALOG_READ] });
      mockUserRepo.findOne.mockResolvedValue(user);

      await service.grantPermissions(user.id, {
        permissions: [Permission.USERS_READ, Permission.CATALOG_CREATE],
      });

      expect(user.permissions).toContain(Permission.CATALOG_READ);
      expect(user.permissions).toContain(Permission.USERS_READ);
      expect(user.permissions).toContain(Permission.CATALOG_CREATE);
    });

    it('should not create duplicates when granting an already present permission', async () => {
      const user = makeUser({ permissions: [Permission.CATALOG_READ] });
      mockUserRepo.findOne.mockResolvedValue(user);

      await service.grantPermissions(user.id, {
        permissions: [Permission.CATALOG_READ],
      });

      const count = user.permissions.filter(
        (p) => p === Permission.CATALOG_READ,
      ).length;
      expect(count).toBe(1);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.grantPermissions('bad-id', {
          permissions: [Permission.CATALOG_READ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── revokePermissions ────────────────────────────────────────────────────────

  describe('revokePermissions', () => {
    it('should remove specified permissions', async () => {
      const user = makeUser({
        permissions: [Permission.CATALOG_READ, Permission.USERS_READ],
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      await service.revokePermissions(user.id, {
        permissions: [Permission.USERS_READ],
      });

      expect(user.permissions).not.toContain(Permission.USERS_READ);
      expect(user.permissions).toContain(Permission.CATALOG_READ);
    });

    it('should not fail when revoking a permission that user does not have', async () => {
      const user = makeUser({ permissions: [Permission.CATALOG_READ] });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(
        service.revokePermissions(user.id, {
          permissions: [Permission.ROLES_MANAGE],
        }),
      ).resolves.toBeDefined();

      expect(user.permissions).toContain(Permission.CATALOG_READ);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.revokePermissions('bad-id', {
          permissions: [Permission.CATALOG_READ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── generateTempPassword (tested indirectly) ─────────────────────────────────

  describe('generateTempPassword (indirectly via createUser)', () => {
    it('should generate a password of 12 characters', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockImplementation((pw) =>
        Promise.resolve(`hashed:${pw}`),
      );
      const saved = makeUser();
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);

      let capturedPassword = '';
      mockMailService.sendTempPassword.mockImplementation(
        (_email, pw) => { capturedPassword = pw; return Promise.resolve(); },
      );

      await service.createUser({ email: 'new@test.com' });

      expect(capturedPassword).toHaveLength(12);
    });

    it('should include uppercase, lowercase, digit and special char', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const saved = makeUser();
      mockUserRepo.create.mockReturnValue(saved);
      mockUserRepo.save.mockResolvedValue(saved);

      let capturedPassword = '';
      mockMailService.sendTempPassword.mockImplementation(
        (_email, pw) => { capturedPassword = pw; return Promise.resolve(); },
      );

      await service.createUser({ email: 'new@test.com' });

      expect(capturedPassword).toMatch(/[A-Z]/);
      expect(capturedPassword).toMatch(/[a-z]/);
      expect(capturedPassword).toMatch(/[0-9]/);
      expect(capturedPassword).toMatch(/[@#$%!]/);
    });
  });
});
