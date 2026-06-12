import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingsRepository } from './meetings.repository';
import { LeadsRepository } from '../leads/leads.repository';

export interface BookingCreatedInput {
  uid: string;
  startTime: string;
  durationMins: number;
  attendeeEmail: string;
  attendeeName: string;
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private readonly orgId: string;

  constructor(
    private readonly meetingsRepo: MeetingsRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.orgId = this.config.get<string>('ORG_ID')!;
  }

  async handleBookingCreated(input: BookingCreatedInput): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { email: input.attendeeEmail, tenantId: this.orgId },
      include: {
        leads: { orderBy: { createdAt: 'desc' }, take: 1 },
        company: { select: { name: true } },
      },
    });

    if (!contact) {
      this.logger.warn(`No contact found for ${input.attendeeEmail} — skipping meeting creation`);
      return;
    }

    const lead = contact.leads[0];
    if (!lead) {
      this.logger.warn(`Contact ${contact.id} has no leads — skipping meeting creation`);
      return;
    }

    const opportunityTitle = `${input.attendeeName} at ${contact.company?.name ?? 'Unknown Company'}`;
    const opportunity = await this.meetingsRepo.findOrCreateOpportunity(lead.id, this.orgId, opportunityTitle);

    await this.meetingsRepo.createMeeting({
      tenantId: this.orgId,
      leadId: lead.id,
      opportunityId: opportunity.id,
      calComEventId: input.uid,
      scheduledAt: new Date(input.startTime),
      durationMins: input.durationMins,
    });

    await this.leadsRepo.updateStatus(lead.id, LeadStatus.MEETING_BOOKED);
    this.logger.log(`Meeting created for lead ${lead.id} — calComEventId=${input.uid}`);
  }

  async handleBookingCancelled(calComEventId: string): Promise<void> {
    await this.meetingsRepo.cancelMeeting(calComEventId);
    this.logger.log(`Meeting cancelled — calComEventId=${calComEventId}`);
  }
}
