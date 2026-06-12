import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { OutreachModule } from '../outreach/outreach.module';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.FOLLOWUP }),
    OutreachModule,
    LeadsModule,
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}
