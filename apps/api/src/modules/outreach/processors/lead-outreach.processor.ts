import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadsRepository } from '../../leads/leads.repository';
import { LeadStatus, StepStatus, Priority } from '@prisma/client';
import { SequenceService, SEQUENCE_DAYS } from '../sequence.service';
import { SendGridService } from '../sendgrid.service';
import { OutreachRepository } from '../outreach.repository';
import { QUEUES } from '../../../queue/queue.constants';
import { DAILY_EMAIL_LIMIT } from '../outreach.constants';

interface OutreachJobData {
  leadId: string;
}

@Processor(QUEUES.OUTREACH)
export class LeadOutreachProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadOutreachProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsRepo: LeadsRepository,
    private readonly sequenceService: SequenceService,
    private readonly sendGrid: SendGridService,
    private readonly outreachRepo: OutreachRepository,
    @InjectQueue(QUEUES.FOLLOWUP) private readonly followupQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<OutreachJobData>): Promise<void> {
    const { leadId } = job.data;

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, company: true },
    });

    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found — skipping outreach`);
      return;
    }

    const sentToday = await this.outreachRepo.countSentToday(lead.tenantId);
    if (sentToday >= DAILY_EMAIL_LIMIT) {
      this.logger.warn(`Daily email limit reached (${sentToday}/${DAILY_EMAIL_LIMIT}) — rescheduling lead ${leadId}`);
      const msUntilTomorrow = this.msUntilTomorrowUtc();
      await job.moveToDelayed(Date.now() + msUntilTomorrow);
      return;
    }

    const result = await this.sequenceService.createForLead({
      leadId: lead.id,
      tenantId: lead.tenantId,
      priority: lead.priority!,
      contact: {
        firstName: lead.contact.firstName,
        lastName: lead.contact.lastName,
        email: lead.contact.email!,
        title: lead.contact.title,
      },
      company: {
        name: lead.company.name,
        industry: lead.company.industry,
        techStack: lead.company.techStack,
        location: lead.company.location,
        website: lead.company.website,
      },
    });

    if (result.firstStepNeedsApproval) {
      await this.leadsRepo.updateStatus(leadId, LeadStatus.OUTREACH_PENDING_APPROVAL);
      this.logger.log(`Lead ${leadId} awaiting approval — sequence ${result.sequenceId}`);
      return;
    }

    if (!lead.contact.email) {
      this.logger.warn(`Lead ${leadId} has no email — skipping send`);
      return;
    }

    await this.sendStep(result.firstStepId, lead.contact.email, leadId, result.sequenceId, lead.tenantId, lead.priority!);
  }

  private async sendStep(
    stepId: string,
    toEmail: string,
    leadId: string,
    sequenceId: string,
    tenantId: string,
    priority: Priority,
  ): Promise<void> {
    const step = await this.outreachRepo.findStepById(stepId);
    if (!step || !step.subject || !step.body) {
      this.logger.error(`Step ${stepId} missing subject/body — cannot send`);
      return;
    }

    const messageId = await this.sendGrid.sendEmail({
      to: toEmail,
      leadId,
      subject: step.subject,
      body: step.body,
    });

    await this.outreachRepo.updateStep(stepId, {
      status: StepStatus.SENT,
      sentAt: new Date(),
      messageId,
    });

    await this.outreachRepo.updateSequence(sequenceId, { currentStep: step.stepNumber });
    await this.leadsRepo.updateStatus(leadId, LeadStatus.OUTREACH_SENT);

    // Schedule follow-up steps using their actual stepIds (aligned with LeadFollowupProcessor)
    const days = SEQUENCE_DAYS[priority] ?? SEQUENCE_DAYS.STANDARD;
    const pendingSteps = await this.outreachRepo.findPendingStepsBySequenceId(sequenceId);
    for (const pending of pendingSteps) {
      const dayOffset = days[pending.stepNumber - 1] ?? 0;
      const delayMs = dayOffset * 24 * 60 * 60 * 1000;
      await this.followupQueue.add(
        'send-followup',
        { stepId: pending.id },
        { delay: delayMs },
      );
    }

    this.logger.log(`Lead ${leadId} — step 1 sent, ${pendingSteps.length} follow-ups scheduled`);
  }

  private msUntilTomorrowUtc(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return tomorrow.getTime() - now.getTime() + 60_000;
  }
}
