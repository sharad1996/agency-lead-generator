import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Lead, LeadStatus, Priority, Prisma } from '@prisma/client';
import { LeadFiltersDto } from './dto/lead-filters.dto';

export interface CreateLeadDto {
  tenantId: string;
  contactId: string;
  companyId: string;
  source: string;
  hiringSignals?: Prisma.InputJsonValue;
}

export interface UpdateLeadScoreDto {
  id: string;
  score: number;
  priority: Priority;
  scoreReasons: string[];
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateLeadDto): Promise<Lead> {
    return this.prisma.lead.create({
      data: {
        tenantId: dto.tenantId,
        contactId: dto.contactId,
        companyId: dto.companyId,
        status: LeadStatus.NEW,
        source: dto.source,
        hiringSignals: dto.hiringSignals,
      },
    });
  }

  async findAll(
    filters: LeadFiltersDto & { tenantId: string },
  ): Promise<{
    leads: Lead[]; pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const where: Prisma.LeadWhereInput = {
      tenantId: filters.tenantId,
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: { contact: true, company: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      leads: leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, tenantId: string): Promise<Lead | null> {
    return this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: { contact: true, company: true, activities: true },
    });
  }

  async updateScore(dto: UpdateLeadScoreDto): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id: dto.id },
      data: {
        score: dto.score,
        priority: dto.priority,
        scoreReasons: dto.scoreReasons,
        status: LeadStatus.SCORED,
      },
    });
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: { status },
    });
  }

  async countCreatedToday(tenantId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.prisma.lead.count({
      where: {
        tenantId,
        createdAt: { gte: startOfDay },
      },
    });
  }
}
