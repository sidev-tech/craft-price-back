import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/entities/user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ModifyPermissionsDto } from './dto/modify-permissions.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERVISOR, UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users
   * Список усіх користувачів.
   */
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * GET /users/:id
   * Отримати користувача за ID.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * POST /users
   * Створити нового користувача (роль USER).
   * Надсилає тимчасовий пароль на email.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  /**
   * POST /users/admin
   * Створити адміністратора (роль ADMIN).
   * Надсилає тимчасовий пароль на email.
   */
  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  createAdmin(@Body() dto: CreateUserDto) {
    return this.usersService.createAdmin(dto);
  }

  /**
   * DELETE /users/:id
   * Видалити користувача.
   * Супервайзер не може видалити адміністратора і самого себе.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.usersService.delete(id, user);
  }

  // ─── Управління дозволами (тільки ADMIN) ────────────────────────────────────

  /**
   * GET /users/:id/permissions
   * Ефективні дозволи = базові дозволи ролі + індивідуальні дозволи.
   */
  @Roles(UserRole.ADMIN)
  @Get(':id/permissions')
  getEffectivePermissions(@Param('id') id: string) {
    return this.usersService.getEffectivePermissions(id);
  }

  /**
   * PUT /users/:id/permissions
   * Повністю замінити індивідуальні дозволи користувача.
   * Базові дозволи ролі залишаються незмінними.
   */
  @Roles(UserRole.ADMIN)
  @Put(':id/permissions')
  @HttpCode(HttpStatus.OK)
  setPermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto) {
    return this.usersService.setPermissions(id, dto);
  }

  /**
   * PATCH /users/:id/permissions/grant
   * Додати конкретні дозволи користувачу (понад базові ролі).
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/permissions/grant')
  @HttpCode(HttpStatus.OK)
  grantPermissions(@Param('id') id: string, @Body() dto: ModifyPermissionsDto) {
    return this.usersService.grantPermissions(id, dto);
  }

  /**
   * PATCH /users/:id/permissions/revoke
   * Відкликати конкретні індивідуальні дозволи користувача.
   * Базові дозволи ролі відкликати не можна — для цього змініть роль.
   */
  @Roles(UserRole.ADMIN)
  @Patch(':id/permissions/revoke')
  @HttpCode(HttpStatus.OK)
  revokePermissions(@Param('id') id: string, @Body() dto: ModifyPermissionsDto) {
    return this.usersService.revokePermissions(id, dto);
  }
}
