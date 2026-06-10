import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadsRepository, CreateLeadDto } from './leads.repository';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { Lead } from '@prisma/client';

@Injectable()
export class LeadsService {
  private readonly tenantId: string;

  constructor(
    private readonly repo: LeadsRepository,
    private readonly config: ConfigService,
  ) {
    this.tenantId = this.config.get<string>('ORG_ID')!;
  }

  create(dto: Omit<CreateLeadDto, 'tenantId'>): Promise<Lead> {
    return this.repo.create({ ...dto, tenantId: this.tenantId });
  }

  findAll(filters: LeadFiltersDto) {
    return this.repo.findAll({ ...filters, tenantId: this.tenantId });
  }

  async findById(id: string): Promise<Lead> {
    const lead = await this.repo.findById(id, this.tenantId);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  countCreatedToday(): Promise<number> {
    return this.repo.countCreatedToday(this.tenantId);
  }
}
