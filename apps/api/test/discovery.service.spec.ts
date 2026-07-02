import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '../src/modules/discovery/discovery.service';
import { CompaniesService } from '../src/modules/companies/companies.service';
import { ContactsService } from '../src/modules/contacts/contacts.service';
import { LeadsService } from '../src/modules/leads/leads.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../src/queue/queue.constants';
import { ApolloAdapter } from '../src/modules/discovery/adapters/apollo.adapter';
import { PeopleDataLabsAdapter } from '../src/modules/discovery/adapters/peopledatalabs.adapter';
import { CsvAdapter } from '../src/modules/discovery/adapters/csv.adapter';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let apolloAdapter: { searchLeads: jest.Mock };
  let peopleDataLabsAdapter: { searchLeads: jest.Mock };
  let csvAdapter: { parseBuffer: jest.Mock };
  let companiesService: { upsert: jest.Mock };
  let contactsService: { upsert: jest.Mock };
  let leadsService: { create: jest.Mock; countCreatedToday: jest.Mock };
  let scoringQueue: { add: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    apolloAdapter = { searchLeads: jest.fn() };
    peopleDataLabsAdapter = { searchLeads: jest.fn() };
    csvAdapter = { parseBuffer: jest.fn() };
    companiesService = { upsert: jest.fn() };
    contactsService = { upsert: jest.fn() };
    leadsService = { create: jest.fn(), countCreatedToday: jest.fn() };
    scoringQueue = { add: jest.fn() };
    configService = { get: jest.fn().mockImplementation((_, fallback) => fallback) };

    const module = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: ApolloAdapter, useValue: apolloAdapter },
        { provide: PeopleDataLabsAdapter, useValue: peopleDataLabsAdapter },
        { provide: CsvAdapter, useValue: csvAdapter },
        { provide: CompaniesService, useValue: companiesService },
        { provide: ContactsService, useValue: contactsService },
        { provide: LeadsService, useValue: leadsService },
        { provide: ConfigService, useValue: configService },
        { provide: getQueueToken(QUEUES.LEAD_SCORING), useValue: scoringQueue },
      ],
    }).compile();

    service = module.get(DiscoveryService);
  });

  it('discovers leads and enqueues scoring for each', async () => {
    leadsService.countCreatedToday.mockResolvedValue(0);
    apolloAdapter.searchLeads.mockResolvedValue([
      {
        source: 'apollo',
        contact: { apolloId: 'p1', firstName: 'Jane', lastName: 'Doe', title: 'CTO' },
        company: { apolloId: 'o1', name: 'Acme', techStack: ['React'] },
      },
    ]);
    companiesService.upsert.mockResolvedValue({ id: 'company-1' });
    contactsService.upsert.mockResolvedValue({ id: 'contact-1' });
    leadsService.create.mockResolvedValue({ id: 'lead-1' });

    const result = await service.runDiscovery({ limit: 10, tenantId: 'org-1' });

    expect(result.discovered).toBe(1);
    expect(scoringQueue.add).toHaveBeenCalledWith(
      'score-lead',
      { leadId: 'lead-1' },
      expect.any(Object),
    );
  });

  it('enforces daily limit — skips if 50 leads already created today', async () => {
    leadsService.countCreatedToday.mockResolvedValue(50);

    await expect(service.runDiscovery({ limit: 10, tenantId: 'org-1' }))
      .rejects.toThrow('Daily limit reached (50/50). Skipping discovery.');
    expect(apolloAdapter.searchLeads).not.toHaveBeenCalled();
  });

  it('uses a configurable daily limit from config', async () => {
    configService.get.mockReturnValue(5);
    leadsService.countCreatedToday.mockResolvedValue(5);

    await expect(service.runDiscovery({ limit: 10, tenantId: 'org-1' }))
      .rejects.toThrow('Daily limit reached (5/5). Skipping discovery.');
    expect(apolloAdapter.searchLeads).not.toHaveBeenCalled();
  });

  it('discovers leads from PeopleDataLabs and enqueues scoring', async () => {
    leadsService.countCreatedToday.mockResolvedValue(0);
    peopleDataLabsAdapter.searchLeads.mockResolvedValue([
      {
        source: 'peopledatalabs',
        contact: { firstName: 'Alice', lastName: 'Ng', email: 'alice@company.com' },
        company: { name: 'Company X', techStack: ['Next.js'] },
      },
    ]);
    companiesService.upsert.mockResolvedValue({ id: 'company-3' });
    contactsService.upsert.mockResolvedValue({ id: 'contact-3' });
    leadsService.create.mockResolvedValue({ id: 'lead-3' });

    const result = await service.runPeopleDataLabsDiscovery({ limit: 10, tenantId: 'org-1' });

    expect(result.discovered).toBe(1);
    expect(scoringQueue.add).toHaveBeenCalledWith(
      'score-lead',
      { leadId: 'lead-3' },
      expect.any(Object),
    );
  });

  it('imports from CSV and enqueues scoring', async () => {
    csvAdapter.parseBuffer.mockResolvedValue([
      {
        source: 'csv',
        contact: { firstName: 'Bob', lastName: 'Smith', email: 'bob@startup.io' },
        company: { name: 'Startup IO', techStack: ['Node.js'] },
      },
    ]);
    companiesService.upsert.mockResolvedValue({ id: 'company-2' });
    contactsService.upsert.mockResolvedValue({ id: 'contact-2' });
    leadsService.create.mockResolvedValue({ id: 'lead-2' });

    const result = await service.importFromCsv(
      Buffer.from('csv content'),
      'org-1',
    );

    expect(result.imported).toBe(1);
    expect(scoringQueue.add).toHaveBeenCalledWith(
      'score-lead',
      { leadId: 'lead-2' },
      expect.any(Object),
    );
  });
});
