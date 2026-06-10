import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OutreachService } from '../src/modules/outreach/outreach.service';
import OpenAI from 'openai';

jest.mock('openai');

const configMock = { get: (key: string) => (key === 'OPENAI_API_KEY' ? 'test-key' : undefined) };

describe('OutreachService', () => {
  let service: OutreachService;
  let mockCreate: jest.Mock;

  beforeEach(async () => {
    mockCreate = jest.fn();

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () =>
        ({
          chat: { completions: { create: mockCreate } },
        }) as unknown as OpenAI,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(OutreachService);
    jest.clearAllMocks();
  });

  describe('generateColdEmail', () => {
    it('returns subject and body from GPT-4o-mini', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ subject: 'Hi there', body: 'Hello Alice' }) } }],
      });

      const result = await service.generateColdEmail({
        firstName: 'Alice',
        lastName: 'Chen',
        title: 'CTO',
        companyName: 'TechStartup',
        industry: 'SaaS',
        techStack: ['React', 'Node.js'],
        location: 'Austin TX',
      });

      expect(result.subject).toBe('Hi there');
      expect(result.body).toBe('Hello Alice');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini', temperature: 0.7 }),
      );
    });

    it('throws when AI returns invalid JSON', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'not json' } }],
      });

      await expect(
        service.generateColdEmail({ firstName: 'A', lastName: 'B', title: 'CTO', companyName: 'X', industry: null, techStack: [], location: null }),
      ).rejects.toThrow('Invalid email generation response');
    });
  });

  describe('generateFollowupEmail', () => {
    it('returns subject and body for step 2', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ subject: 'Re: following up', body: 'Hey Alice' }) } }],
      });

      const result = await service.generateFollowupEmail({
        firstName: 'Alice',
        companyName: 'TechStartup',
        stepNumber: 2,
        previousSubject: 'Hi there',
      });

      expect(result.subject).toBe('Re: following up');
      expect(result.body).toBe('Hey Alice');
    });
  });
});
