import { Test } from '@nestjs/testing';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { LeadStatus, Priority } from '@prisma/client';

describe('LeadsRepository', () => {
  let repo: LeadsRepository;
  let prisma: { lead: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      lead: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        LeadsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repo = module.get(LeadsRepository);
  });

  it('creates a lead with NEW status', async () => {
    const mockLead = {
      id: 'lead-1',
      tenantId: 'org-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      status: LeadStatus.NEW,
      score: null,
      priority: null,
      source: 'apollo',
    };
    prisma.lead.create.mockResolvedValue(mockLead);

    const result = await repo.create({
      tenantId: 'org-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      source: 'apollo',
    });

    expect(result.status).toBe(LeadStatus.NEW);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'org-1',
        status: LeadStatus.NEW,
      }),
    });
  });

  it('filters leads by priority', async () => {
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.count.mockResolvedValue(0);

    await repo.findAll({ tenantId: 'org-1', priority: Priority.HOT, page: 1, limit: 20 });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priority: Priority.HOT }),
      }),
    );
  });

  it('updates lead score and sets status to SCORED', async () => {
    const mockUpdated = { id: 'lead-1', score: 85, priority: Priority.HOT, status: LeadStatus.SCORED };
    prisma.lead.update.mockResolvedValue(mockUpdated);

    const result = await repo.updateScore({
      id: 'lead-1',
      score: 85,
      priority: Priority.HOT,
      scoreReasons: ['Hiring React devs', 'Series A funded'],
    });

    expect(result.score).toBe(85);
    expect(result.status).toBe(LeadStatus.SCORED);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: expect.objectContaining({
        score: 85,
        status: LeadStatus.SCORED,
      }),
    });
  });
});
