import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { ApolloAdapter } from './adapters/apollo.adapter';
import { CsvAdapter } from './adapters/csv.adapter';
import { QUEUES } from '../../queue/queue.constants';
import { RawLead } from './adapters/lead-source.adapter';
import { Prisma } from '@prisma/client';

const DAILY_LEAD_LIMIT = 50;

export interface RunDiscoveryOptions {
  limit: number;
  tenantId: string;
}

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly apolloAdapter: ApolloAdapter,
    private readonly csvAdapter: CsvAdapter,
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly leadsService: LeadsService,
    @InjectQueue(QUEUES.LEAD_SCORING) private readonly scoringQueue: Queue,
  ) {}

  async runDiscovery(options: RunDiscoveryOptions): Promise<{ discovered: number }> {
    const todayCount = await this.leadsService.countCreatedToday();
    if (todayCount >= DAILY_LEAD_LIMIT) {
      this.logger.warn(`Daily limit reached (${todayCount}/${DAILY_LEAD_LIMIT}). Skipping discovery.`);
      return { discovered: 0 };
    }

    const remaining = DAILY_LEAD_LIMIT - todayCount;
    const effectiveLimit = Math.min(options.limit, remaining);

    this.logger.log(`Starting discovery: limit=${effectiveLimit} (${todayCount} created today)`);

    const rawLeads = await this.apolloAdapter.searchLeads({ limit: effectiveLimit });
    let discovered = 0;

    for (const raw of rawLeads) {
      try {
        await this.saveAndEnqueue(raw, options.tenantId);
        discovered++;
      } catch (err) {
        this.logger.error(`Failed to save lead ${raw.contact.email ?? raw.contact.firstName}: ${err}`);
      }
    }

    this.logger.log(`Discovery complete: ${discovered} leads saved`);
    return { discovered };
  }

  async importFromCsv(buffer: Buffer, tenantId: string): Promise<{ imported: number }> {
    const rawLeads = await this.csvAdapter.parseBuffer(buffer);
    let imported = 0;

    for (const raw of rawLeads) {
      try {
        await this.saveAndEnqueue(raw, tenantId);
        imported++;
      } catch (err) {
        this.logger.error(`CSV import failed for ${raw.contact.email}: ${err}`);
      }
    }

    return { imported };
  }

  private async saveAndEnqueue(raw: RawLead, tenantId: string): Promise<void> {
    const company = await this.companiesService.upsert({
      tenantId,
      ...raw.company,
    });

    const contact = await this.contactsService.upsert({
      tenantId,
      companyId: company.id,
      ...raw.contact,
    });

    const lead = await this.leadsService.create({
      contactId: contact.id,
      companyId: company.id,
      source: raw.source,
      hiringSignals: raw.hiringSignals as Prisma.InputJsonValue,
    });

    await this.scoringQueue.add(
      'score-lead',
      { leadId: lead.id },
      { priority: 1 },
    );
  }
}
