import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email вже зайнятий');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    await this.userRepository.save(user);
    await this.mailService.sendEmailVerification(dto.email, verificationToken);

    return { message: 'Реєстрація успішна. Перевірте пошту для підтвердження.' };
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) throw new BadRequestException('Невалідний або прострочений токен');

    if (user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Токен підтвердження прострочений');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);

    return { message: 'Email успішно підтверджено' };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Невірний email або пароль');

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Невірний email або пароль');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Будь ласка, підтвердіть email перед входом',
      );
    }

    return this.generateTokens(user);
  }

  async refresh(userId: string, tokenId: string) {
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { id: tokenId, userId },
    });

    if (!storedToken) throw new UnauthorizedException('Невалідний refresh токен');

    if (storedToken.expiresAt < new Date()) {
      await this.refreshTokenRepository.delete({ id: tokenId });
      throw new UnauthorizedException('Refresh токен прострочений');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    await this.refreshTokenRepository.delete({ id: tokenId });
    return this.generateTokens(user);
  }

  async logout(userId: string, tokenId: string) {
    await this.refreshTokenRepository.delete({ id: tokenId, userId });
    return { message: 'Вихід успішний' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const genericResponse = {
      message: 'Якщо email зареєстровано, ви отримаєте листа з інструкціями',
    };

    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) return genericResponse;

    const rawToken = crypto.randomBytes(32).toString('hex');
    // Зберігаємо SHA-256 хеш — дає змогу знаходити токен по значенню без bcrypt
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await this.userRepository.save(user);

    await this.mailService.sendPasswordReset(dto.email, rawToken);
    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const user = await this.userRepository.findOne({
      where: { passwordResetToken: hashedToken },
    });

    if (!user) throw new BadRequestException('Невалідний токен скидання пароля');

    if (user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Токен скидання пароля прострочений');
    }

    user.password = await bcrypt.hash(dto.password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    // Анулюємо всі refresh-токени користувача після зміни пароля
    await this.refreshTokenRepository.delete({ userId: user.id });

    return { message: 'Пароль успішно змінено. Увійдіть з новим паролем.' };
  }

  getProfile(user: User) {
    const { password, emailVerificationToken, emailVerificationExpires, passwordResetToken, passwordResetExpires, refreshTokens, ...profile } = user;
    return profile;
  }

  async updateAvatar(userId: string, dto: UpdateAvatarDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    user.avatar = dto.avatar;
    await this.userRepository.save(user);

    return { avatar: user.avatar };
  }

  private async generateTokens(user: User) {
    const tokenId = crypto.randomUUID();

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') as any,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenId },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') as any,
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.save({
      id: tokenId,
      userId: user.id,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }
}
