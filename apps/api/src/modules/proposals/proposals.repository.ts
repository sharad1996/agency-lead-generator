import { Injectable } from '@nestjs/common';
import { Proposal, ProposalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProposalContent } from './prompts/proposal.prompt';

export interface CreateProposalDto {
  tenantId: string;
  opportunityId: string;
  title: string;
  content: ProposalContent;
}

@Injectable()
export class ProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProposalDto): Promise<Proposal> {
    return this.prisma.proposal.create({
      data: {
        tenantId: dto.tenantId,
        opportunityId: dto.opportunityId,
        title: dto.title,
        content: dto.content as object,
        status: ProposalStatus.DRAFT,
      },
    });
  }

  async findAll(tenantId: string): Promise<Proposal[]> {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Proposal | null> {
    return this.prisma.proposal.findUnique({ where: { id } });
  }

  async markSent(id: string): Promise<Proposal> {
    return this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.SENT, sentAt: new Date() },
    });
  }

  async countByStatus(tenantId: string): Promise<{ draft: number; sent: number }> {
    const [draft, sent] = await Promise.all([
      this.prisma.proposal.count({ where: { tenantId, status: ProposalStatus.DRAFT } }),
      this.prisma.proposal.count({ where: { tenantId, status: ProposalStatus.SENT } }),
    ]);
    return { draft, sent };
  }
}
