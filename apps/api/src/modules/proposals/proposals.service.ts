import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseStudiesRepository } from '../content/case-studies.repository';
import { RateCardsRepository } from '../content/rate-cards.repository';
import { ProposalsRepository } from './proposals.repository';
import { buildProposalPrompt, ProposalContent } from './prompts/proposal.prompt';
import { Proposal } from '@prisma/client';

export interface GenerateProposalInput {
  opportunityId: string;
  projectDescription: string;
  techStackNeeded: string[];
  durationMonths: number;
  teamSize: number;
  seniorityMix: 'senior' | 'mixed' | 'junior';
}

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseStudiesRepo: CaseStudiesRepository,
    private readonly rateCardsRepo: RateCardsRepository,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') });
  }

  async generateProposal(input: GenerateProposalInput): Promise<Proposal> {
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: input.opportunityId },
      include: {
        lead: {
          include: {
            contact: { select: { firstName: true, lastName: true } },
            company: { select: { name: true, industry: true, techStack: true } },
          },
        },
      },
    });

    if (!opportunity) throw new NotFoundException(`Opportunity ${input.opportunityId} not found`);

    const { lead } = opportunity;
    if (!lead.contact || !lead.company) {
      throw new NotFoundException(`Lead is missing contact or company data`);
    }

    const [caseStudies, rateCards] = await Promise.all([
      this.caseStudiesRepo.findRelevant(opportunity.tenantId, {
        industry: lead.company.industry,
        techStack: input.techStackNeeded,
      }),
      this.rateCardsRepo.findAll(opportunity.tenantId),
    ]);

    const prompt = buildProposalPrompt({
      clientName: `${lead.contact.firstName} ${lead.contact.lastName}`,
      companyName: lead.company.name,
      industry: lead.company.industry,
      projectDescription: input.projectDescription,
      techStackNeeded: input.techStackNeeded,
      durationMonths: input.durationMonths,
      teamSize: input.teamSize,
      seniorityMix: input.seniorityMix,
      caseStudies,
      rateCards,
    });

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '';
    const content = this.parseContent(text);

    const title = `Proposal for ${lead.company.name} — ${input.projectDescription.slice(0, 60)}`;
    return this.proposalsRepo.create({
      tenantId: opportunity.tenantId,
      opportunityId: input.opportunityId,
      title,
      content,
    });
  }

  private parseContent(text: string): ProposalContent {
    try {
      const parsed = JSON.parse(text) as ProposalContent;
      const required: (keyof ProposalContent)[] = [
        'executiveSummary', 'proposedSolution', 'techStack',
        'timeline', 'teamComposition', 'investment', 'whyUs',
      ];
      if (required.some((k) => !parsed[k])) throw new Error('missing fields');
      return parsed;
    } catch (err: unknown) {
      this.logger.error(`Invalid proposal generation response: ${text.slice(0, 200)}`, (err as Error).stack);
      throw new Error('Invalid proposal generation response');
    }
  }
}
