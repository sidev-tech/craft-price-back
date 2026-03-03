import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RefreshTokenPayload } from './strategies/jwt-refresh.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Реєстрація нового користувача. Надсилає лист підтвердження на email.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * GET /auth/verify-email?token=<token>
   * Підтвердження email після переходу за посиланням з листа.
   */
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  /**
   * POST /auth/login
   * Вхід. Повертає accessToken + refreshToken.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/refresh
   * Оновлення пари токенів. Потрібен refreshToken у заголовку Bearer.
   * Реалізує rotation: старий refresh анулюється, видається новий.
   */
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Request() req: { user: RefreshTokenPayload }) {
    const { sub, tokenId } = req.user;
    return this.authService.refresh(sub, tokenId);
  }

  /**
   * POST /auth/logout
   * Вихід. Анулює поточний refreshToken. Потрібен refreshToken у заголовку Bearer.
   */
  @UseGuards(JwtRefreshGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Request() req: { user: RefreshTokenPayload }) {
    const { sub, tokenId } = req.user;
    return this.authService.logout(sub, tokenId);
  }

  /**
   * POST /auth/forgot-password
   * Запит на відновлення пароля. Надсилає лист із посиланням.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /auth/reset-password
   * Скидання пароля за токеном з листа.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * GET /auth/profile
   * Профіль поточного користувача (без чутливих полів).
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user);
  }

  /**
   * PATCH /auth/avatar
   * Оновити URL аватара поточного користувача.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('avatar')
  @HttpCode(HttpStatus.OK)
  updateAvatar(@CurrentUser() user: User, @Body() dto: UpdateAvatarDto) {
    return this.authService.updateAvatar(user.id, dto);
  }
}
