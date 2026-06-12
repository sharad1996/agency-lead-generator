# Phase 3: Meeting Booking, Proposal Generator, Content Admin, Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Cal.com meeting booking via webhook, AI proposal generation (Claude Haiku + Puppeteer PDF), case study/rate card CRUD admin, and a metrics dashboard.

**Architecture:** Cal.com fires a webhook on booking → MeetingsService creates a Meeting + Opportunity row and moves lead to MEETING_BOOKED. Proposals are created via a form: ProposalService fetches context (opportunity, case studies, rate cards), calls Claude Haiku to generate structured JSON content, and persists it; PDF is rendered on-demand via Puppeteer at request time (no blob storage). CaseStudy and RateCard are admin-managed content used as proposal context. Dashboard aggregates read-only metrics across all models.

**Tech Stack:** NestJS 11, Prisma 7, @anthropic-ai/sdk (Claude Haiku 4.5), puppeteer, Next.js 14 App Router, Tailwind CSS, ShadCN UI

---

## File Map

**New API files:**
- `apps/api/src/modules/meetings/meetings.module.ts`
- `apps/api/src/modules/meetings/meetings.repository.ts`
- `apps/api/src/modules/meetings/meetings.service.ts`
- `apps/api/src/modules/meetings/meetings.controller.ts`
- `apps/api/src/modules/content/content.module.ts`
- `apps/api/src/modules/content/case-studies.repository.ts`
- `apps/api/src/modules/content/rate-cards.repository.ts`
- `apps/api/src/modules/content/case-studies.controller.ts`
- `apps/api/src/modules/content/rate-cards.controller.ts`
- `apps/api/src/modules/proposals/proposals.module.ts`
- `apps/api/src/modules/proposals/proposals.repository.ts`
- `apps/api/src/modules/proposals/proposals.service.ts`
- `apps/api/src/modules/proposals/proposals.controller.ts`
- `apps/api/src/modules/proposals/pdf.service.ts`
- `apps/api/src/modules/proposals/prompts/proposal.prompt.ts`
- `apps/api/src/modules/proposals/dto/create-proposal.dto.ts`
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts`

**New test files:**
- `apps/api/test/meetings.service.spec.ts`
- `apps/api/test/case-studies.repository.spec.ts`
- `apps/api/test/rate-cards.repository.spec.ts`
- `apps/api/test/proposals.service.spec.ts`
- `apps/api/test/pdf.service.spec.ts`
- `apps/api/test/dashboard.service.spec.ts`

**Modified API files:**
- `apps/api/src/config/config.module.ts` — add `CAL_COM_WEBHOOK_SECRET` (optional)
- `apps/api/src/app.module.ts` — import MeetingsModule, ContentModule, ProposalsModule, DashboardModule
- `apps/api/.env.example` — add new vars

**New Web files:**
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/content/page.tsx`
- `apps/web/src/app/content/actions.ts`
- `apps/web/src/app/proposals/page.tsx`
- `apps/web/src/app/proposals/new/page.tsx`
- `apps/web/src/app/proposals/actions.ts`

**Modified Web files:**
- `apps/web/src/lib/api-client.ts` — add meeting/proposal/content/dashboard API calls
- `apps/web/src/app/layout.tsx` — add Dashboard, Content, Proposals nav links

---

## Task 1: Install puppeteer and update config

**Files:**
- Modify: `apps/api/src/config/config.module.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Install puppeteer**

```bash
cd apps/api && npm install puppeteer
```

Expected: puppeteer added to `apps/api/package.json` dependencies.

- [ ] **Step 2: Add CAL_COM_WEBHOOK_SECRET to config schema**

In `apps/api/src/config/config.module.ts`, add to the `Joi.object({...})`:

```typescript
CAL_COM_WEBHOOK_SECRET: Joi.string().optional(),
```

The full updated `validationSchema` object:
```typescript
validationSchema: Joi.object({
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  APOLLO_API_KEY: Joi.string().required(),
  OPENAI_API_KEY: Joi.string().required(),
  ANTHROPIC_API_KEY: Joi.string().required(),
  SENDGRID_API_KEY: Joi.string().required(),
  FROM_EMAIL: Joi.string().email().required(),
  FROM_NAME: Joi.string().required(),
  OUTREACH_DOMAIN: Joi.string().required(),
  SENDGRID_WEBHOOK_SECRET: Joi.string().optional(),
  CAL_COM_WEBHOOK_SECRET: Joi.string().optional(),
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  ORG_ID: Joi.string().uuid().required(),
  ORG_NAME: Joi.string().required(),
}),
```

- [ ] **Step 3: Update .env.example**

Add to `apps/api/.env.example`:
```
CAL_COM_WEBHOOK_SECRET=your_calcom_webhook_secret
```

- [ ] **Step 4: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config/config.module.ts apps/api/.env.example apps/api/package.json apps/api/package-lock.json
git commit -m "feat: install puppeteer and add CAL_COM_WEBHOOK_SECRET config"
```

---

## Task 2: MeetingsRepository

**Files:**
- Create: `apps/api/src/modules/meetings/meetings.repository.ts`
- Create: `apps/api/test/meetings.repository.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/meetings.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  meeting: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  opportunity: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

describe('MeetingsRepository', () => {
  let repo: MeetingsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(MeetingsRepository);
    jest.clearAllMocks();
  });

  describe('findOrCreateOpportunity', () => {
    it('returns existing opportunity when found', async () => {
      const existing = { id: 'opp-1', leadId: 'lead-1' };
      mockPrisma.opportunity.findFirst.mockResolvedValue(existing);

      const result = await repo.findOrCreateOpportunity('lead-1', 'org-1', 'Alice at TechStartup');

      expect(mockPrisma.opportunity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { leadId: 'lead-1', tenantId: 'org-1' } }),
      );
      expect(mockPrisma.opportunity.create).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('creates opportunity when none found', async () => {
      mockPrisma.opportunity.findFirst.mockResolvedValue(null);
      mockPrisma.opportunity.create.mockResolvedValue({ id: 'opp-new', leadId: 'lead-1' });

      const result = await repo.findOrCreateOpportunity('lead-1', 'org-1', 'Alice at TechStartup');

      expect(mockPrisma.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leadId: 'lead-1', tenantId: 'org-1', title: 'Alice at TechStartup' }),
        }),
      );
      expect(result.id).toBe('opp-new');
    });
  });

  describe('createMeeting', () => {
    it('creates a meeting record', async () => {
      const mtg = { id: 'mtg-1', leadId: 'lead-1' };
      mockPrisma.meeting.create.mockResolvedValue(mtg);

      const result = await repo.createMeeting({
        tenantId: 'org-1',
        leadId: 'lead-1',
        opportunityId: 'opp-1',
        calComEventId: 'uid-123',
        scheduledAt: new Date('2026-06-20T10:00:00Z'),
        durationMins: 30,
      });

      expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ calComEventId: 'uid-123', durationMins: 30 }),
        }),
      );
      expect(result).toEqual(mtg);
    });
  });

  describe('cancelMeeting', () => {
    it('updates meeting status to CANCELLED by calComEventId', async () => {
      mockPrisma.meeting.findUnique.mockResolvedValue({ id: 'mtg-1' });
      mockPrisma.meeting.update.mockResolvedValue({ id: 'mtg-1', status: 'CANCELLED' });

      await repo.cancelMeeting('uid-123');

      expect(mockPrisma.meeting.update).toHaveBeenCalledWith({
        where: { calComEventId: 'uid-123' },
        data: { status: 'CANCELLED' },
      });
    });
  });

  describe('countScheduled', () => {
    it('counts meetings with SCHEDULED status', async () => {
      mockPrisma.meeting.count.mockResolvedValue(5);
      const result = await repo.countScheduled('org-1');
      expect(result).toBe(5);
      expect(mockPrisma.meeting.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'org-1', status: 'SCHEDULED' }) }),
      );
    });
  });
});
```

