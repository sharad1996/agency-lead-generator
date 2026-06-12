import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { RateCardsRepository } from './rate-cards.repository';
import type { UpsertRateCardDto } from './rate-cards.repository';

@Controller('rate-cards')
export class RateCardsController {
  constructor(private readonly repo: RateCardsRepository) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.repo.findAll(tenantId);
  }

  @Post()
  upsert(@Body() body: UpsertRateCardDto) {
    return this.repo.upsert(body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.repo.delete(id);
  }
}
