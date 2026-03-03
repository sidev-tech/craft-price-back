import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL');
    const url = `${appUrl}/auth/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Підтвердження email — Price Craft',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Підтвердіть свій email</h2>
          <p>Дякуємо за реєстрацію! Натисніть кнопку нижче, щоб підтвердити адресу:</p>
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
            Підтвердити email
          </a>
          <p style="color:#6B7280;font-size:14px;margin-top:16px;">
            Посилання дійсне 24 години. Якщо ви не реєструвались — проігноруйте цей лист.
          </p>
        </div>
      `,
    });
  }

  async sendTempPassword(
    email: string,
    tempPassword: string,
    role: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL');

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Ваш акаунт створено — Price Craft',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Вітаємо в Price Craft!</h2>
          <p>Для вас створено обліковий запис з роллю <strong>${role}</strong>.</p>
          <div style="background:#F3F4F6;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;color:#374151;font-size:14px;">Ваші дані для входу:</p>
            <p style="margin:4px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin:4px 0;"><strong>Тимчасовий пароль:</strong>
              <code style="background:#E5E7EB;padding:2px 6px;border-radius:4px;font-size:15px;">
                ${tempPassword}
              </code>
            </p>
          </div>
          <a href="${appUrl}/auth/login"
             style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
            Увійти
          </a>
          <p style="color:#EF4444;font-size:13px;margin-top:16px;">
            З міркувань безпеки змініть пароль одразу після першого входу.
          </p>
        </div>
      `,
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL');
    const url = `${appUrl}/auth/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Відновлення пароля — Price Craft',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Відновлення пароля</h2>
          <p>Ми отримали запит на скидання пароля. Натисніть кнопку нижче:</p>
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
            Скинути пароль
          </a>
          <p style="color:#6B7280;font-size:14px;margin-top:16px;">
            Посилання дійсне 1 годину. Якщо ви не надсилали запит — проігноруйте цей лист.
          </p>
        </div>
      `,
    });
  }
}
