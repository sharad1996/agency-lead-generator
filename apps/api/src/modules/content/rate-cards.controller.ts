import { Controller, Get, Post, Delete, Body, Param, Query, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { RateCardsRepository } from './rate-cards.repository';
import type { UpsertRateCardDto } from './rate-cards.repository';

@Controller('rate-cards')
export class RateCardsController {
  constructor(private readonly repo: RateCardsRepository) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.repo.findAll(tenantId);
  }

  @Post()
  upsert(@Body() body: UpsertRateCardDto) {
    return this.repo.upsert(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.repo.delete(id);
  }
}
