import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { CaseStudiesRepository } from './case-studies.repository';
import type { CreateCaseStudyDto } from './case-studies.repository';

@Controller('case-studies')
export class CaseStudiesController {
  constructor(private readonly repo: CaseStudiesRepository) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.repo.findAll(tenantId);
  }

  @Post()
  create(@Body() body: CreateCaseStudyDto) {
    return this.repo.create(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.repo.delete(id);
  }
}
