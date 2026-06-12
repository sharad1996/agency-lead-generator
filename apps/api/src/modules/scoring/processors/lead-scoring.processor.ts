import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadsRepository } from '../../leads/leads.repository';
import { ScoringService } from '../scoring.service';
import { QUEUES } from '../../../queue/queue.constants';
import { LeadScoringInput } from '../prompts/scoring.prompt';

interface ScoringJobData {
  leadId: string;
}

@Processor(QUEUES.LEAD_SCORING)
export class LeadScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadScoringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsRepo: LeadsRepository,
    private readonly scoringService: ScoringService,
    @InjectQueue(QUEUES.OUTREACH) private readonly outreachQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ScoringJobData>): Promise<void> {
    const { leadId } = job.data;

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, company: true },
    });

    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found — skipping scoring`);
      return;
    }

    await this.leadsRepo.updateStatus(leadId, 'SCORING');

    const input: LeadScoringInput = {
      companyName: lead.company.name,
      industry: lead.company.industry ?? undefined,
      location: lead.company.location ?? undefined,
      teamSize: lead.company.teamSize ?? undefined,
      fundingStage: lead.company.fundingStage ?? undefined,
      fundingAmount: lead.company.fundingAmount ?? undefined,
      techStack: lead.company.techStack,
      hiringSignals: (lead.hiringSignals as Record<string, unknown>) ?? {},
      contactTitle: lead.contact.title ?? undefined,
    };

    const result = await this.scoringService.scoreLead(input);

    await this.leadsRepo.updateScore({
      id: leadId,
      score: result.score,
      priority: result.priority,
      scoreReasons: result.reasons,
    });

    await this.outreachQueue.add('create-sequence', { leadId });
    this.logger.log(`Lead ${leadId} scored — enqueued for outreach`);
  }
}
