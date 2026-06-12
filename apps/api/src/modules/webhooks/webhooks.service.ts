import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus, SequenceStatus } from '@prisma/client';
import { OutreachRepository } from '../outreach/outreach.repository';
import { LeadsRepository } from '../leads/leads.repository';

export interface InboundEmailPayload {
  to: string;
  from: string;
  subject: string;
  text: string;
  headers: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly REPLY_PLUS_REGEX = /reply\+([^@]+)@/;

  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly leadsRepo: LeadsRepository,
  ) {}

  async handleInboundEmail(payload: InboundEmailPayload): Promise<void> {
    const match = this.REPLY_PLUS_REGEX.exec(payload.to);
    if (!match) {
      this.logger.log(`Inbound email to ${payload.to} — no reply+ pattern, ignoring`);
      return;
    }

    const leadId = match[1];
    const sequences = await this.outreachRepo.findSequencesByLeadId(leadId);

    if (!sequences.length) {
      this.logger.warn(`No sequence for lead ${leadId} — ignoring reply`);
      return;
    }

    const sequence = sequences[0];
    if (sequence.status === SequenceStatus.STOPPED || sequence.status === SequenceStatus.COMPLETED) {
      this.logger.log(`Sequence for lead ${leadId} already inactive — ignoring reply`);
      return;
    }

    await this.outreachRepo.updateSequence(sequence.id, {
      status: SequenceStatus.STOPPED,
      stoppedAt: new Date(),
    });

    await this.leadsRepo.updateStatus(leadId, LeadStatus.REPLIED);
    this.logger.log(`Reply detected from ${payload.from} — lead ${leadId} marked REPLIED`);
  }
}
