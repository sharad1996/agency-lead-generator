import { ScoringService } from '../src/modules/scoring/scoring.service';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import OpenAI from 'openai';

jest.mock('openai');

describe('ScoringService', () => {
  let service: ScoringService;
  let mockCreate: jest.Mock;

  beforeEach(async () => {
    mockCreate = jest.fn();

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () =>
        ({
          chat: { completions: { create: mockCreate } },
        }) as unknown as OpenAI,
    );

    const module = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: ConfigService,
          useValue: { get: () => 'test-key' },
        },
      ],
    }).compile();

    service = module.get(ScoringService);
  });

  it('returns HOT for a well-matched lead', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 85,
              priority: 'HOT',
              reasons: ['Hiring React developers', 'Series A funded', 'US-based SaaS'],
            }),
          },
        },
      ],
    });

    const result = await service.scoreLead({
      companyName: 'Acme',
      industry: 'SaaS',
      location: 'San Francisco, United States',
      teamSize: '11-50',
      fundingStage: 'Series A',
      fundingAmount: 5000000,
      techStack: ['React', 'Node.js'],
      hiringSignals: { roles: ['Senior React Developer'] },
      contactTitle: 'CTO',
    });

    expect(result.score).toBe(85);
    expect(result.priority).toBe('HOT');
    expect(result.reasons).toHaveLength(3);
  });

  it('clamps score to 0-100 range', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 150,
              priority: 'HOT',
              reasons: ['Test'],
            }),
          },
        },
      ],
    });

    const result = await service.scoreLead({ companyName: 'X' } as never);
    expect(result.score).toBe(100);
  });

  it('throws if OpenAI returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
    });

    await expect(
      service.scoreLead({ companyName: 'X' } as never),
    ).rejects.toThrow('Invalid scoring response');
  });

  it('uses gpt-4o-mini model', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ score: 50, priority: 'WARM', reasons: ['OK'] }),
          },
        },
      ],
    });

    await service.scoreLead({ companyName: 'Test' } as never);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' }),
    );
  });
});
