import { Test, TestingModule } from '@nestjs/testing';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  outreachSequence: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  outreachStep: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('OutreachRepository', () => {
  let repo: OutreachRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(OutreachRepository);
    jest.clearAllMocks();
  });

  describe('createSequence', () => {
    it('creates a sequence with provided data', async () => {
      const seq = { id: 'seq-1', tenantId: 'org-1', leadId: 'lead-1' };
      mockPrisma.outreachSequence.create.mockResolvedValue(seq);

      const result = await repo.createSequence({
        tenantId: 'org-1',
        leadId: 'lead-1',
        sequenceType: 'HOT',
      });

      expect(mockPrisma.outreachSequence.create).toHaveBeenCalledWith({
        data: { tenantId: 'org-1', leadId: 'lead-1', sequenceType: 'HOT' },
      });
      expect(result).toEqual(seq);
    });
  });

  describe('createSteps', () => {
    it('bulk-creates steps', async () => {
      mockPrisma.outreachStep.createMany.mockResolvedValue({ count: 4 });

      await repo.createSteps([
        { sequenceId: 'seq-1', tenantId: 'org-1', stepNumber: 1, scheduledAt: new Date(), status: 'PENDING_APPROVAL' },
        { sequenceId: 'seq-1', tenantId: 'org-1', stepNumber: 2, scheduledAt: new Date(), status: 'PENDING' },
      ]);

      expect(mockPrisma.outreachStep.createMany).toHaveBeenCalled();
    });
  });

  describe('findPendingApprovalSteps', () => {
    it('queries steps with PENDING_APPROVAL status', async () => {
      mockPrisma.outreachStep.findMany.mockResolvedValue([]);
      await repo.findPendingApprovalSteps('org-1');
      expect(mockPrisma.outreachStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING_APPROVAL', tenantId: 'org-1' }),
        }),
      );
    });
  });

  describe('countSentToday', () => {
    it('counts steps sent after UTC midnight today', async () => {
      mockPrisma.outreachStep.count.mockResolvedValue(7);
      const result = await repo.countSentToday('org-1');
      expect(result).toBe(7);
      const call = mockPrisma.outreachStep.count.mock.calls[0][0];
      expect(call.where.tenantId).toBe('org-1');
      expect(call.where.status).toBe('SENT');
      expect(call.where.sentAt.gte).toBeInstanceOf(Date);
    });
  });

  describe('hasAnySentStep', () => {
    it('returns true when count > 0', async () => {
      mockPrisma.outreachStep.count.mockResolvedValue(1);
      const result = await repo.hasAnySentStep('org-1');
      expect(result).toBe(true);
    });

    it('returns false when no sent steps', async () => {
      mockPrisma.outreachStep.count.mockResolvedValue(0);
      const result = await repo.hasAnySentStep('org-1');
      expect(result).toBe(false);
    });
  });

  describe('updateStep', () => {
    it('updates step by id', async () => {
      mockPrisma.outreachStep.update.mockResolvedValue({ id: 'step-1' });
      await repo.updateStep('step-1', { status: 'SENT', sentAt: new Date() });
      expect(mockPrisma.outreachStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });
  });

  describe('updateSequence', () => {
    it('updates sequence by id', async () => {
      mockPrisma.outreachSequence.update.mockResolvedValue({ id: 'seq-1' });
      await repo.updateSequence('seq-1', { status: 'STOPPED', stoppedAt: new Date() });
      expect(mockPrisma.outreachSequence.update).toHaveBeenCalledWith({
        where: { id: 'seq-1' },
        data: expect.objectContaining({ status: 'STOPPED' }),
      });
    });
  });

  describe('findSequenceByLeadId', () => {
    it('finds active sequence for lead', async () => {
      const seq = { id: 'seq-1', status: 'ACTIVE' };
      mockPrisma.outreachSequence.findFirst.mockResolvedValue(seq);
      const result = await repo.findSequenceByLeadId('lead-1', 'org-1');
      expect(result).toEqual(seq);
    });
  });

  describe('findStepById', () => {
    it('finds step including sequence relation', async () => {
      const step = { id: 'step-1', sequence: { leadId: 'lead-1' } };
      mockPrisma.outreachStep.findUnique.mockResolvedValue(step);
      const result = await repo.findStepById('step-1');
      expect(result).toEqual(step);
    });
  });

  describe('findFirstStepOfSequence', () => {
    it('finds step 1 for a sequence', async () => {
      const step = { id: 'step-1', stepNumber: 1 };
      mockPrisma.outreachStep.findFirst.mockResolvedValue(step);
      const result = await repo.findFirstStepOfSequence('seq-1');
      expect(mockPrisma.outreachStep.findFirst).toHaveBeenCalledWith({
        where: { sequenceId: 'seq-1', stepNumber: 1 },
      });
      expect(result).toEqual(step);
    });
  });

  describe('findPendingStepsBySequenceId', () => {
    it('finds all PENDING steps for a sequence', async () => {
      mockPrisma.outreachStep.findMany.mockResolvedValue([]);
      await repo.findPendingStepsBySequenceId('seq-1');
      expect(mockPrisma.outreachStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sequenceId: 'seq-1', status: 'PENDING' }),
        }),
      );
    });
  });

  describe('findSequencesByLeadId', () => {
    it('finds all sequences for a lead', async () => {
      mockPrisma.outreachSequence.findMany.mockResolvedValue([{ id: 'seq-1' }]);
      const result = await repo.findSequencesByLeadId('lead-1');
      expect(mockPrisma.outreachSequence.findMany).toHaveBeenCalledWith({
        where: { leadId: 'lead-1' },
      });
      expect(result).toHaveLength(1);
    });
  });
});
