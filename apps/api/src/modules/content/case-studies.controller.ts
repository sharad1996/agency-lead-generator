import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { CaseStudiesRepository } from './case-studies.repository';
import type { CreateCaseStudyDto } from './case-studies.repository';

@Controller('case-studies')
export class CaseStudiesController {
  constructor(private readonly repo: CaseStudiesRepository) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.repo.findAll(tenantId);
  }

  @Post()
  create(@Body() body: CreateCaseStudyDto) {
    return this.repo.create(body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.repo.delete(id);
  }
}
