import { Injectable } from '@nestjs/common';
import { Priority, StepStatus } from '@prisma/client';
import { OutreachRepository } from './outreach.repository';
import { OutreachService } from './outreach.service';

export const SEQUENCE_DAYS: Record<'HOT' | 'STANDARD', number[]> = {
  HOT: [0, 1, 4, 9],
  STANDARD: [0, 2, 6, 13],
};

export interface CreateSequenceInput {
  leadId: string;
  tenantId: string;
  priority: Priority;
  contact: { firstName: string; lastName: string; email: string; title: string | null };
  company: { name: string; industry: string | null; techStack: string[]; location: string | null; website: string | null };
}

export interface CreateSequenceResult {
  sequenceId: string;
  firstStepId: string;
  firstStepNeedsApproval: boolean;
}

@Injectable()
export class SequenceService {
  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly outreachService: OutreachService,
  ) {}

  async createForLead(input: CreateSequenceInput): Promise<CreateSequenceResult> {
    const sequenceType = input.priority === Priority.HOT ? 'HOT' : 'STANDARD';
    const days = SEQUENCE_DAYS[sequenceType];

    const firstBatch = !(await this.outreachRepo.hasAnySentStep(input.tenantId));

    const email = await this.outreachService.generateColdEmail({
      firstName: input.contact.firstName,
      lastName: input.contact.lastName,
      title: input.contact.title,
      companyName: input.company.name,
      industry: input.company.industry,
      techStack: input.company.techStack,
      location: input.company.location,
    });

    const sequence = await this.outreachRepo.createSequence({
      tenantId: input.tenantId,
      leadId: input.leadId,
      sequenceType,
    });

    const now = new Date();
    const steps = days.map((dayOffset, index) => {
      const scheduledAt = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const isFirst = index === 0;

      return {
        sequenceId: sequence.id,
        tenantId: input.tenantId,
        stepNumber: index + 1,
        scheduledAt,
        status: isFirst
          ? (firstBatch ? StepStatus.PENDING_APPROVAL : StepStatus.APPROVED)
          : StepStatus.PENDING,
        subject: isFirst ? email.subject : undefined,
        body: isFirst ? email.body : undefined,
      };
    });

    await this.outreachRepo.createSteps(steps);

    const firstStep = await this.outreachRepo.findFirstStepOfSequence(sequence.id);

    return {
      sequenceId: sequence.id,
      firstStepId: firstStep!.id,
      firstStepNeedsApproval: firstBatch,
    };
  }
}
