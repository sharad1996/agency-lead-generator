import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.LEAD_DISCOVERY },
      { name: QUEUES.LEAD_SCORING },
      { name: QUEUES.OUTREACH },
      { name: QUEUES.FOLLOWUP },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
