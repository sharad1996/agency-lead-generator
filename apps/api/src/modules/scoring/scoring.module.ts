import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScoringService } from './scoring.service';
import { LeadScoringProcessor } from './processors/lead-scoring.processor';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.LEAD_SCORING },
      { name: QUEUES.OUTREACH },
    ),
    LeadsModule,
  ],
  providers: [ScoringService, LeadScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
