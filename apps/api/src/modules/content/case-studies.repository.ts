import { Injectable, NotFoundException } from '@nestjs/common';
import { CaseStudy } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateCaseStudyDto {
  tenantId: string;
  title: string;
  client: string;
  industry?: string;
  techStack: string[];
  challenge: string;
  solution: string;
  result: string;
}

export interface RelevantCaseStudyFilter {
  industry?: string | null;
  techStack?: string[];
}

@Injectable()
export class CaseStudiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<CaseStudy[]> {
    return this.prisma.caseStudy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRelevant(tenantId: string, filter: RelevantCaseStudyFilter): Promise<CaseStudy[]> {
    const orConditions: object[] = [];
    if (filter.industry) orConditions.push({ industry: filter.industry });
    if (filter.techStack?.length) orConditions.push({ techStack: { hasSome: filter.techStack } });

    return this.prisma.caseStudy.findMany({
      where: {
        tenantId,
        ...(orConditions.length ? { OR: orConditions } : {}),
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCaseStudyDto): Promise<CaseStudy> {
    return this.prisma.caseStudy.create({ data: dto });
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.caseStudy.delete({ where: { id } });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') {
        throw new NotFoundException(`CaseStudy ${id} not found`);
      }
      throw err;
    }
  }
}