Run: `cd apps/api && npx jest test/meetings.repository.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement MeetingsRepository**

```typescript
// apps/api/src/modules/meetings/meetings.repository.ts
import { Injectable } from '@nestjs/common';
import { Meeting, MeetingStatus, Opportunity, OpportunityStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateMeetingDto {
  tenantId: string;
  leadId: string;
  opportunityId: string;
  calComEventId: string;
  scheduledAt: Date;
  durationMins: number;
}

@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateOpportunity(leadId: string, tenantId: string, title: string): Promise<Opportunity> {
    const existing = await this.prisma.opportunity.findFirst({
      where: { leadId, tenantId },
    });
    if (existing) return existing;

    return this.prisma.opportunity.create({
      data: { tenantId, leadId, title, stage: OpportunityStage.DISCOVERY },
    });
  }

  async createMeeting(dto: CreateMeetingDto): Promise<Meeting> {
    return this.prisma.meeting.create({
      data: {
        tenantId: dto.tenantId,
        leadId: dto.leadId,
        opportunityId: dto.opportunityId,
        calComEventId: dto.calComEventId,
        scheduledAt: dto.scheduledAt,
        durationMins: dto.durationMins,
        status: MeetingStatus.SCHEDULED,
      },
    });
  }

  async cancelMeeting(calComEventId: string): Promise<void> {
    await this.prisma.meeting.update({
      where: { calComEventId },
      data: { status: MeetingStatus.CANCELLED },
    });
  }

  async countScheduled(tenantId: string): Promise<number> {
    return this.prisma.meeting.count({
      where: { tenantId, status: MeetingStatus.SCHEDULED },
    });
  }

  async countTotal(tenantId: string): Promise<number> {
    return this.prisma.meeting.count({ where: { tenantId } });
  }
}
```

Note: The `Meeting` model schema uses `calComEventId` but there is no unique constraint on it in the Prisma schema. Add a `@@unique([calComEventId])` to the schema or use `findFirst` in `cancelMeeting`. Update `cancelMeeting` to use `findFirst` then `update by id` to avoid schema migration:

```typescript
async cancelMeeting(calComEventId: string): Promise<void> {
  await this.prisma.meeting.updateMany({
    where: { calComEventId },
    data: { status: MeetingStatus.CANCELLED },
  });
}
```

Also update the test mock to use `updateMany` instead of `update`.

- [ ] **Step 3: Update test mock for cancelMeeting**

In the test file, change `mockPrisma.meeting.update` to `mockPrisma.meeting.updateMany`:

```typescript
const mockPrisma = {
  meeting: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  opportunity: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};
```

And update the `cancelMeeting` test:
```typescript
describe('cancelMeeting', () => {
  it('updates meeting status to CANCELLED by calComEventId', async () => {
    mockPrisma.meeting.updateMany.mockResolvedValue({ count: 1 });

    await repo.cancelMeeting('uid-123');

    expect(mockPrisma.meeting.updateMany).toHaveBeenCalledWith({
      where: { calComEventId: 'uid-123' },
      data: { status: 'CANCELLED' },
    });
  });
});
```

- [ ] **Step 4: Run tests — must pass**

Run: `cd apps/api && npx jest test/meetings.repository.spec.ts --no-coverage`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/meetings/meetings.repository.ts apps/api/test/meetings.repository.spec.ts
git commit -m "feat: add MeetingsRepository for Meeting and Opportunity CRUD"
```

---

## Task 3: MeetingsService

**Files:**
- Create: `apps/api/src/modules/meetings/meetings.service.ts`
- Create: `apps/api/test/meetings.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/meetings.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MeetingsService } from '../src/modules/meetings/meetings.service';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockMeetingsRepo = {
  findOrCreateOpportunity: jest.fn(),
  createMeeting: jest.fn(),
  cancelMeeting: jest.fn(),
};
const mockLeadsRepo = { updateStatus: jest.fn() };
const mockPrisma = {
  contact: {
    findFirst: jest.fn(),
  },
};
const configMock = { get: (k: string) => (k === 'ORG_ID' ? 'org-1' : undefined) };

const mockContact = {
  id: 'contact-1',
  email: 'alice@techstartup.io',
  firstName: 'Alice',
  lastName: 'Chen',
  tenantId: 'org-1',
  leads: [{ id: 'lead-1', tenantId: 'org-1' }],
  company: { name: 'TechStartup' },
};

describe('MeetingsService', () => {
  let service: MeetingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: MeetingsRepository, useValue: mockMeetingsRepo },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(MeetingsService);
    jest.clearAllMocks();
  });

  describe('handleBookingCreated', () => {
    it('creates meeting and moves lead to MEETING_BOOKED', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockMeetingsRepo.findOrCreateOpportunity.mockResolvedValue({ id: 'opp-1' });
      mockMeetingsRepo.createMeeting.mockResolvedValue({ id: 'mtg-1' });

      await service.handleBookingCreated({
        uid: 'uid-123',
        startTime: '2026-06-20T10:00:00Z',
        durationMins: 30,
        attendeeEmail: 'alice@techstartup.io',
        attendeeName: 'Alice Chen',
      });

      expect(mockMeetingsRepo.findOrCreateOpportunity).toHaveBeenCalledWith(
        'lead-1',
        'org-1',
        'Alice Chen at TechStartup',
      );
      expect(mockMeetingsRepo.createMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ calComEventId: 'uid-123', durationMins: 30, leadId: 'lead-1' }),
      );
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'MEETING_BOOKED');
    });

    it('skips gracefully when no contact found for email', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await service.handleBookingCreated({
        uid: 'uid-x',
        startTime: '2026-06-20T10:00:00Z',
        durationMins: 30,
        attendeeEmail: 'unknown@example.com',
        attendeeName: 'Unknown Person',
      });

      expect(mockMeetingsRepo.createMeeting).not.toHaveBeenCalled();
      expect(mockLeadsRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('skips when contact has no leads', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue({ ...mockContact, leads: [] });

      await service.handleBookingCreated({
        uid: 'uid-x',
        startTime: '2026-06-20T10:00:00Z',
        durationMins: 30,
        attendeeEmail: 'alice@techstartup.io',
        attendeeName: 'Alice Chen',
      });

      expect(mockMeetingsRepo.createMeeting).not.toHaveBeenCalled();
    });
  });

  describe('handleBookingCancelled', () => {
    it('cancels the meeting by calComEventId', async () => {
      mockMeetingsRepo.cancelMeeting.mockResolvedValue(undefined);

      await service.handleBookingCancelled('uid-123');

      expect(mockMeetingsRepo.cancelMeeting).toHaveBeenCalledWith('uid-123');
    });
  });
});
```

Run: `cd apps/api && npx jest test/meetings.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement MeetingsService**

```typescript
// apps/api/src/modules/meetings/meetings.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingsRepository } from './meetings.repository';
import { LeadsRepository } from '../leads/leads.repository';

