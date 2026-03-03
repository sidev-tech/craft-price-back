import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ROLE_PERMISSIONS } from '../auth/constants/role-permissions';
import { User } from '../auth/entities/user.entity';
import { Permission } from '../auth/enums/permission.enum';
import { UserRole } from '../auth/enums/user-role.enum';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ModifyPermissionsDto } from './dto/modify-permissions.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';

const SAFE_USER_FIELDS: (keyof User)[] = [
  'id',
  'email',
  'role',
  'permissions',
  'avatar',
  'isEmailVerified',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async findAll(): Promise<Partial<User>[]> {
    return this.userRepository.find({
      select: SAFE_USER_FIELDS,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: SAFE_USER_FIELDS,
    });
    if (!user) throw new NotFoundException('Користувача не знайдено');
    return user;
  }

  async createUser(dto: CreateUserDto): Promise<Partial<User>> {
    return this.create(dto, UserRole.USER);
  }

  async createAdmin(dto: CreateUserDto): Promise<Partial<User>> {
    return this.create(dto, UserRole.ADMIN);
  }

  async delete(targetId: string, requestingUser: User): Promise<{ message: string }> {
    if (requestingUser.id === targetId) {
      throw new BadRequestException('Не можна видалити власний акаунт');
    }

    const target = await this.userRepository.findOne({ where: { id: targetId } });
    if (!target) throw new NotFoundException('Користувача не знайдено');

    if (
      requestingUser.role === UserRole.SUPERVISOR &&
      target.role === UserRole.ADMIN
    ) {
      throw new ForbiddenException('Супервайзер не може видалити адміністратора');
    }

    await this.userRepository.delete(targetId);
    return { message: 'Користувача успішно видалено' };
  }

  async getEffectivePermissions(targetId: string): Promise<{
    role: UserRole;
    rolePermissions: Permission[];
    userPermissions: Permission[];
    effective: Permission[];
  }> {
    const user = await this.userRepository.findOne({ where: { id: targetId } });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    const rolePermissions = ROLE_PERMISSIONS[user.role] ?? [];
    const userPermissions = user.permissions ?? [];
    const effective = Array.from(new Set([...rolePermissions, ...userPermissions]));

    return { role: user.role, rolePermissions, userPermissions, effective };
  }

  async setPermissions(targetId: string, dto: SetPermissionsDto): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: targetId } });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    user.permissions = dto.permissions;
    await this.userRepository.save(user);

    return this.pickSafeFields(user);
  }

  async grantPermissions(targetId: string, dto: ModifyPermissionsDto): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: targetId } });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    const existing = new Set(user.permissions ?? []);
    dto.permissions.forEach((p) => existing.add(p));
    user.permissions = Array.from(existing);
    await this.userRepository.save(user);

    return this.pickSafeFields(user);
  }

  async revokePermissions(targetId: string, dto: ModifyPermissionsDto): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: targetId } });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    const toRevoke = new Set(dto.permissions);
    user.permissions = (user.permissions ?? []).filter((p) => !toRevoke.has(p));
    await this.userRepository.save(user);

    return this.pickSafeFields(user);
  }

  private pickSafeFields(user: User): Partial<User> {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async create(dto: CreateUserDto, role: UserRole): Promise<Partial<User>> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email вже зайнятий');

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      role,
      isEmailVerified: true, // Акаунт створено адміністратором — верифікація не потрібна
    });

    const saved = await this.userRepository.save(user);
    await this.mailService.sendTempPassword(dto.email, tempPassword, role);

    const { password, emailVerificationToken, emailVerificationExpires, passwordResetToken, passwordResetExpires, refreshTokens, ...result } = saved;
    return result;
  }

  private generateTempPassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '@#$%!';
    const all = upper + lower + digits + special;

    const randomFrom = (chars: string) =>
      chars[Math.floor(Math.random() * chars.length)];

    // Гарантуємо хоча б один символ кожного типу
    const chars = [
      randomFrom(upper),
      randomFrom(lower),
      randomFrom(digits),
      randomFrom(special),
      ...Array.from({ length: 8 }, () => randomFrom(all)),
    ];

    // Перемішуємо
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }
}
