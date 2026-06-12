import { Module } from '@nestjs/common';
import { CaseStudiesController } from './case-studies.controller';
import { RateCardsController } from './rate-cards.controller';
import { CaseStudiesRepository } from './case-studies.repository';
import { RateCardsRepository } from './rate-cards.repository';

@Module({
  controllers: [CaseStudiesController, RateCardsController],
  providers: [CaseStudiesRepository, RateCardsRepository],
  exports: [CaseStudiesRepository, RateCardsRepository],
})
export class ContentModule {}
