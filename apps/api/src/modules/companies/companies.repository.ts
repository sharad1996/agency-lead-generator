import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCompanyDto } from './dto/upsert-company.dto';
import { Company } from '@prisma/client';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByApolloId(dto: UpsertCompanyDto): Promise<Company> {
    if (dto.apolloId) {
      return this.prisma.company.upsert({
        where: { apolloId: dto.apolloId },
        update: {
          name: dto.name,
          website: dto.website,
          industry: dto.industry,
          teamSize: dto.teamSize,
          fundingStage: dto.fundingStage,
          fundingAmount: dto.fundingAmount,
          techStack: dto.techStack ?? [],
          location: dto.location,
        },
        create: {
          tenantId: dto.tenantId,
          apolloId: dto.apolloId,
          name: dto.name,
          website: dto.website,
          industry: dto.industry,
          teamSize: dto.teamSize,
          fundingStage: dto.fundingStage,
          fundingAmount: dto.fundingAmount,
          techStack: dto.techStack ?? [],
          location: dto.location,
        },
      });
    }

    return this.prisma.company.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        website: dto.website,
        industry: dto.industry,
        teamSize: dto.teamSize,
        fundingStage: dto.fundingStage,
        fundingAmount: dto.fundingAmount,
        techStack: dto.techStack ?? [],
        location: dto.location,
      },
    });
  }

  async findByTenantId(tenantId: string): Promise<Company[]> {
    return this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