export interface BookingCreatedInput {
  uid: string;
  startTime: string;
  durationMins: number;
  attendeeEmail: string;
  attendeeName: string;
}

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private readonly orgId: string;

  constructor(
    private readonly meetingsRepo: MeetingsRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.orgId = this.config.get<string>('ORG_ID')!;
  }

  async handleBookingCreated(input: BookingCreatedInput): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { email: input.attendeeEmail, tenantId: this.orgId },
      include: {
        leads: { orderBy: { createdAt: 'desc' }, take: 1 },
        company: { select: { name: true } },
      },
    });

    if (!contact) {
      this.logger.warn(`No contact found for ${input.attendeeEmail} — skipping meeting creation`);
      return;
    }

    const lead = contact.leads[0];
    if (!lead) {
      this.logger.warn(`Contact ${contact.id} has no leads — skipping meeting creation`);
      return;
    }

    const opportunityTitle = `${input.attendeeName} at ${contact.company.name}`;
    const opportunity = await this.meetingsRepo.findOrCreateOpportunity(lead.id, this.orgId, opportunityTitle);

    await this.meetingsRepo.createMeeting({
      tenantId: this.orgId,
      leadId: lead.id,
      opportunityId: opportunity.id,
      calComEventId: input.uid,
      scheduledAt: new Date(input.startTime),
      durationMins: input.durationMins,
    });

    await this.leadsRepo.updateStatus(lead.id, LeadStatus.MEETING_BOOKED);
    this.logger.log(`Meeting created for lead ${lead.id} — calComEventId=${input.uid}`);
  }

  async handleBookingCancelled(calComEventId: string): Promise<void> {
    await this.meetingsRepo.cancelMeeting(calComEventId);
    this.logger.log(`Meeting cancelled — calComEventId=${calComEventId}`);
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/meetings.service.spec.ts --no-coverage`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/meetings/meetings.service.ts apps/api/test/meetings.service.spec.ts
git commit -m "feat: add MeetingsService for Cal.com booking webhook handling"
```

---

## Task 4: MeetingsController + MeetingsModule

**Files:**
- Create: `apps/api/src/modules/meetings/meetings.controller.ts`
- Create: `apps/api/src/modules/meetings/meetings.module.ts`

- [ ] **Step 1: Create MeetingsController**

Cal.com sends `POST` to your endpoint with JSON body. The relevant fields in the Cal.com webhook payload are:

```
{
  "triggerEvent": "BOOKING_CREATED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED",
  "payload": {
    "uid": "booking-uid",
    "startTime": "2026-06-20T10:00:00Z",
    "length": 30,
    "attendees": [{ "email": "alice@example.com", "name": "Alice" }]
  }
}
```

```typescript
// apps/api/src/modules/meetings/meetings.controller.ts
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

@Controller('webhooks/calcom')
export class MeetingsController {
  private readonly logger = new Logger(MeetingsController.name);

  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  async handleCalComWebhook(@Body() body: Record<string, unknown>) {
    const triggerEvent = body['triggerEvent'] as string;
    const payload = body['payload'] as Record<string, unknown>;

    this.logger.log(`Cal.com webhook: ${triggerEvent}`);

    if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'BOOKING_RESCHEDULED') {
      const attendees = payload['attendees'] as Array<{ email: string; name: string }>;
      const attendee = attendees?.[0];
      if (!attendee) return { ok: true };

      await this.meetingsService.handleBookingCreated({
        uid: payload['uid'] as string,
        startTime: payload['startTime'] as string,
        durationMins: (payload['length'] as number) ?? 30,
        attendeeEmail: attendee.email,
        attendeeName: attendee.name,
      });
    }

    if (triggerEvent === 'BOOKING_CANCELLED') {
      await this.meetingsService.handleBookingCancelled(payload['uid'] as string);
    }

    return { ok: true };
  }
}
```

- [ ] **Step 2: Create MeetingsModule**

```typescript
// apps/api/src/modules/meetings/meetings.module.ts
import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsRepository } from './meetings.repository';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [LeadsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingsRepository],
})
export class MeetingsModule {}
```

- [ ] **Step 3: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/meetings/
git commit -m "feat: add MeetingsController and MeetingsModule for Cal.com webhook"
```

---

## Task 5: CaseStudiesRepository

**Files:**
- Create: `apps/api/src/modules/content/case-studies.repository.ts`
- Create: `apps/api/test/case-studies.repository.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/case-studies.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CaseStudiesRepository } from '../src/modules/content/case-studies.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  caseStudy: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockCaseStudy = {
  id: 'cs-1',
  tenantId: 'org-1',
  title: 'React dashboard for fintech',
  client: 'FinCo',
  industry: 'Fintech',
  techStack: ['React', 'TypeScript'],
  challenge: 'Legacy jQuery app',
  solution: 'Rewrote in React',
  result: '40% faster load time',
};

describe('CaseStudiesRepository', () => {
  let repo: CaseStudiesRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseStudiesRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(CaseStudiesRepository);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all case studies for tenant', async () => {
      mockPrisma.caseStudy.findMany.mockResolvedValue([mockCaseStudy]);
      const result = await repo.findAll('org-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.caseStudy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'org-1' } }),
      );
    });
  });

  describe('findRelevant', () => {
    it('filters by industry or tech stack', async () => {
      mockPrisma.caseStudy.findMany.mockResolvedValue([mockCaseStudy]);
      const result = await repo.findRelevant('org-1', { industry: 'Fintech', techStack: ['React'] });
      expect(result).toHaveLength(1);
      expect(mockPrisma.caseStudy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ industry: 'Fintech' }),
              expect.objectContaining({ techStack: expect.objectContaining({ hasSome: ['React'] }) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a case study', async () => {
      mockPrisma.caseStudy.create.mockResolvedValue(mockCaseStudy);
      const result = await repo.create({
        tenantId: 'org-1',
        title: 'React dashboard for fintech',
        client: 'FinCo',
        industry: 'Fintech',
        techStack: ['React', 'TypeScript'],
        challenge: 'Legacy jQuery app',
        solution: 'Rewrote in React',
        result: '40% faster load time',
      });
      expect(result.id).toBe('cs-1');
    });
  });

  describe('delete', () => {
    it('deletes a case study by id', async () => {
      mockPrisma.caseStudy.delete.mockResolvedValue(mockCaseStudy);
      await repo.delete('cs-1');
      expect(mockPrisma.caseStudy.delete).toHaveBeenCalledWith({ where: { id: 'cs-1' } });
    });
  });
});
```

Run: `cd apps/api && npx jest test/case-studies.repository.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement CaseStudiesRepository**

```typescript
// apps/api/src/modules/content/case-studies.repository.ts
import { Injectable } from '@nestjs/common';
import { CaseStudy } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateCaseStudyDto {
  tenantId: string;
  title: string;
  client: string;
  industry?: string;
  techStack: string[];
  challenge: string;
  solution: string;
  result: string;
}

export interface RelevantCaseStudyFilter {
  industry?: string | null;
  techStack?: string[];
}

@Injectable()
export class CaseStudiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<CaseStudy[]> {
    return this.prisma.caseStudy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRelevant(tenantId: string, filter: RelevantCaseStudyFilter): Promise<CaseStudy[]> {
    const orConditions: object[] = [];
    if (filter.industry) orConditions.push({ industry: filter.industry });
    if (filter.techStack?.length) orConditions.push({ techStack: { hasSome: filter.techStack } });

    return this.prisma.caseStudy.findMany({
      where: {
        tenantId,
        ...(orConditions.length ? { OR: orConditions } : {}),
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCaseStudyDto): Promise<CaseStudy> {
    return this.prisma.caseStudy.create({ data: dto });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.caseStudy.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/case-studies.repository.spec.ts --no-coverage`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/content/case-studies.repository.ts apps/api/test/case-studies.repository.spec.ts
git commit -m "feat: add CaseStudiesRepository"
```

---

## Task 6: RateCardsRepository

**Files:**
- Create: `apps/api/src/modules/content/rate-cards.repository.ts`
- Create: `apps/api/test/rate-cards.repository.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/rate-cards.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RateCardsRepository } from '../src/modules/content/rate-cards.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  rateCard: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

const mockRateCard = {
  id: 'rc-1',
  tenantId: 'org-1',
  role: 'Frontend Developer',
  seniorityLevel: 'Senior',
  monthlyRate: 8000,
  hourlyRate: 50,
  currency: 'USD',
};

describe('RateCardsRepository', () => {
  let repo: RateCardsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateCardsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(RateCardsRepository);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all rate cards for tenant', async () => {
      mockPrisma.rateCard.findMany.mockResolvedValue([mockRateCard]);
      const result = await repo.findAll('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('upsert', () => {
    it('creates or updates a rate card by role+seniority', async () => {
      mockPrisma.rateCard.upsert.mockResolvedValue(mockRateCard);
      const result = await repo.upsert({
        tenantId: 'org-1',
        role: 'Frontend Developer',
        seniorityLevel: 'Senior',
        monthlyRate: 8000,
        hourlyRate: 50,
        currency: 'USD',
      });
      expect(mockPrisma.rateCard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_role_seniorityLevel: { tenantId: 'org-1', role: 'Frontend Developer', seniorityLevel: 'Senior' } },
        }),
      );
      expect(result).toEqual(mockRateCard);
    });
  });

  describe('delete', () => {
    it('deletes a rate card by id', async () => {
      mockPrisma.rateCard.delete.mockResolvedValue(mockRateCard);
      await repo.delete('rc-1');
      expect(mockPrisma.rateCard.delete).toHaveBeenCalledWith({ where: { id: 'rc-1' } });
    });
  });
});
```

Run: `cd apps/api && npx jest test/rate-cards.repository.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement RateCardsRepository**

