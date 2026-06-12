import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { ProposalsRepository } from './proposals.repository';
import { PdfService } from './pdf.service';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [ContentModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalsRepository, PdfService],
  exports: [ProposalsRepository],
})
export class ProposalsModule {}
