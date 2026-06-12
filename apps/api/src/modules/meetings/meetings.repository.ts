import { Injectable } from '@nestjs/common';
import { Meeting, MeetingStatus, Opportunity, OpportunityStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateMeetingDto {
  tenantId: string;
  leadId: string;
  opportunityId: string;
  calComEventId: string;
  scheduledAt: Date;
  durationMins: number;
}

@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateOpportunity(leadId: string, tenantId: string, title: string): Promise<Opportunity> {
    const existing = await this.prisma.opportunity.findFirst({
      where: { leadId, tenantId },
    });
    if (existing) return existing;

    return this.prisma.opportunity.create({
      data: { tenantId, leadId, title, stage: OpportunityStage.DISCOVERY },
    });
  }

  async createMeeting(dto: CreateMeetingDto): Promise<Meeting> {
    return this.prisma.meeting.create({
      data: {
        tenantId: dto.tenantId,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        calComEventId: dto.calComEventId,
        scheduledAt: dto.scheduledAt,
        durationMins: dto.durationMins,
        status: MeetingStatus.SCHEDULED,
      },
    });
  }

  async cancelMeeting(calComEventId: string): Promise<void> {
    await this.prisma.meeting.updateMany({
      where: { calComEventId },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  async countScheduled(tenantId: string): Promise<number> {
    return this.prisma.meeting.count({
      where: { tenantId, status: MeetingStatus.SCHEDULED },
    });
  }

  async countTotal(tenantId: string): Promise<number> {
    return this.prisma.meeting.count({ where: { tenantId } });
  }
}
