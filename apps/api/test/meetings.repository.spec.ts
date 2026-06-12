import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  meeting: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  opportunity: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

describe('MeetingsRepository', () => {
  let repo: MeetingsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(MeetingsRepository);
    jest.clearAllMocks();
  });

  describe('findOrCreateOpportunity', () => {
    it('returns existing opportunity when found', async () => {
      const existing = { id: 'opp-1', leadId: 'lead-1' };
      mockPrisma.opportunity.findFirst.mockResolvedValue(existing);

      const result = await repo.findOrCreateOpportunity('lead-1', 'org-1', 'Alice at TechStartup');

      expect(mockPrisma.opportunity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { leadId: 'lead-1', tenantId: 'org-1' } }),
      );
      expect(mockPrisma.opportunity.create).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('creates opportunity when none found', async () => {
      mockPrisma.opportunity.findFirst.mockResolvedValue(null);
      mockPrisma.opportunity.create.mockResolvedValue({ id: 'opp-new', leadId: 'lead-1' });

      const result = await repo.findOrCreateOpportunity('lead-1', 'org-1', 'Alice at TechStartup');

      expect(mockPrisma.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leadId: 'lead-1', tenantId: 'org-1', title: 'Alice at TechStartup' }),
        }),
      );
      expect(result.id).toBe('opp-new');
    });
  });

  describe('createMeeting', () => {
    it('creates a meeting record', async () => {
      const mtg = { id: 'mtg-1', leadId: 'lead-1' };
      mockPrisma.meeting.create.mockResolvedValue(mtg);

      const result = await repo.createMeeting({
        tenantId: 'org-1',
        leadId: 'lead-1',
        opportunityId: 'opp-1',
        calComEventId: 'uid-123',
        scheduledAt: new Date('2026-06-20T10:00:00Z'),
        durationMins: 30,
      });

      expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ calComEventId: 'uid-123', durationMins: 30 }),
        }),
      );
      expect(result).toEqual(mtg);
    });
  });

  describe('cancelMeeting', () => {
    it('updates meeting status to CANCELLED by calComEventId', async () => {
      mockPrisma.meeting.updateMany.mockResolvedValue({ count: 1 });

      await repo.cancelMeeting('uid-123');

      expect(mockPrisma.meeting.updateMany).toHaveBeenCalledWith({
        where: { calComEventId: 'uid-123' },
        data: { status: 'CANCELLED' },
      });
    });
  });

  describe('countScheduled', () => {
    it('counts meetings with SCHEDULED status', async () => {
      mockPrisma.meeting.count.mockResolvedValue(5);
      const result = await repo.countScheduled('org-1');
      expect(result).toBe(5);
      expect(mockPrisma.meeting.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'org-1', status: 'SCHEDULED' }) }),
      );
    });
  });
});