```typescript
// apps/api/src/modules/content/rate-cards.repository.ts
import { Injectable } from '@nestjs/common';
import { RateCard } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertRateCardDto {
  tenantId: string;
  role: string;
  seniorityLevel: string;
  monthlyRate: number;
  hourlyRate: number;
  currency?: string;
}

@Injectable()
export class RateCardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<RateCard[]> {
    return this.prisma.rateCard.findMany({
      where: { tenantId },
      orderBy: [{ role: 'asc' }, { seniorityLevel: 'asc' }],
    });
  }

  async upsert(dto: UpsertRateCardDto): Promise<RateCard> {
    return this.prisma.rateCard.upsert({
      where: {
        tenantId_role_seniorityLevel: {
          tenantId: dto.tenantId,
          role: dto.role,
          seniorityLevel: dto.seniorityLevel,
        },
      },
      update: { monthlyRate: dto.monthlyRate, hourlyRate: dto.hourlyRate, currency: dto.currency ?? 'USD' },
      create: {
        tenantId: dto.tenantId,
        role: dto.role,
        seniorityLevel: dto.seniorityLevel,
        monthlyRate: dto.monthlyRate,
        hourlyRate: dto.hourlyRate,
        currency: dto.currency ?? 'USD',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.rateCard.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/rate-cards.repository.spec.ts --no-coverage`
Expected: All 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/content/rate-cards.repository.ts apps/api/test/rate-cards.repository.spec.ts
git commit -m "feat: add RateCardsRepository"
```

---

## Task 7: ContentModule with controllers

**Files:**
- Create: `apps/api/src/modules/content/case-studies.controller.ts`
- Create: `apps/api/src/modules/content/rate-cards.controller.ts`
- Create: `apps/api/src/modules/content/content.module.ts`

- [ ] **Step 1: Create CaseStudiesController**

```typescript
// apps/api/src/modules/content/case-studies.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { CaseStudiesRepository, CreateCaseStudyDto } from './case-studies.repository';

@Controller('case-studies')
export class CaseStudiesController {
  constructor(private readonly repo: CaseStudiesRepository) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.repo.findAll(tenantId);
  }

  @Post()
  create(@Body() body: CreateCaseStudyDto) {
    return this.repo.create(body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.repo.delete(id);
  }
}
```

- [ ] **Step 2: Create RateCardsController**

```typescript
// apps/api/src/modules/content/rate-cards.controller.ts
import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { RateCardsRepository, UpsertRateCardDto } from './rate-cards.repository';

@Controller('rate-cards')
export class RateCardsController {
  constructor(private readonly repo: RateCardsRepository) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.repo.findAll(tenantId);
  }

  @Post()
  upsert(@Body() body: UpsertRateCardDto) {
    return this.repo.upsert(body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.repo.delete(id);
  }
}
```

- [ ] **Step 3: Create ContentModule**

```typescript
// apps/api/src/modules/content/content.module.ts
import { Module } from '@nestjs/common';
import { CaseStudiesController } from './case-studies.controller';
import { RateCardsController } from './rate-cards.controller';
import { CaseStudiesRepository } from './case-studies.repository';
import { RateCardsRepository } from './rate-cards.repository';

@Module({
  controllers: [CaseStudiesController, RateCardsController],
  providers: [CaseStudiesRepository, RateCardsRepository],
  exports: [CaseStudiesRepository, RateCardsRepository],
})
export class ContentModule {}
```

- [ ] **Step 4: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/content/
git commit -m "feat: add ContentModule with case studies and rate cards CRUD"
```

---

## Task 8: ProposalPrompt + ProposalService (Claude Haiku)

**Files:**
- Create: `apps/api/src/modules/proposals/prompts/proposal.prompt.ts`
- Create: `apps/api/src/modules/proposals/proposals.service.ts`
- Create: `apps/api/test/proposals.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/proposals.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProposalsService } from '../src/modules/proposals/proposals.service';
import { CaseStudiesRepository } from '../src/modules/content/case-studies.repository';
import { RateCardsRepository } from '../src/modules/content/rate-cards.repository';
import { ProposalsRepository } from '../src/modules/proposals/proposals.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

const mockCaseStudiesRepo = { findRelevant: jest.fn() };
const mockRateCardsRepo = { findAll: jest.fn() };
const mockProposalsRepo = { create: jest.fn() };
const mockPrisma = {
  opportunity: {
    findUnique: jest.fn(),
  },
};
const configMock = {
  get: (k: string) => {
    if (k === 'ANTHROPIC_API_KEY') return 'test-key';
    if (k === 'ORG_ID') return 'org-1';
    return undefined;
  },
};

const mockOpportunity = {
  id: 'opp-1',
  tenantId: 'org-1',
  lead: {
    contact: { firstName: 'Alice', lastName: 'Chen' },
    company: { name: 'TechStartup', industry: 'SaaS', techStack: ['React'] },
  },
};

const mockGeneratedContent = {
  executiveSummary: 'We help you ship fast.',
  proposedSolution: 'We build your React app.',
  techStack: ['React', 'NestJS'],
  timeline: '3 months in 6 sprints.',
  teamComposition: [{ role: 'Frontend Developer', seniority: 'Senior', count: 2, monthlyRate: 8000 }],
  investment: 'Total: $48,000 over 3 months.',
  whyUs: 'We are experts in React.',
  caseStudyHighlight: 'Built a fintech dashboard.',
};

describe('ProposalsService', () => {
  let service: ProposalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: CaseStudiesRepository, useValue: mockCaseStudiesRepo },
        { provide: RateCardsRepository, useValue: mockRateCardsRepo },
        { provide: ProposalsRepository, useValue: mockProposalsRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(ProposalsService);
    jest.clearAllMocks();
  });

  describe('generateProposal', () => {
    it('calls Claude Haiku and creates a Proposal record', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      mockCaseStudiesRepo.findRelevant.mockResolvedValue([]);
      mockRateCardsRepo.findAll.mockResolvedValue([
        { role: 'Frontend Developer', seniorityLevel: 'Senior', monthlyRate: 8000, hourlyRate: 50 },
      ]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockGeneratedContent) }],
      });
      mockProposalsRepo.create.mockResolvedValue({ id: 'prop-1', content: mockGeneratedContent });

      const result = await service.generateProposal({
        opportunityId: 'opp-1',
        projectDescription: 'Build a React dashboard',
        techStackNeeded: ['React', 'NestJS'],
        durationMonths: 3,
        teamSize: 2,
        seniorityMix: 'senior',
      });

      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
      );
      expect(mockProposalsRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('prop-1');
    });

    it('throws NotFoundException when opportunity not found', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(null);

      await expect(
        service.generateProposal({
          opportunityId: 'bad-id',
          projectDescription: 'x',
          techStackNeeded: [],
          durationMonths: 1,
          teamSize: 1,
          seniorityMix: 'mixed',
        }),
      ).rejects.toThrow('Opportunity bad-id not found');
    });

    it('throws when Claude returns invalid JSON', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      mockCaseStudiesRepo.findRelevant.mockResolvedValue([]);
      mockRateCardsRepo.findAll.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not json' }],
      });

      await expect(
        service.generateProposal({
          opportunityId: 'opp-1',
          projectDescription: 'x',
          techStackNeeded: [],
          durationMonths: 1,
          teamSize: 1,
          seniorityMix: 'mixed',
        }),
      ).rejects.toThrow('Invalid proposal generation response');
    });
  });
});
```

Run: `cd apps/api && npx jest test/proposals.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Create proposal prompt**

```typescript
// apps/api/src/modules/proposals/prompts/proposal.prompt.ts
import { CaseStudy, RateCard } from '@prisma/client';

export interface ProposalPromptInput {
  clientName: string;
  companyName: string;
  industry: string | null;
  projectDescription: string;
  techStackNeeded: string[];
  durationMonths: number;
  teamSize: number;
  seniorityMix: 'senior' | 'mixed' | 'junior';
  caseStudies: Pick<CaseStudy, 'title' | 'client' | 'industry' | 'techStack' | 'challenge' | 'solution' | 'result'>[];
  rateCards: Pick<RateCard, 'role' | 'seniorityLevel' | 'monthlyRate'>[];
}

