import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository';
import { ProposalsRepository } from '../src/modules/proposals/proposals.repository';

const mockPrisma = {
  lead: { count: jest.fn(), groupBy: jest.fn() },
  outreachStep: { count: jest.fn() },
};
const mockMeetingsRepo = { countScheduled: jest.fn(), countTotal: jest.fn() };
const mockProposalsRepo = { countByStatus: jest.fn() };

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MeetingsRepository, useValue: mockMeetingsRepo },
        { provide: ProposalsRepository, useValue: mockProposalsRepo },
      ],
    }).compile();
    service = module.get(DashboardService);
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('aggregates lead, email, meeting, and proposal counts', async () => {
      mockPrisma.lead.count
        .mockResolvedValueOnce(120)   // total leads
        .mockResolvedValueOnce(15)    // replied leads
        .mockResolvedValueOnce(80);   // outreach sent leads
      mockPrisma.lead.groupBy.mockResolvedValue([
        { status: 'NEW', _count: { status: 30 } },
        { status: 'OUTREACH_SENT', _count: { status: 50 } },
      ]);
      mockPrisma.outreachStep.count
        .mockResolvedValueOnce(25)   // sent today
        .mockResolvedValueOnce(120); // sent this week
      mockMeetingsRepo.countScheduled.mockResolvedValue(3);
      mockMeetingsRepo.countTotal.mockResolvedValue(12);
      mockProposalsRepo.countByStatus.mockResolvedValue({ draft: 2, sent: 5 });

      const result = await service.getMetrics('org-1');

      expect(result.leads.total).toBe(120);
      expect(result.leads.byStatus).toEqual({ NEW: 30, OUTREACH_SENT: 50 });
      expect(result.emails.sentToday).toBe(25);
      expect(result.emails.sentThisWeek).toBe(120);
      expect(result.emails.replyRate).toBeCloseTo(18.75);
      expect(result.meetings.scheduled).toBe(3);
      expect(result.meetings.total).toBe(12);
      expect(result.proposals.draft).toBe(2);
      expect(result.proposals.sent).toBe(5);
    });
  });
});
