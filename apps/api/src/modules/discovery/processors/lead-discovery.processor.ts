import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '../discovery.service';
import { QUEUES } from '../../../queue/queue.constants';

interface DiscoveryJobData {
  limit: number;
}

@Processor(QUEUES.LEAD_DISCOVERY)
export class LeadDiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadDiscoveryProcessor.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<DiscoveryJobData>): Promise<void> {
    const tenantId = this.config.get<string>('ORG_ID')!;
    const limit = job.data.limit ?? 50;

    this.logger.log(`Processing discovery job ${job.id}: limit=${limit}`);
    const result = await this.discoveryService.runDiscovery({ limit, tenantId });
    this.logger.log(`Discovery job ${job.id} complete: ${result.discovered} leads`);
  }
}