export interface ProposalContent {
  executiveSummary: string;
  proposedSolution: string;
  techStack: string[];
  timeline: string;
  teamComposition: { role: string; seniority: string; count: number; monthlyRate: number }[];
  investment: string;
  whyUs: string;
  caseStudyHighlight: string | null;
}

export function buildProposalPrompt(input: ProposalPromptInput): string {
  const caseStudyContext = input.caseStudies.length
    ? `\nRelevant past projects:\n${input.caseStudies
        .map((cs) => `- "${cs.title}" for ${cs.client} (${cs.industry ?? 'unknown industry'}): ${cs.result}`)
        .join('\n')}`
    : '';

  const rateCardContext = input.rateCards.length
    ? `\nAvailable rates (USD/month):\n${input.rateCards
        .map((rc) => `- ${rc.role} (${rc.seniorityLevel}): $${rc.monthlyRate}`)
        .join('\n')}`
    : '';

  return `You are a senior solutions consultant at Conversion.io, an IT services company specialising in React, Next.js, Node.js, NestJS, and TypeScript.

Write a professional client proposal for:
- Client: ${input.clientName} at ${input.companyName}${input.industry ? ` (${input.industry})` : ''}
- Project: ${input.projectDescription}
- Tech stack needed: ${input.techStackNeeded.join(', ')}
- Duration: ${input.durationMonths} months
- Team size: ${input.teamSize} developers (${input.seniorityMix} seniority)
${caseStudyContext}
${rateCardContext}

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "executiveSummary": "2-3 sentence summary of the engagement",
  "proposedSolution": "3-4 sentences on technical approach",
  "techStack": ["React", "NestJS", "..."],
  "timeline": "Description of milestones and sprint breakdown",
  "teamComposition": [
    { "role": "Frontend Developer", "seniority": "Senior", "count": 2, "monthlyRate": 8000 }
  ],
  "investment": "Total investment breakdown and final amount",
  "whyUs": "2-3 sentences on why Conversion.io is the right partner",
  "caseStudyHighlight": "1-2 sentences referencing the most relevant past project, or null if none"
}`;
}
```

- [ ] **Step 3: Implement ProposalsService**

```typescript
// apps/api/src/modules/proposals/proposals.service.ts
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
      if (!parsed.executiveSummary || !parsed.proposedSolution) throw new Error('missing fields');
      return parsed;
    } catch {
      this.logger.error(`Invalid proposal generation response: ${text.slice(0, 200)}`);
      throw new Error('Invalid proposal generation response');
    }
  }
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `cd apps/api && npx jest test/proposals.service.spec.ts --no-coverage`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/proposals/prompts/ apps/api/src/modules/proposals/proposals.service.ts apps/api/test/proposals.service.spec.ts
git commit -m "feat: add ProposalsService with Claude Haiku proposal generation"
```

---

## Task 9: PdfService (Puppeteer)

**Files:**
- Create: `apps/api/src/modules/proposals/pdf.service.ts`
- Create: `apps/api/test/pdf.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/pdf.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from '../src/modules/proposals/pdf.service';

