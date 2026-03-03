import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

(nodemailer.createTransport as jest.Mock).mockReturnValue({
  sendMail: mockSendMail,
});

const configMap: Record<string, string | number> = {
  MAIL_HOST: 'smtp.gmail.com',
  MAIL_PORT: 587,
  MAIL_USER: 'test@gmail.com',
  MAIL_PASSWORD: 'app-password',
  MAIL_FROM: 'Test <test@gmail.com>',
  APP_URL: 'http://localhost:3000',
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Restore mock after clearAllMocks
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configMap[key]),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  describe('sendEmailVerification', () => {
    it('should call sendMail with correct recipient and subject', async () => {
      await service.sendEmailVerification('user@test.com', 'verify-token-abc');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Підтвердження email — Price Craft',
        }),
      );
    });

    it('should embed the verification token in the email HTML', async () => {
      await service.sendEmailVerification('user@test.com', 'my-unique-token');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('my-unique-token');
    });

    it('should include the APP_URL in the verification link', async () => {
      await service.sendEmailVerification('user@test.com', 'token-xyz');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('http://localhost:3000');
    });
  });

  describe('sendTempPassword', () => {
    it('should call sendMail with correct recipient and subject', async () => {
      await service.sendTempPassword('admin@test.com', 'TempP@ss123', 'admin');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
          subject: 'Ваш акаунт створено — Price Craft',
        }),
      );
    });

    it('should include the temporary password in the email HTML', async () => {
      await service.sendTempPassword('user@test.com', 'Secret#456', 'user');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Secret#456');
    });

    it('should include the role in the email HTML', async () => {
      await service.sendTempPassword('sv@test.com', 'Pass!789', 'supervisor');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('supervisor');
    });
  });

  describe('sendPasswordReset', () => {
    it('should call sendMail with correct recipient and subject', async () => {
      await service.sendPasswordReset('user@test.com', 'reset-raw-token');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Відновлення пароля — Price Craft',
        }),
      );
    });

    it('should embed the reset token in the email HTML', async () => {
      await service.sendPasswordReset('user@test.com', 'my-reset-token');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('my-reset-token');
    });

    it('should include the APP_URL reset link', async () => {
      await service.sendPasswordReset('user@test.com', 'tok');

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('http://localhost:3000/auth/reset-password');
    });
  });
});
