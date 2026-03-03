import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { JwtStrategy } from './jwt.strategy';

const mockUserRepo = { findOne: jest.fn() };

const makeUser = (): Partial<User> => ({
  id: 'user-uuid',
  email: 'test@test.com',
  role: UserRole.USER,
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return the user for a valid JWT payload', async () => {
    const user = makeUser();
    mockUserRepo.findOne.mockResolvedValue(user);

    const result = await strategy.validate({
      sub: 'user-uuid',
      email: 'test@test.com',
    });

    expect(result).toBe(user);
    expect(mockUserRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-uuid' },
    });
  });

  it('should throw UnauthorizedException when user is not found', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'nonexistent', email: 'x@x.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