const mockPage = {
  setContent: jest.fn(),
  pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  close: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

import { ProposalContent } from '../src/modules/proposals/prompts/proposal.prompt';

const mockContent: ProposalContent = {
  executiveSummary: 'We help you ship fast.',
  proposedSolution: 'We build your React app.',
  techStack: ['React', 'NestJS'],
  timeline: '3 months.',
  teamComposition: [{ role: 'Frontend Developer', seniority: 'Senior', count: 2, monthlyRate: 8000 }],
  investment: 'Total: $48,000.',
  whyUs: 'We are experts.',
  caseStudyHighlight: null,
};

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();
    service = module.get(PdfService);
  });

  describe('generateProposalPdf', () => {
    it('launches puppeteer, sets HTML content, returns PDF buffer', async () => {
      const result = await service.generateProposalPdf('TechStartup Proposal', mockContent);

      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining('TechStartup Proposal'),
        expect.any(Object),
      );
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4' }));
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
```

Run: `cd apps/api && npx jest test/pdf.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement PdfService**

```typescript
// apps/api/src/modules/proposals/pdf.service.ts
import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { ProposalContent } from './prompts/proposal.prompt';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateProposalPdf(title: string, content: ProposalContent): Promise<Buffer> {
    const html = this.buildHtml(title, content);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' } });
      await page.close();
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private buildHtml(title: string, content: ProposalContent): string {
    const teamRows = content.teamComposition
      .map(
        (t) =>
          `<tr><td>${t.role}</td><td>${t.seniority}</td><td>${t.count}</td><td>$${t.monthlyRate.toLocaleString()}/mo</td></tr>`,
      )
      .join('');

    const techBadges = content.techStack.map((t) => `<span class="badge">${t}</span>`).join(' ');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; color: #1a1a2e; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; }
  h2 { font-size: 18px; color: #4f46e5; margin-top: 32px; }
  p { margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #4f46e5; color: white; padding: 10px 12px; text-align: left; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  .badge { background: #e0e7ff; color: #4f46e5; padding: 2px 10px; border-radius: 12px; font-size: 13px; display: inline-block; margin: 2px; }
  .meta { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
  .highlight { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Prepared by Conversion.io</p>

  <h2>Executive Summary</h2>
  <p>${content.executiveSummary}</p>

  <h2>Proposed Solution</h2>
  <p>${content.proposedSolution}</p>

  <h2>Technology Stack</h2>
  <p>${techBadges}</p>

  <h2>Timeline</h2>
  <p>${content.timeline}</p>

  <h2>Team Composition</h2>
  <table>
    <tr><th>Role</th><th>Seniority</th><th>Count</th><th>Rate</th></tr>
    ${teamRows}
  </table>

  <h2>Investment</h2>
  <p>${content.investment}</p>

  <h2>Why Conversion.io</h2>
  <p>${content.whyUs}</p>

  ${content.caseStudyHighlight ? `<div class="highlight"><strong>Past Work:</strong> ${content.caseStudyHighlight}</div>` : ''}
</body>
</html>`;
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/pdf.service.spec.ts --no-coverage`
Expected: All 1 test PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/proposals/pdf.service.ts apps/api/test/pdf.service.spec.ts
git commit -m "feat: add PdfService for Puppeteer HTML-to-PDF proposal rendering"
```

---

## Task 10: ProposalsRepository

**Files:**
- Create: `apps/api/src/modules/proposals/proposals.repository.ts`

- [ ] **Step 1: Implement ProposalsRepository**

No test file needed — this is a thin wrapper tested via the service mock. Add the file directly:

```typescript
// apps/api/src/modules/proposals/proposals.repository.ts
import { Injectable } from '@nestjs/common';
import { Proposal, ProposalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProposalContent } from './prompts/proposal.prompt';

export interface CreateProposalDto {
  tenantId: string;
  opportunityId: string;
  title: string;
  content: ProposalContent;
}

@Injectable()
export class ProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProposalDto): Promise<Proposal> {
    return this.prisma.proposal.create({
      data: {
        tenantId: dto.tenantId,
        opportunityId: dto.opportunityId,
        title: dto.title,
        content: dto.content as object,
        status: ProposalStatus.DRAFT,
      },
    });
  }

  async findAll(tenantId: string): Promise<Proposal[]> {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Proposal | null> {
    return this.prisma.proposal.findUnique({ where: { id } });
  }

  async markSent(id: string): Promise<Proposal> {
    return this.prisma.proposal.update({
      where: { id },
      data: { status: ProposalStatus.SENT, sentAt: new Date() },
    });
  }

  async countByStatus(tenantId: string): Promise<{ draft: number; sent: number }> {
    const [draft, sent] = await Promise.all([
      this.prisma.proposal.count({ where: { tenantId, status: ProposalStatus.DRAFT } }),
      this.prisma.proposal.count({ where: { tenantId, status: ProposalStatus.SENT } }),
    ]);
    return { draft, sent };
  }
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/proposals/proposals.repository.ts
git commit -m "feat: add ProposalsRepository"
```

---

## Task 11: ProposalsController + DTO + ProposalsModule

**Files:**
- Create: `apps/api/src/modules/proposals/dto/create-proposal.dto.ts`
- Create: `apps/api/src/modules/proposals/proposals.controller.ts`
- Create: `apps/api/src/modules/proposals/proposals.module.ts`

- [ ] **Step 1: Create DTO**

```typescript
// apps/api/src/modules/proposals/dto/create-proposal.dto.ts
import { IsString, IsArray, IsNumber, IsIn, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  opportunityId: string;

  @IsString()
  @IsNotEmpty()
  projectDescription: string;

  @IsArray()
  @IsString({ each: true })
  techStackNeeded: string[];

  @IsNumber()
  @Min(1)
  @Max(36)
  durationMonths: number;

  @IsNumber()
  @Min(1)
  teamSize: number;

  @IsIn(['senior', 'mixed', 'junior'])
  seniorityMix: 'senior' | 'mixed' | 'junior';
}
```

- [ ] **Step 2: Create ProposalsController**

```typescript
// apps/api/src/modules/proposals/proposals.controller.ts
import { Controller, Get, Post, Param, Query, Body, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { ProposalsService } from './proposals.service';
import { ProposalsRepository } from './proposals.repository';
import { PdfService } from './pdf.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { ProposalContent } from './prompts/proposal.prompt';

@Controller('proposals')
export class ProposalsController {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.proposalsRepo.findAll(tenantId);
  }

  @Post()
  create(@Body() dto: CreateProposalDto) {
    return this.proposalsService.generateProposal(dto);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const proposal = await this.proposalsRepo.findById(id);
    if (!proposal) throw new NotFoundException(`Proposal ${id} not found`);

    const pdfBuffer = await this.pdfService.generateProposalPdf(
      proposal.title,
      proposal.content as unknown as ProposalContent,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
```

- [ ] **Step 3: Create ProposalsModule**

```typescript
// apps/api/src/modules/proposals/proposals.module.ts
import { Module } from '@nestjs/common';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { ProposalsRepository } from './proposals.repository';
import { PdfService } from './pdf.service';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [ContentModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalsRepository, PdfService],
  exports: [ProposalsRepository],
})
export class ProposalsModule {}
```

- [ ] **Step 4: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/proposals/
git commit -m "feat: add ProposalsController, DTO, and ProposalsModule"
```

---

## Task 12: DashboardService + Controller + Module

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.module.ts`
- Create: `apps/api/test/dashboard.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/dashboard.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository';
import { ProposalsRepository } from '../src/modules/proposals/proposals.repository';

const mockPrisma = {
  lead: { count: jest.fn(), groupBy: jest.fn() },
  outreachStep: { count: jest.fn() },
};
const mockMeetingsRepo = { countScheduled: jest.fn(), countTotal: jest.fn() };
const mockProposalsRepo = { countByStatus: jest.fn() };

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MeetingsRepository, useValue: mockMeetingsRepo },
        { provide: ProposalsRepository, useValue: mockProposalsRepo },
      ],
    }).compile();
    service = module.get(DashboardService);
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('aggregates lead, email, meeting, and proposal counts', async () => {
      mockPrisma.lead.count
        .mockResolvedValueOnce(120)   // total leads
        .mockResolvedValueOnce(15)    // replied leads
        .mockResolvedValueOnce(80);   // outreach sent leads
      mockPrisma.lead.groupBy.mockResolvedValue([
        { status: 'NEW', _count: { status: 30 } },
        { status: 'OUTREACH_SENT', _count: { status: 50 } },
      ]);
      mockPrisma.outreachStep.count
        .mockResolvedValueOnce(25)   // sent today
        .mockResolvedValueOnce(120); // sent this week
      mockMeetingsRepo.countScheduled.mockResolvedValue(3);
      mockMeetingsRepo.countTotal.mockResolvedValue(12);
      mockProposalsRepo.countByStatus.mockResolvedValue({ draft: 2, sent: 5 });

      const result = await service.getMetrics('org-1');

      expect(result.leads.total).toBe(120);
      expect(result.leads.byStatus).toEqual({ NEW: 30, OUTREACH_SENT: 50 });
      expect(result.emails.sentToday).toBe(25);
      expect(result.emails.sentThisWeek).toBe(120);
      expect(result.emails.replyRate).toBeCloseTo(18.75);
      expect(result.meetings.scheduled).toBe(3);
      expect(result.meetings.total).toBe(12);
      expect(result.proposals.draft).toBe(2);
      expect(result.proposals.sent).toBe(5);
    });
  });
});
```

Run: `cd apps/api && npx jest test/dashboard.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement DashboardService**

```typescript
// apps/api/src/modules/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingsRepository } from '../meetings/meetings.repository';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { StepStatus } from '@prisma/client';

export interface DashboardMetrics {
  leads: { total: number; byStatus: Record<string, number> };
  emails: { sentToday: number; sentThisWeek: number; replyRate: number };
  meetings: { scheduled: number; total: number };
  proposals: { draft: number; sent: number };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meetingsRepo: MeetingsRepository,
    private readonly proposalsRepo: ProposalsRepository,
  ) {}

  async getMetrics(tenantId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalLeads,
      repliedLeads,
      outreachSentLeads,
      leadsByStatus,
      sentToday,
      sentThisWeek,
      meetingsScheduled,
      meetingsTotal,
      proposalCounts,
    ] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId, status: 'REPLIED' } }),
      this.prisma.lead.count({ where: { tenantId, status: { in: ['OUTREACH_SENT', 'REPLIED', 'MEETING_BOOKED', 'PROPOSAL_SENT', 'CONVERTED'] } } }),
      this.prisma.lead.groupBy({ by: ['status'], where: { tenantId }, _count: { status: true } }),
      this.prisma.outreachStep.count({ where: { tenantId, status: StepStatus.SENT, sentAt: { gte: startOfToday } } }),
      this.prisma.outreachStep.count({ where: { tenantId, status: StepStatus.SENT, sentAt: { gte: startOfWeek } } }),
      this.meetingsRepo.countScheduled(tenantId),
      this.meetingsRepo.countTotal(tenantId),
      this.proposalsRepo.countByStatus(tenantId),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of leadsByStatus) {
      byStatus[row.status] = row._count.status;
    }

    const replyRate = outreachSentLeads > 0 ? (repliedLeads / outreachSentLeads) * 100 : 0;

    return {
      leads: { total: totalLeads, byStatus },
      emails: { sentToday, sentThisWeek, replyRate },
      meetings: { scheduled: meetingsScheduled, total: meetingsTotal },
      proposals: proposalCounts,
    };
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/dashboard.service.spec.ts --no-coverage`
Expected: All 1 test PASS

- [ ] **Step 4: Create DashboardController**

```typescript
// apps/api/src/modules/dashboard/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(@Query('tenantId') tenantId: string) {
    return this.dashboardService.getMetrics(tenantId);
  }
}
```

- [ ] **Step 5: Create DashboardModule**

```typescript
// apps/api/src/modules/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MeetingsModule } from '../meetings/meetings.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [MeetingsModule, ProposalsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

Update `MeetingsModule` to export `MeetingsRepository`:
```typescript
// apps/api/src/modules/meetings/meetings.module.ts — add exports
exports: [MeetingsRepository],
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/dashboard/ apps/api/test/dashboard.service.spec.ts
git commit -m "feat: add DashboardService and DashboardModule with metrics endpoint"
```

---

## Task 13: Wire all modules to AppModule and run full suite

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Update AppModule**

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { LeadsModule } from './modules/leads/leads.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { ContentModule } from './modules/content/content.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    DiscoveryModule,
    ScoringModule,
    OutreachModule,
    ApprovalModule,
    WebhooksModule,
    MeetingsModule,
    ContentModule,
    ProposalsModule,
    DashboardModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Run full test suite**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests PASS (all previous + new Phase 3 tests).

