import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LeadStatus, SequenceStatus, StepStatus } from '@prisma/client';
import { OutreachRepository } from '../outreach/outreach.repository';
import { LeadsRepository } from '../leads/leads.repository';
import { SendGridService } from '../outreach/sendgrid.service';
import { QUEUES } from '../../queue/queue.constants';
import { SEQUENCE_DAYS } from '../outreach/sequence.service';

export interface PendingApprovalDto {
  stepId: string;
  leadId: string;
  contactName: string;
  contactEmail: string;
  contactTitle: string | null;
  companyName: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly sendGrid: SendGridService,
    @InjectQueue(QUEUES.FOLLOWUP) private readonly followupQueue: Queue,
  ) {}

  async listPendingApprovals(tenantId: string): Promise<PendingApprovalDto[]> {
    const steps = await this.outreachRepo.findPendingApprovalSteps(tenantId);
    return steps.map((step) => ({
      stepId: step.id,
      leadId: step.sequence.lead.id,
      contactName: `${step.sequence.lead.contact.firstName} ${step.sequence.lead.contact.lastName}`,
      contactEmail: step.sequence.lead.contact.email,
      contactTitle: step.sequence.lead.contact.title,
      companyName: step.sequence.lead.company.name,
      subject: step.subject ?? '',
      body: step.body ?? '',
      scheduledAt: step.scheduledAt,
    }));
  }

  async approve(stepId: string, tenantId: string): Promise<void> {
    const step = await this.outreachRepo.findStepById(stepId);
    if (!step || step.sequence.lead.tenantId !== tenantId) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }

    if (step.status !== StepStatus.PENDING_APPROVAL) {
      this.logger.warn(`Step ${stepId} is already ${step.status} — skipping re-approval`);
      return;
    }

    const { lead } = step.sequence;

    if (!lead.contact.email) {
      throw new NotFoundException(`Lead ${lead.id} has no email address`);
    }

    const messageId = await this.sendGrid.sendEmail({
      to: lead.contact.email,
      leadId: lead.id,
      subject: step.subject!,
      body: step.body!,
    });

    await this.outreachRepo.updateStep(stepId, {
      status: StepStatus.SENT,
      sentAt: new Date(),
      messageId,
    });

    await this.outreachRepo.updateSequence(step.sequence.id, { currentStep: step.stepNumber });
    await this.leadsRepo.updateStatus(lead.id, LeadStatus.OUTREACH_SENT);

    // Schedule remaining follow-up steps
    const pendingSteps = await this.outreachRepo.findPendingStepsBySequenceId(step.sequence.id);
    const days = SEQUENCE_DAYS[step.sequence.sequenceType as 'HOT' | 'STANDARD'] ?? SEQUENCE_DAYS.STANDARD;
    for (const pending of pendingSteps) {
      const dayOffset = days[pending.stepNumber - 1] ?? 0;
      const delayMs = dayOffset * 24 * 60 * 60 * 1000;
      await this.followupQueue.add(
        'send-followup',
        { stepId: pending.id },
        { delay: delayMs },
      );
    }

    this.logger.log(`Step ${stepId} approved and sent to ${lead.contact.email}`);
  }

  async reject(stepId: string, tenantId: string): Promise<void> {
    const step = await this.outreachRepo.findStepById(stepId);
    if (!step || step.sequence.lead.tenantId !== tenantId) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }

    await this.outreachRepo.updateStep(stepId, { status: StepStatus.FAILED });
    await this.outreachRepo.updateSequence(step.sequence.id, {
      status: SequenceStatus.STOPPED,
      stoppedAt: new Date(),
    });
    await this.leadsRepo.updateStatus(step.sequence.lead.id, LeadStatus.DISQUALIFIED);

    this.logger.log(`Step ${stepId} rejected — lead ${step.sequence.lead.id} disqualified`);
  }
}
