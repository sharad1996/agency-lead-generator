import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProposalsService } from '../src/modules/proposals/proposals.service';
import { CaseStudiesRepository } from '../src/modules/content/case-studies.repository';
import { RateCardsRepository } from '../src/modules/content/rate-cards.repository';
import { ProposalsRepository } from '../src/modules/proposals/proposals.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

const mockCaseStudiesRepo = { findRelevant: jest.fn() };
const mockRateCardsRepo = { findAll: jest.fn() };
const mockProposalsRepo = { create: jest.fn() };
const mockPrisma = {
  opportunity: {
    findUnique: jest.fn(),
  },
};
const configMock = {
  get: (k: string) => {
    if (k === 'ANTHROPIC_API_KEY') return 'test-key';
    if (k === 'ORG_ID') return 'org-1';
    return undefined;
  },
};

const mockOpportunity = {
  id: 'opp-1',
  tenantId: 'org-1',
  lead: {
    contact: { firstName: 'Alice', lastName: 'Chen' },
    company: { name: 'TechStartup', industry: 'SaaS', techStack: ['React'] },
  },
};

const mockGeneratedContent = {
  executiveSummary: 'We help you ship fast.',
  proposedSolution: 'We build your React app.',
  techStack: ['React', 'NestJS'],
  timeline: '3 months in 6 sprints.',
  teamComposition: [{ role: 'Frontend Developer', seniority: 'Senior', count: 2, monthlyRate: 8000 }],
  investment: 'Total: $48,000 over 3 months.',
  whyUs: 'We are experts in React.',
  caseStudyHighlight: 'Built a fintech dashboard.',
};

describe('ProposalsService', () => {
  let service: ProposalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: CaseStudiesRepository, useValue: mockCaseStudiesRepo },
        { provide: RateCardsRepository, useValue: mockRateCardsRepo },
        { provide: ProposalsRepository, useValue: mockProposalsRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(ProposalsService);
    jest.clearAllMocks();
  });

  describe('generateProposal', () => {
    it('calls Claude Haiku and creates a Proposal record', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      mockCaseStudiesRepo.findRelevant.mockResolvedValue([]);
      mockRateCardsRepo.findAll.mockResolvedValue([
        { role: 'Frontend Developer', seniorityLevel: 'Senior', monthlyRate: 8000, hourlyRate: 50 },
      ]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedContent) }],
      });
      mockProposalsRepo.create.mockResolvedValue({ id: 'prop-1', content: mockGeneratedContent });

      const result = await service.generateProposal({
        opportunityId: 'opp-1',
        projectDescription: 'Build a React dashboard',
        techStackNeeded: ['React', 'NestJS'],
        durationMonths: 3,
        teamSize: 2,
        seniorityMix: 'senior',
      });

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
      );
      expect(mockProposalsRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('prop-1');
    });

    it('throws NotFoundException when opportunity not found', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(null);

      await expect(
        service.generateProposal({
          opportunityId: 'bad-id',
          projectDescription: 'x',
          techStackNeeded: [],
          durationMonths: 1,
          teamSize: 1,
          seniorityMix: 'mixed',
        }),
      ).rejects.toThrow('Opportunity bad-id not found');
    });

    it('throws when Claude returns invalid JSON', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      mockCaseStudiesRepo.findRelevant.mockResolvedValue([]);
      mockRateCardsRepo.findAll.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not json' }],
      });

      await expect(
        service.generateProposal({
          opportunityId: 'opp-1',
          projectDescription: 'x',
          techStackNeeded: [],
          durationMonths: 1,
          teamSize: 1,
          seniorityMix: 'mixed',
        }),
      ).rejects.toThrow('Invalid proposal generation response');
    });
  });
});
