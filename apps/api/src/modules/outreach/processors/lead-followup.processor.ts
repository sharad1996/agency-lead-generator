import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SequenceStatus, StepStatus } from '@prisma/client';
import { OutreachRepository } from '../outreach.repository';
import { OutreachService } from '../outreach.service';
import { SendGridService } from '../sendgrid.service';
import { QUEUES } from '../../../queue/queue.constants';
import { DAILY_EMAIL_LIMIT } from '../outreach.constants';
import { SEQUENCE_DAYS } from '../sequence.service';

interface FollowupJobData {
  stepId: string;
}

@Processor(QUEUES.FOLLOWUP)
export class LeadFollowupProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadFollowupProcessor.name);

  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly outreachService: OutreachService,
    private readonly sendGrid: SendGridService,
    @InjectQueue(QUEUES.FOLLOWUP) private readonly followupQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<FollowupJobData>): Promise<void> {
    const { stepId } = job.data;

    const step = await this.outreachRepo.findStepById(stepId);
    if (!step) {
      this.logger.warn(`Step ${stepId} not found — skipping`);
      return;
    }

    if (step.sequence.status !== SequenceStatus.ACTIVE) {
      this.logger.log(`Sequence ${step.sequence.id} is ${step.sequence.status} — skipping step ${stepId}`);
      return;
    }

    const { lead } = step.sequence;
    const sentToday = await this.outreachRepo.countSentToday(lead.tenantId);
    if (sentToday >= DAILY_EMAIL_LIMIT) {
      this.logger.warn(`Daily limit reached — rescheduling step ${stepId}`);
      const msUntilTomorrow = this.msUntilTomorrowUtc();
      await job.moveToDelayed(Date.now() + msUntilTomorrow);
      return;
    }

    if (!lead.contact.email) {
      this.logger.warn(`Lead ${lead.id} has no email — skipping followup step ${stepId}`);
      return;
    }

    const step1 = await this.outreachRepo.findFirstStepOfSequence(step.sequence.id);
    const previousSubject = step1?.subject ?? 'our services';

    const email = await this.outreachService.generateFollowupEmail({
      firstName: lead.contact.firstName,
      companyName: lead.company.name,
      stepNumber: step.stepNumber,
      previousSubject,
    });

    const messageId = await this.sendGrid.sendEmail({
      to: lead.contact.email,
      leadId: lead.id,
      subject: email.subject,
      body: email.body,
    });

    await this.outreachRepo.updateStep(stepId, {
      status: StepStatus.SENT,
      sentAt: new Date(),
      subject: email.subject,
      body: email.body,
      messageId,
    });

    await this.outreachRepo.updateSequence(step.sequence.id, { currentStep: step.stepNumber });

    const totalSteps = SEQUENCE_DAYS[step.sequence.sequenceType as 'HOT' | 'STANDARD']?.length ?? 4;
    if (step.stepNumber >= totalSteps) {
      await this.outreachRepo.updateSequence(step.sequence.id, { status: SequenceStatus.COMPLETED });
      this.logger.log(`Sequence ${step.sequence.id} completed for lead ${lead.id}`);
    }

    this.logger.log(`Lead ${lead.id} — step ${step.stepNumber} sent`);
  }

  private msUntilTomorrowUtc(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return tomorrow.getTime() - now.getTime() + 60_000;
  }
}
