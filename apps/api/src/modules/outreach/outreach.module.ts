import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OutreachRepository } from './outreach.repository';
import { OutreachService } from './outreach.service';
import { SendGridService } from './sendgrid.service';
import { SequenceService } from './sequence.service';
import { LeadOutreachProcessor } from './processors/lead-outreach.processor';
import { LeadFollowupProcessor } from './processors/lead-followup.processor';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.OUTREACH },
      { name: QUEUES.FOLLOWUP },
    ),
    LeadsModule,
  ],
  providers: [
    OutreachRepository,
    OutreachService,
    SendGridService,
    SequenceService,
    LeadOutreachProcessor,
    LeadFollowupProcessor,
  ],
  exports: [OutreachRepository, SendGridService],
})
export class OutreachModule {}
