import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingsRepository } from '../meetings/meetings.repository';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { StepStatus } from '@prisma/client';

export interface DashboardMetrics {
  leads: { total: number; byStatus: Record<string, number> };
  emails: { sentToday: number; sentThisWeek: number; replyRate: number };
  meetings: { scheduled: number; total: number };
  proposals: { draft: number; sent: number };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetingsRepo: MeetingsRepository,
    private readonly proposalsRepo: ProposalsRepository,
  ) {}

  async getMetrics(tenantId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      repliedLeads,
      outreachSentLeads,
      leadsByStatus,
      sentToday,
      sentThisWeek,
      meetingsScheduled,
      meetingsTotal,
      proposalCounts,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId, status: 'REPLIED' } }),
      this.prisma.lead.count({ where: { tenantId, status: { in: ['OUTREACH_SENT', 'REPLIED', 'MEETING_BOOKED', 'PROPOSAL_SENT', 'CONVERTED'] } } }),
      this.prisma.lead.groupBy({ by: ['status'], where: { tenantId }, _count: { status: true } }),
      this.prisma.outreachStep.count({ where: { tenantId, status: StepStatus.SENT, sentAt: { gte: startOfToday } } }),
      this.prisma.outreachStep.count({ where: { tenantId, status: StepStatus.SENT, sentAt: { gte: startOfWeek } } }),
      this.meetingsRepo.countScheduled(tenantId),
      this.meetingsRepo.countTotal(tenantId),
      this.proposalsRepo.countByStatus(tenantId),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of leadsByStatus) {
      byStatus[row.status] = row._count.status;
    }

    const replyRate = outreachSentLeads > 0 ? (repliedLeads / outreachSentLeads) * 100 : 0;

    return {
      leads: { total: totalLeads, byStatus },
      emails: { sentToday, sentThisWeek, replyRate },
      meetings: { scheduled: meetingsScheduled, total: meetingsTotal },
      proposals: proposalCounts,
    };
  }
}