- [ ] **Step 3: TypeScript build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat: register MeetingsModule, ContentModule, ProposalsModule, DashboardModule in AppModule"
```

---

## Task 14: Frontend — Dashboard page

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add dashboard API call to api-client.ts**

Append to `apps/web/src/lib/api-client.ts`:

```typescript
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

export interface DashboardMetrics {
  leads: { total: number; byStatus: Record<string, number> };
  emails: { sentToday: number; sentThisWeek: number; replyRate: number };
  meetings: { scheduled: number; total: number };
  proposals: { draft: number; sent: number };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch(`${API_BASE}/dashboard/metrics?tenantId=${ORG_ID}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  return res.json() as Promise<DashboardMetrics>;
}
```

Note: `ORG_ID` is already declared in api-client.ts (added in Phase 2). If a duplicate declaration error appears, remove the duplicate and keep the one constant at the top of the file.

- [ ] **Step 2: Create dashboard page**

```typescript
// apps/web/src/app/dashboard/page.tsx
import { fetchDashboardMetrics, DashboardMetrics } from '@/lib/api-client';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="text-sm text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  let metrics: DashboardMetrics | null = null;
  try {
    metrics = await fetchDashboardMetrics();
  } catch {
    // API not running
  }

  const m = metrics;

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {!m ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-400">
          Could not load metrics — is the API running?
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Leads</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Leads" value={m.leads.total} />
              <StatCard label="New" value={m.leads.byStatus['NEW'] ?? 0} />
              <StatCard label="Outreach Sent" value={m.leads.byStatus['OUTREACH_SENT'] ?? 0} />
              <StatCard label="Replied" value={m.leads.byStatus['REPLIED'] ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Emails</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Sent Today" value={m.emails.sentToday} sub="/ 25 daily limit" />
              <StatCard label="Sent This Week" value={m.emails.sentThisWeek} />
              <StatCard label="Reply Rate" value={`${m.emails.replyRate.toFixed(1)}%`} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Meetings</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Scheduled" value={m.meetings.scheduled} />
              <StatCard label="Total Booked" value={m.meetings.total} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Proposals</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Draft" value={m.proposals.draft} />
              <StatCard label="Sent" value={m.proposals.sent} />
            </div>
          </section>

          {Object.keys(m.leads.byStatus).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline Breakdown</h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(m.leads.byStatus).map(([status, count]) => (
                      <tr key={status} className="border-b last:border-0">
                        <td className="px-4 py-3 text-gray-700">{status.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-right font-medium">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd apps/web && npm run build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/ apps/web/src/lib/api-client.ts
git commit -m "feat: add dashboard page with leads, email, meeting, and proposal metrics"
```

---

## Task 15: Frontend — Content admin (case studies + rate cards)

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/app/content/page.tsx`
- Create: `apps/web/src/app/content/actions.ts`

- [ ] **Step 1: Add content API calls to api-client.ts**

Append to `apps/web/src/lib/api-client.ts`:

```typescript
export interface CaseStudy {
  id: string;
  title: string;
  client: string;
  industry: string | null;
  techStack: string[];
  challenge: string;
  solution: string;
  result: string;
}

export interface RateCard {
  id: string;
  role: string;
  seniorityLevel: string;
  monthlyRate: number;
  hourlyRate: number;
  currency: string;
}

export async function fetchCaseStudies(): Promise<CaseStudy[]> {
  const res = await fetch(`${API_BASE}/case-studies?tenantId=${ORG_ID}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch case studies');
  return res.json() as Promise<CaseStudy[]>;
}

export async function createCaseStudy(data: Omit<CaseStudy, 'id'>): Promise<CaseStudy> {
  const res = await fetch(`${API_BASE}/case-studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tenantId: ORG_ID }),
  });
  if (!res.ok) throw new Error('Failed to create case study');
  return res.json() as Promise<CaseStudy>;
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/case-studies/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete case study');
}

export async function fetchRateCards(): Promise<RateCard[]> {
  const res = await fetch(`${API_BASE}/rate-cards?tenantId=${ORG_ID}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch rate cards');
  return res.json() as Promise<RateCard[]>;
}

export async function upsertRateCard(data: Omit<RateCard, 'id'>): Promise<RateCard> {
  const res = await fetch(`${API_BASE}/rate-cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, tenantId: ORG_ID }),
  });
  if (!res.ok) throw new Error('Failed to upsert rate card');
  return res.json() as Promise<RateCard>;
}

export async function deleteRateCard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rate-cards/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete rate card');
}
```

- [ ] **Step 2: Create server actions**

```typescript
// apps/web/src/app/content/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createCaseStudy, deleteCaseStudy, upsertRateCard, deleteRateCard } from '@/lib/api-client';

export async function createCaseStudyAction(formData: FormData) {
  const techStackRaw = formData.get('techStack') as string;
  await createCaseStudy({
    title: formData.get('title') as string,
    client: formData.get('client') as string,
    industry: (formData.get('industry') as string) || null,
    techStack: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean),
    challenge: formData.get('challenge') as string,
    solution: formData.get('solution') as string,
    result: formData.get('result') as string,
  });
  revalidatePath('/content');
}

export async function deleteCaseStudyAction(id: string) {
  await deleteCaseStudy(id);
  revalidatePath('/content');
}

export async function upsertRateCardAction(formData: FormData) {
  await upsertRateCard({
    role: formData.get('role') as string,
    seniorityLevel: formData.get('seniorityLevel') as string,
    monthlyRate: parseFloat(formData.get('monthlyRate') as string),
    hourlyRate: parseFloat(formData.get('hourlyRate') as string),
    currency: 'USD',
  });
  revalidatePath('/content');
}

export async function deleteRateCardAction(id: string) {
  await deleteRateCard(id);
  revalidatePath('/content');
}
```

- [ ] **Step 3: Create content admin page**

```typescript
// apps/web/src/app/content/page.tsx
import { fetchCaseStudies, fetchRateCards } from '@/lib/api-client';
import {
  createCaseStudyAction,
  deleteCaseStudyAction,
  upsertRateCardAction,
  deleteRateCardAction,
} from './actions';

