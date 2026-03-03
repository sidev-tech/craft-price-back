import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RefreshTokenPayload } from './strategies/jwt-refresh.strategy';

const mockUser: Partial<User> = {
  id: 'user-uuid',
  email: 'user@test.com',
  role: UserRole.USER,
};

const mockRefreshPayload: RefreshTokenPayload = {
  sub: 'user-uuid',
  tokenId: 'token-id',
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, jest.Mock>;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      verifyEmail: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      getProfile: jest.fn(),
      updateAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtRefreshGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('register — delegates to authService.register', async () => {
    authService.register.mockResolvedValue({ message: 'ok' });

    const result = await controller.register({
      email: 'a@b.com',
      password: 'pass123',
    });

    expect(authService.register).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass123',
    });
    expect(result).toEqual({ message: 'ok' });
  });

  it('verifyEmail — delegates to authService.verifyEmail', async () => {
    authService.verifyEmail.mockResolvedValue({ message: 'verified' });

    await controller.verifyEmail('token123');

    expect(authService.verifyEmail).toHaveBeenCalledWith('token123');
  });

  it('login — delegates to authService.login', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const result = await controller.login({
      email: 'a@b.com',
      password: 'pass',
    });

    expect(authService.login).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass',
    });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('refresh — extracts sub and tokenId from request user', async () => {
    authService.refresh.mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
    });
    const req = { user: mockRefreshPayload };

    await controller.refresh(req as any);

    expect(authService.refresh).toHaveBeenCalledWith('user-uuid', 'token-id');
  });

  it('logout — extracts sub and tokenId from request user', async () => {
    authService.logout.mockResolvedValue({ message: 'ok' });
    const req = { user: mockRefreshPayload };

    await controller.logout(req as any);

    expect(authService.logout).toHaveBeenCalledWith('user-uuid', 'token-id');
  });

  it('forgotPassword — delegates to authService.forgotPassword', async () => {
    authService.forgotPassword.mockResolvedValue({ message: 'ok' });

    await controller.forgotPassword({ email: 'a@b.com' });

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'a@b.com' });
  });

  it('resetPassword — delegates to authService.resetPassword', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'ok' });

    await controller.resetPassword({ token: 'tok', password: 'newPass123' });

    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'tok',
      password: 'newPass123',
    });
  });

  it('getProfile — delegates to authService.getProfile with current user', () => {
    const profile = { id: 'user-uuid', email: 'a@b.com' };
    authService.getProfile.mockReturnValue(profile);

    const result = controller.getProfile(mockUser as User);

    expect(authService.getProfile).toHaveBeenCalledWith(mockUser);
    expect(result).toBe(profile);
  });

  it('updateAvatar — delegates to authService.updateAvatar with user id', async () => {
    authService.updateAvatar.mockResolvedValue({
      avatar: 'https://cdn.example.com/avatar.png',
    });

    await controller.updateAvatar(mockUser as User, {
      avatar: 'https://cdn.example.com/avatar.png',
    });

    expect(authService.updateAvatar).toHaveBeenCalledWith('user-uuid', {
      avatar: 'https://cdn.example.com/avatar.png',
    });
  });
});
