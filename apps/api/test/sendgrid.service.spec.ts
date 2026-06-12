import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

import * as sgMail from '@sendgrid/mail';
const mockSendGrid = sgMail as jest.Mocked<typeof sgMail>;

const configValues: Record<string, string> = {
  SENDGRID_API_KEY: 'SG.test',
  FROM_EMAIL: 'outreach@example.com',
  FROM_NAME: 'Sharad',
  OUTREACH_DOMAIN: 'outreach.example.com',
};
const configMock = { get: (key: string) => configValues[key] };

describe('SendGridService', () => {
  let service: SendGridService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendGridService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(SendGridService);
  });

  describe('sendEmail', () => {
    it('calls sendgrid.send with correct fields and returns messageId', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSendGrid.send.mockResolvedValue([{ headers: { 'x-message-id': 'msg-abc' } }, {}] as any);

      const messageId = await service.sendEmail({
        to: 'alice@example.com',
        leadId: 'lead-1',
        subject: 'Hello',
        body: 'Hi there\nSecond line',
      });

      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          from: { email: 'outreach@example.com', name: 'Sharad' },
          subject: 'Hello',
          replyTo: 'reply+lead-1@outreach.example.com',
          html: 'Hi there<br>Second line',
          text: 'Hi there\nSecond line',
        }),
      );
      expect(messageId).toBe('msg-abc');
    });

    it('throws when sendgrid errors', async () => {
      mockSendGrid.send.mockRejectedValue(new Error('rate limit'));
      await expect(
        service.sendEmail({ to: 'x@y.com', leadId: 'l', subject: 's', body: 'b' }),
      ).rejects.toThrow('rate limit');
    });
  });
});