export default async function ContentPage() {
  let caseStudies = [];
  let rateCards = [];
  try {
    [caseStudies, rateCards] = await Promise.all([fetchCaseStudies(), fetchRateCards()]);
  } catch {
    // API not running
  }

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-12">
      {/* Case Studies */}
      <section>
        <h1 className="text-2xl font-bold mb-6">Case Studies</h1>

        <form action={createCaseStudyAction} className="rounded-lg border bg-white p-6 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-800 mb-2">Add Case Study</h2>
          <div className="grid grid-cols-2 gap-3">
            <input name="title" placeholder="Title" required className="col-span-2 border rounded-md px-3 py-2 text-sm" />
            <input name="client" placeholder="Client name" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="industry" placeholder="Industry (optional)" className="border rounded-md px-3 py-2 text-sm" />
            <input name="techStack" placeholder="Tech stack (comma separated)" className="col-span-2 border rounded-md px-3 py-2 text-sm" />
            <textarea name="challenge" placeholder="Challenge" required className="border rounded-md px-3 py-2 text-sm" rows={2} />
            <textarea name="solution" placeholder="Solution" required className="border rounded-md px-3 py-2 text-sm" rows={2} />
            <textarea name="result" placeholder="Result / outcome" required className="col-span-2 border rounded-md px-3 py-2 text-sm" rows={2} />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
            Add Case Study
          </button>
        </form>

        {caseStudies.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-gray-400 text-sm">No case studies yet</div>
        ) : (
          <div className="space-y-3">
            {caseStudies.map((cs) => (
              <div key={cs.id} className="rounded-lg border bg-white p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{cs.title}</div>
                  <div className="text-sm text-gray-500">{cs.client}{cs.industry ? ` · ${cs.industry}` : ''}</div>
                  <div className="text-sm text-gray-600 mt-1">{cs.result}</div>
                  <div className="text-xs text-gray-400 mt-1">{cs.techStack.join(', ')}</div>
                </div>
                <form action={deleteCaseStudyAction.bind(null, cs.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:text-red-800 shrink-0">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rate Cards */}
      <section>
        <h1 className="text-2xl font-bold mb-6">Rate Cards</h1>

        <form action={upsertRateCardAction} className="rounded-lg border bg-white p-6 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-800 mb-2">Add / Update Rate</h2>
          <div className="grid grid-cols-2 gap-3">
            <input name="role" placeholder="Role (e.g. Frontend Developer)" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="seniorityLevel" placeholder="Seniority (e.g. Senior)" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="monthlyRate" type="number" placeholder="Monthly rate (USD)" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="hourlyRate" type="number" placeholder="Hourly rate (USD)" required className="border rounded-md px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
            Save Rate
          </button>
        </form>

        {rateCards.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-gray-400 text-sm">No rates configured yet</div>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Seniority</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Monthly</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Hourly</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rateCards.map((rc) => (
                  <tr key={rc.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{rc.role}</td>
                    <td className="px-4 py-3">{rc.seniorityLevel}</td>
                    <td className="px-4 py-3 text-right">${rc.monthlyRate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">${rc.hourlyRate}/hr</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteRateCardAction.bind(null, rc.id)}>
                        <button type="submit" className="text-sm text-red-600 hover:text-red-800">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Build check**

```bash
cd apps/web && npm run build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/content/ apps/web/src/lib/api-client.ts
git commit -m "feat: add content admin page for case studies and rate cards"
```

---

## Task 16: Frontend — Proposals list + new proposal form

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/app/proposals/page.tsx`
- Create: `apps/web/src/app/proposals/new/page.tsx`
- Create: `apps/web/src/app/proposals/actions.ts`

- [ ] **Step 1: Add proposals API calls to api-client.ts**

Append to `apps/web/src/lib/api-client.ts`:

```typescript
export interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  opportunityId: string;
}

export interface Opportunity {
  id: string;
  title: string;
  stage: string;
  lead: { contact: { firstName: string; lastName: string }; company: { name: string } };
}

export async function fetchProposals(): Promise<Proposal[]> {
  const res = await fetch(`${API_BASE}/proposals?tenantId=${ORG_ID}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch proposals');
  return res.json() as Promise<Proposal[]>;
}

export async function createProposal(data: {
  opportunityId: string;
  projectDescription: string;
  techStackNeeded: string[];
  durationMonths: number;
  teamSize: number;
  seniorityMix: 'senior' | 'mixed' | 'junior';
}): Promise<Proposal> {
  const res = await fetch(`${API_BASE}/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create proposal');
  return res.json() as Promise<Proposal>;
}
```

- [ ] **Step 2: Create server actions**

```typescript
// apps/web/src/app/proposals/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createProposal } from '@/lib/api-client';

export async function createProposalAction(formData: FormData) {
  const techStackRaw = formData.get('techStackNeeded') as string;

  await createProposal({
    opportunityId: formData.get('opportunityId') as string,
    projectDescription: formData.get('projectDescription') as string,
    techStackNeeded: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean),
    durationMonths: parseInt(formData.get('durationMonths') as string, 10),
    teamSize: parseInt(formData.get('teamSize') as string, 10),
    seniorityMix: formData.get('seniorityMix') as 'senior' | 'mixed' | 'junior',
  });

  redirect('/proposals');
}
```

- [ ] **Step 3: Create proposals list page**

```typescript
// apps/web/src/app/proposals/page.tsx
import Link from 'next/link';
import { fetchProposals } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  VIEWED: 'bg-purple-100 text-purple-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default async function ProposalsPage() {
  let proposals = [];
  try {
    proposals = await fetchProposals();
  } catch {
    // API not running
  }

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proposals</h1>
        <Link
          href="/proposals/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Generate Proposal
        </Link>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-400">
          No proposals yet — generate your first one
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/v1/proposals/${p.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Download PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

Note: The PDF download link points directly to the API URL. Update `href` to use the actual API base:
```typescript
href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/proposals/${p.id}/pdf`}
```

- [ ] **Step 4: Create new proposal form page**

The form requires an `opportunityId`. Opportunities are created automatically when a Cal.com meeting is booked. For the form, we'll accept the opportunityId as a text input (admins know their opportunity IDs) or fetch them. Since this is a low-usage internal tool, a simple text field is fine.

```typescript
// apps/web/src/app/proposals/new/page.tsx
import { createProposalAction } from '../actions';

export default function NewProposalPage() {
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Generate Proposal</h1>
      <div className="text-sm text-gray-500 mb-6">
        Generates a professional proposal PDF using AI. Make sure you have added case studies and rate cards in{' '}
        <a href="/content" className="text-indigo-600 hover:underline">Content Admin</a>.
      </div>

      <form action={createProposalAction} className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity ID</label>
          <input
            name="opportunityId"
            required
            placeholder="Paste the Opportunity UUID"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Created automatically when a Cal.com meeting is booked. Find it via the API: GET /api/v1/leads.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
          <textarea
            name="projectDescription"
            required
            rows={3}
            placeholder="Describe what the client needs (e.g. 'Build a React + NestJS SaaS dashboard with role-based access')"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack Needed</label>
          <input
            name="techStackNeeded"
            required
            placeholder="React, NestJS, PostgreSQL"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Comma separated</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
            <input name="durationMonths" type="number" min="1" max="36" defaultValue="3" required className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Size</label>
            <input name="teamSize" type="number" min="1" max="20" defaultValue="2" required className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seniority Mix</label>
          <select name="seniorityMix" className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="senior">Senior (highest quality)</option>
            <option value="mixed">Mixed (balanced)</option>
            <option value="junior">Junior (cost-optimised)</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Generate Proposal (takes ~10s)
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Build check**

```bash
cd apps/web && npm run build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/proposals/ apps/web/src/lib/api-client.ts
git commit -m "feat: add proposals list and new proposal form pages"
```

---

## Task 17: Frontend — Update layout nav

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Add Phase 3 nav links**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Generator",
  description: "AI Sales Automation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium">
          <a href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</a>
          <a href="/leads" className="text-gray-700 hover:text-gray-900">Leads</a>
          <a href="/approvals" className="text-gray-700 hover:text-gray-900">Approvals</a>
          <a href="/proposals" className="text-gray-700 hover:text-gray-900">Proposals</a>
          <a href="/content" className="text-gray-700 hover:text-gray-900">Content</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/web && npm run build
```

Expected: No errors.

- [ ] **Step 3: Run full API test suite one final time**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: add Dashboard, Proposals, Content links to nav"
```

---

## Final wiring check

Before calling Phase 3 complete:

- [ ] **TypeScript build (both apps)**

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

Expected: No errors in either app.

- [ ] **End-to-end smoke test** (manual, requires running services)

1. Start API: `cd apps/api && npm run start:dev`
2. Start web: `cd apps/web && npm run dev`
3. Visit `http://localhost:3000/content` — add a case study and a rate card
4. In Cal.com dashboard, create a test webhook pointing to `http://localhost:3001/api/v1/webhooks/calcom` with event `BOOKING_CREATED`
5. Book a test meeting with a lead's email — verify lead status updates to `MEETING_BOOKED`
6. Visit `http://localhost:3000/proposals/new` — generate a proposal using the auto-created Opportunity ID
7. Visit `http://localhost:3000/proposals` — download the PDF
8. Visit `http://localhost:3000/dashboard` — verify metrics reflect the test data

- [ ] **Final commit tag**

```bash
git tag phase-3-complete
```

---

## Environment setup notes

Add to `apps/api/.env` for Phase 3:
```
CAL_COM_WEBHOOK_SECRET=your_calcom_webhook_secret_optional
```

For Cal.com integration:
1. In Cal.com dashboard → Settings → Developer → Webhooks → Add webhook
2. Subscriber URL: `https://your-api-url/api/v1/webhooks/calcom`
3. Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`
4. Copy the signing secret to `CAL_COM_WEBHOOK_SECRET`

For Puppeteer on Google Cloud Run:
- Add `--no-sandbox` flag (already in PdfService)
- Use `puppeteer` (bundles Chromium) rather than `puppeteer-core`
- Set Cloud Run memory to at least 512MB (Chromium needs it)
- Set `--disable-dev-shm-usage` if memory issues occur in PDF generation
