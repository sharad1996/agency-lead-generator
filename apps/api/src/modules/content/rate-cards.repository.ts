import { Injectable } from '@nestjs/common';
import { RateCard } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertRateCardDto {
  tenantId: string;
  role: string;
  seniorityLevel: string;
  monthlyRate: number;
  hourlyRate: number;
  currency?: string;
}

@Injectable()
export class RateCardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<RateCard[]> {
    return this.prisma.rateCard.findMany({
      where: { tenantId },
      orderBy: [{ role: 'asc' }, { seniorityLevel: 'asc' }],
    });
  }

  async upsert(dto: UpsertRateCardDto): Promise<RateCard> {
    return this.prisma.rateCard.upsert({
      where: {
        tenantId_role_seniorityLevel: {
          tenantId: dto.tenantId,
          role: dto.role,
          seniorityLevel: dto.seniorityLevel,
        },
      },
      update: { monthlyRate: dto.monthlyRate, hourlyRate: dto.hourlyRate, currency: dto.currency ?? 'USD' },
      create: {
        tenantId: dto.tenantId,
        role: dto.role,
        seniorityLevel: dto.seniorityLevel,
        monthlyRate: dto.monthlyRate,
        hourlyRate: dto.hourlyRate,
        currency: dto.currency ?? 'USD',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.rateCard.delete({ where: { id } });
  }
}
