import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { Permission } from './enums/permission.enum';
import { UserRole } from './enums/user-role.enum';

jest.mock('bcrypt');

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockRefreshTokenRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockJwtService = { sign: jest.fn() };

const mockConfigService = { get: jest.fn() };

const mockMailService = {
  sendEmailVerification: jest.fn(),
  sendPasswordReset: jest.fn(),
};

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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return map[key] ?? 'mock-val';
    });

    mockJwtService.sign.mockReturnValue('signed.jwt.token');
    mockRefreshTokenRepo.save.mockResolvedValue({});
    mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should create user and send verification email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      mockUserRepo.create.mockReturnValue({ email: 'user@test.com' });
      mockMailService.sendEmailVerification.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'user@test.com',
        password: 'password123',
      });

      expect(result).toEqual({
        message: 'Реєстрація успішна. Перевірте пошту для підтвердження.',
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockMailService.sendEmailVerification).toHaveBeenCalledWith(
        'user@test.com',
        expect.any(String),
      );
    });

    it('should throw ConflictException when email is already taken', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        service.register({ email: 'user@test.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── verifyEmail ─────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify email with a valid non-expired token', async () => {
      const user = makeUser({
        isEmailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationExpires: new Date(Date.now() + 60_000),
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.verifyEmail('valid-token');

      expect(result).toEqual({ message: 'Email успішно підтверджено' });
      expect(user.isEmailVerified).toBe(true);
      expect(user.emailVerificationToken).toBeNull();
      expect(user.emailVerificationExpires).toBeNull();
    });

    it('should throw BadRequestException when token not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token is expired', async () => {
      const user = makeUser({
        emailVerificationToken: 'expired',
        emailVerificationExpires: new Date(Date.now() - 1000),
      });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.verifyEmail('expired')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'user@test.com',
        password: 'correct',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@x.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when email not verified', async () => {
      mockUserRepo.findOne.mockResolvedValue(
        makeUser({ isEmailVerified: false }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'user@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should return new token pair for a valid refresh token', async () => {
      const stored = {
        id: 'token-id',
        userId: 'user-uuid',
        expiresAt: new Date(Date.now() + 60_000),
      };
      mockRefreshTokenRepo.findOne.mockResolvedValue(stored);
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      const result = await service.refresh('user-uuid', 'token-id');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        id: 'token-id',
      });
    });

    it('should throw UnauthorizedException when token not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('user-uuid', 'bad')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should delete expired token and throw UnauthorizedException', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({
        id: 'token-id',
        userId: 'user-uuid',
        expiresAt: new Date(Date.now() - 1000),
      });
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      await expect(service.refresh('user-uuid', 'token-id')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        id: 'token-id',
      });
    });

    it('should throw UnauthorizedException when user deleted after token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({
        id: 'token-id',
        userId: 'user-uuid',
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockRefreshTokenRepo.delete.mockResolvedValue({});
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('user-uuid', 'token-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should delete refresh token and return success message', async () => {
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      const result = await service.logout('user-uuid', 'token-id');

      expect(result).toEqual({ message: 'Вихід успішний' });
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        id: 'token-id',
        userId: 'user-uuid',
      });
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should save hashed reset token and send email when user exists', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockMailService.sendPasswordReset.mockResolvedValue(undefined);

      const result = await service.forgotPassword({ email: 'user@test.com' });

      expect(result.message).toBe(
        'Якщо email зареєстровано, ви отримаєте листа з інструкціями',
      );
      expect(user.passwordResetToken).toBeTruthy();
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
      expect(mockMailService.sendPasswordReset).toHaveBeenCalledWith(
        'user@test.com',
        expect.any(String),
      );
    });

    it('should return generic response without sending email when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nobody@test.com' });

      expect(result.message).toBe(
        'Якщо email зареєстровано, ви отримаєте листа з інструкціями',
      );
      expect(mockMailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should update password and revoke all refresh tokens', async () => {
      const rawToken = 'raw-reset-token';
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const user = makeUser({
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 60_000),
      });
      mockUserRepo.findOne.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pw');
      mockRefreshTokenRepo.delete.mockResolvedValue({});

      const result = await service.resetPassword({
        token: rawToken,
        password: 'NewPass123!',
      });

      expect(result).toEqual({
        message: 'Пароль успішно змінено. Увійдіть з новим паролем.',
      });
      expect(user.password).toBe('new-hashed-pw');
      expect(user.passwordResetToken).toBeNull();
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        userId: user.id,
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad', password: 'NewPass123!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired reset token', async () => {
      const rawToken = 'raw-token';
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      mockUserRepo.findOne.mockResolvedValue(
        makeUser({
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(Date.now() - 1000),
        }),
      );

      await expect(
        service.resetPassword({ token: rawToken, password: 'NewPass123!' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getProfile ───────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should strip sensitive fields from user', () => {
      const user = makeUser({
        password: 'secret',
        emailVerificationToken: 'tok',
        emailVerificationExpires: new Date(),
        passwordResetToken: 'reset-tok',
        passwordResetExpires: new Date(),
      });

      const profile = service.getProfile(user);

      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('emailVerificationToken');
      expect(profile).not.toHaveProperty('emailVerificationExpires');
      expect(profile).not.toHaveProperty('passwordResetToken');
      expect(profile).not.toHaveProperty('passwordResetExpires');
      expect(profile).not.toHaveProperty('refreshTokens');
      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('email');
      expect(profile).toHaveProperty('role');
    });
  });

  // ─── updateAvatar ─────────────────────────────────────────────────────────────

  describe('updateAvatar', () => {
    it('should update avatar and return new URL', async () => {
      const user = makeUser({ avatar: null });
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.updateAvatar('user-uuid', {
        avatar: 'https://cdn.example.com/avatar.png',
      });

      expect(result).toEqual({ avatar: 'https://cdn.example.com/avatar.png' });
      expect(user.avatar).toBe('https://cdn.example.com/avatar.png');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateAvatar('bad-id', {
          avatar: 'https://cdn.example.com/avatar.png',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
