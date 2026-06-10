import { Injectable } from '@nestjs/common';
import { CompaniesRepository } from './companies.repository';
import { UpsertCompanyDto } from './dto/upsert-company.dto';
import { Company } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly repo: CompaniesRepository) {}

  upsert(dto: UpsertCompanyDto): Promise<Company> {
    return this.repo.upsertByApolloId(dto);
  }

  findAll(tenantId: string): Promise<Company[]> {
    return this.repo.findByTenantId(tenantId);
  }
}
