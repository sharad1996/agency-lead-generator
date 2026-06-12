import { Test, TestingModule } from '@nestjs/testing';
import { RateCardsRepository } from '../src/modules/content/rate-cards.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  rateCard: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

const mockRateCard = {
  id: 'rc-1',
  tenantId: 'org-1',
  role: 'Frontend Developer',
  seniorityLevel: 'Senior',
  monthlyRate: 8000,
  hourlyRate: 50,
  currency: 'USD',
};

describe('RateCardsRepository', () => {
  let repo: RateCardsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateCardsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(RateCardsRepository);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all rate cards for tenant', async () => {
      mockPrisma.rateCard.findMany.mockResolvedValue([mockRateCard]);
      const result = await repo.findAll('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('upsert', () => {
    it('creates or updates a rate card by role+seniority', async () => {
      mockPrisma.rateCard.upsert.mockResolvedValue(mockRateCard);
      const result = await repo.upsert({
        tenantId: 'org-1',
        role: 'Frontend Developer',
        seniorityLevel: 'Senior',
        monthlyRate: 8000,
        hourlyRate: 50,
        currency: 'USD',
      });
      expect(mockPrisma.rateCard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_role_seniorityLevel: { tenantId: 'org-1', role: 'Frontend Developer', seniorityLevel: 'Senior' } },
        }),
      );
      expect(result).toEqual(mockRateCard);
    });
  });

  describe('delete', () => {
    it('deletes a rate card by id', async () => {
      mockPrisma.rateCard.delete.mockResolvedValue(mockRateCard);
      await repo.delete('rc-1');
      expect(mockPrisma.rateCard.delete).toHaveBeenCalledWith({ where: { id: 'rc-1' } });
    });
  });
});
