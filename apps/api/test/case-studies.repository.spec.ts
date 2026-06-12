import { Test, TestingModule } from '@nestjs/testing';
import { CaseStudiesRepository } from '../src/modules/content/case-studies.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  caseStudy: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockCaseStudy = {
  id: 'cs-1',
  tenantId: 'org-1',
  title: 'React dashboard for fintech',
  client: 'FinCo',
  industry: 'Fintech',
  techStack: ['React', 'TypeScript'],
  challenge: 'Legacy jQuery app',
  solution: 'Rewrote in React',
  result: '40% faster load time',
};

describe('CaseStudiesRepository', () => {
  let repo: CaseStudiesRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseStudiesRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(CaseStudiesRepository);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all case studies for tenant', async () => {
      mockPrisma.caseStudy.findMany.mockResolvedValue([mockCaseStudy]);
      const result = await repo.findAll('org-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.caseStudy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'org-1' } }),
      );
    });
  });

  describe('findRelevant', () => {
    it('filters by industry or tech stack', async () => {
      mockPrisma.caseStudy.findMany.mockResolvedValue([mockCaseStudy]);
      const result = await repo.findRelevant('org-1', { industry: 'Fintech', techStack: ['React'] });
      expect(result).toHaveLength(1);
      expect(mockPrisma.caseStudy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ industry: 'Fintech' }),
              expect.objectContaining({ techStack: expect.objectContaining({ hasSome: ['React'] }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a case study', async () => {
      mockPrisma.caseStudy.create.mockResolvedValue(mockCaseStudy);
      const result = await repo.create({
        tenantId: 'org-1',
        title: 'React dashboard for fintech',
        client: 'FinCo',
        industry: 'Fintech',
        techStack: ['React', 'TypeScript'],
        challenge: 'Legacy jQuery app',
        solution: 'Rewrote in React',
        result: '40% faster load time',
      });
      expect(result.id).toBe('cs-1');
    });
  });

  describe('delete', () => {
    it('deletes a case study by id', async () => {
      mockPrisma.caseStudy.delete.mockResolvedValue(mockCaseStudy);
      await repo.delete('cs-1');
      expect(mockPrisma.caseStudy.delete).toHaveBeenCalledWith({ where: { id: 'cs-1' } });
    });
  });
});
