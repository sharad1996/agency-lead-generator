import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutreachSequence, OutreachStep, SequenceStatus, StepStatus } from '@prisma/client';

export interface CreateSequenceDto {
  tenantId: string;
  leadId: string;
  sequenceType: string;
}

export interface CreateStepDto {
  sequenceId: string;
  tenantId: string;
  stepNumber: number;
  scheduledAt: Date;
  status: StepStatus;
  subject?: string;
  body?: string;
}

export type OutreachStepWithSequence = OutreachStep & {
  sequence: OutreachSequence & {
    lead: {
      id: string;
      tenantId: string;
      contact: { firstName: string; lastName: string; email: string; title: string | null };
      company: { name: string; website: string | null };
    };
  };
};

@Injectable()
export class OutreachRepository {
  constructor(private readonly prisma: PrismaService) { }

  async createSequence(dto: CreateSequenceDto): Promise<OutreachSequence> {
    return this.prisma.outreachSequence.create({
      data: { tenantId: dto.tenantId, leadId: dto.leadId, sequenceType: dto.sequenceType },
    });
  }

  async createSteps(steps: CreateStepDto[]): Promise<void> {
    await this.prisma.outreachStep.createMany({ data: steps });
  }

  async findPendingApprovalSteps(tenantId: string): Promise<OutreachStepWithSequence[]> {
    return this.prisma.outreachStep.findMany({
      where: { tenantId, status: StepStatus.PENDING_APPROVAL },
      include: {
        sequence: {
          include: {
            lead: { include: { contact: true, company: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    }) as Promise<OutreachStepWithSequence[]>;
  }

  async countSentToday(tenantId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.prisma.outreachStep.count({
      where: { tenantId, status: StepStatus.SENT, sentAt: { gte: startOfDay } },
    });
  }

  async hasAnySentStep(tenantId: string): Promise<boolean> {
    const count = await this.prisma.outreachStep.count({
      where: { tenantId, status: StepStatus.SENT },
    });
    return count > 0;
  }

  async findStepById(id: string): Promise<OutreachStepWithSequence | null> {
    return this.prisma.outreachStep.findUnique({
      where: { id },
      include: {
        sequence: {
          include: {
            lead: { include: { contact: true, company: true } },
          },
        },
      },
    }) as Promise<OutreachStepWithSequence | null>;
  }

  async findSequenceByLeadId(leadId: string, tenantId: string): Promise<OutreachSequence | null> {
    return this.prisma.outreachSequence.findFirst({
      where: { leadId, tenantId },
    });
  }

  async findSequencesByLeadId(leadId: string): Promise<OutreachSequence[]> {
    return this.prisma.outreachSequence.findMany({ where: { leadId } });
  }

  async findStepByMessageId(messageId: string): Promise<OutreachStepWithSequence | null> {
    return this.prisma.outreachStep.findFirst({
      where: { messageId },
      include: {
        sequence: {
          include: {
            lead: { include: { contact: true, company: true } },
          },
        },
      },
    }) as Promise<OutreachStepWithSequence | null>;
  }

  async findFirstStepOfSequence(sequenceId: string): Promise<OutreachStep | null> {
    return this.prisma.outreachStep.findFirst({
      where: { sequenceId, stepNumber: 1 },
    });
  }

  async findPendingStepsBySequenceId(sequenceId: string): Promise<OutreachStep[]> {
    return this.prisma.outreachStep.findMany({
      where: { sequenceId, status: StepStatus.PENDING },
      orderBy: { stepNumber: 'asc' },
    });
  }

  async updateStep(id: string, data: Partial<Pick<OutreachStep, 'status' | 'sentAt' | 'subject' | 'body' | 'messageId' | 'openedAt'>>): Promise<OutreachStep> {
    return this.prisma.outreachStep.update({ where: { id }, data });
  }

  async updateEmail(
    id: string,
    data: Partial<
      Pick<
        OutreachStep,
        "status" | "sentAt" | "subject" | "body" | "messageId" | "openedAt"
      >
    >,
  ): Promise<OutreachStep> {
    return this.prisma.outreachStep.update({
      where: { id },
      data,
    });
  }

  async updateSequence(id: string, data: Partial<Pick<OutreachSequence, 'status' | 'stoppedAt' | 'currentStep'>>): Promise<OutreachSequence> {
    return this.prisma.outreachSequence.update({ where: { id }, data });
  }
}
