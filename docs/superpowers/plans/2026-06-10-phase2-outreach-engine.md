# Phase 2: Outreach Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full outreach engine — AI email generation, SendGrid delivery, HOT/STANDARD follow-up sequences, human approval gate on the first batch, and reply detection via SendGrid Inbound Parse.

**Architecture:** The scoring processor enqueues a `lead-outreach` job after scoring. The outreach processor creates an `OutreachSequence` + all `OutreachStep` rows, generates Step 1's email body via GPT-4o-mini, and either gates it behind human approval (first batch) or sends immediately. Follow-up steps are dispatched as delayed BullMQ jobs. Replies are detected via a `Reply-To: reply+{leadId}@{OUTREACH_DOMAIN}` convention on every outgoing email.

**Tech Stack:** NestJS BullMQ, `@sendgrid/mail`, OpenAI SDK (gpt-4o-mini), Prisma 7, Next.js 14 App Router + ShadCN UI

---

## File Map

**New files — API:**
- `apps/api/src/modules/outreach/outreach.module.ts`
- `apps/api/src/modules/outreach/outreach.repository.ts`
- `apps/api/src/modules/outreach/outreach.service.ts` (email generation)
- `apps/api/src/modules/outreach/sendgrid.service.ts`
- `apps/api/src/modules/outreach/sequence.service.ts`
- `apps/api/src/modules/outreach/outreach.constants.ts`
- `apps/api/src/modules/outreach/prompts/cold-email.prompt.ts`
- `apps/api/src/modules/outreach/prompts/followup-email.prompt.ts`
- `apps/api/src/modules/outreach/processors/lead-outreach.processor.ts`
- `apps/api/src/modules/outreach/processors/lead-followup.processor.ts`
- `apps/api/src/modules/approval/approval.module.ts`
- `apps/api/src/modules/approval/approval.controller.ts`
- `apps/api/src/modules/approval/approval.service.ts`
- `apps/api/src/modules/webhooks/webhooks.module.ts`
- `apps/api/src/modules/webhooks/webhooks.controller.ts`
- `apps/api/src/modules/webhooks/webhooks.service.ts`

**New test files:**
- `apps/api/test/outreach.repository.spec.ts`
- `apps/api/test/email-generation.service.spec.ts`
- `apps/api/test/sendgrid.service.spec.ts`
- `apps/api/test/sequence.service.spec.ts`
- `apps/api/test/lead-outreach.processor.spec.ts`
- `apps/api/test/lead-followup.processor.spec.ts`
- `apps/api/test/approval.service.spec.ts`
- `apps/api/test/webhooks.service.spec.ts`

**Modified files — API:**
- `apps/api/src/config/config.module.ts` — add SENDGRID vars + OUTREACH_DOMAIN
- `apps/api/src/queue/queue.module.ts` — register `lead-outreach` + `lead-followup` queues
- `apps/api/src/modules/scoring/processors/lead-scoring.processor.ts` — enqueue `lead-outreach` after score
- `apps/api/src/app.module.ts` — import OutreachModule, ApprovalModule, WebhooksModule
- `apps/api/.env.example` — add new vars

**New files — Web:**
- `apps/web/src/app/approvals/page.tsx`
- `apps/web/src/app/approvals/actions.ts`

**Modified files — Web:**
- `apps/web/src/lib/api-client.ts` — add approval API calls
- `apps/web/src/app/leads/page.tsx` — add sequence status column

---

## Task 1: Config additions

**Files:**
- Modify: `apps/api/src/config/config.module.ts`
- Modify: `apps/api/.env.example` (create if missing)

- [ ] **Step 1: Write failing test — config validation rejects missing SENDGRID vars**

```typescript
// apps/api/test/config.spec.ts  — append to existing or create new
import { Test } from '@nestjs/testing';
import { ConfigModule } from '../src/config/config.module';

describe('ConfigModule SENDGRID validation', () => {
  it('should throw when SENDGRID_API_KEY is missing', async () => {
    const original = process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    await expect(
      Test.createTestingModule({ imports: [ConfigModule] }).compile(),
    ).rejects.toThrow();
    process.env.SENDGRID_API_KEY = original;
  });
});
```

Run: `cd apps/api && npx jest test/config.spec.ts -t "SENDGRID" --no-coverage`
Expected: FAIL (SENDGRID_API_KEY not in schema yet)

- [ ] **Step 2: Update config validation schema**

```typescript
// apps/api/src/config/config.module.ts — replace validationSchema Joi.object({...})
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
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  ORG_ID: Joi.string().uuid().required(),
  ORG_NAME: Joi.string().required(),
}),
```

- [ ] **Step 3: Add env vars to .env.example**

Create/update `apps/api/.env.example`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/lead_generator
REDIS_URL=redis://localhost:6379
APOLLO_API_KEY=your_apollo_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=outreach@yourdomain.com
FROM_NAME=Sharad from Conversion.io
OUTREACH_DOMAIN=outreach.yourdomain.com
SENDGRID_WEBHOOK_SECRET=optional_webhook_secret
PORT=3001
NODE_ENV=development
ORG_ID=00000000-0000-0000-0000-000000000001
ORG_NAME=Conversion.io
```

Also add these to `apps/api/.env` locally with real or placeholder values.

- [ ] **Step 4: Run test — must pass**

Run: `cd apps/api && npx jest test/config.spec.ts -t "SENDGRID" --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config/config.module.ts apps/api/.env.example
git commit -m "feat: add sendgrid and outreach env var validation"
```

---

## Task 2: OutreachRepository

**Files:**
- Create: `apps/api/src/modules/outreach/outreach.repository.ts`
- Create: `apps/api/test/outreach.repository.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/outreach.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  outreachSequence: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  outreachStep: {
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('OutreachRepository', () => {
  let repo: OutreachRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(OutreachRepository);
    jest.clearAllMocks();
  });

  describe('createSequence', () => {
    it('creates a sequence with provided data', async () => {
      const seq = { id: 'seq-1', tenantId: 'org-1', leadId: 'lead-1' };
      mockPrisma.outreachSequence.create.mockResolvedValue(seq);

      const result = await repo.createSequence({
        tenantId: 'org-1',
        leadId: 'lead-1',
        sequenceType: 'HOT',
      });

      expect(mockPrisma.outreachSequence.create).toHaveBeenCalledWith({
        data: { tenantId: 'org-1', leadId: 'lead-1', sequenceType: 'HOT' },
      });
      expect(result).toEqual(seq);
    });
  });

  describe('createSteps', () => {
    it('bulk-creates steps', async () => {
      mockPrisma.outreachStep.createMany.mockResolvedValue({ count: 4 });

      await repo.createSteps([
        { sequenceId: 'seq-1', tenantId: 'org-1', stepNumber: 1, scheduledAt: new Date(), status: 'PENDING_APPROVAL' },
        { sequenceId: 'seq-1', tenantId: 'org-1', stepNumber: 2, scheduledAt: new Date(), status: 'PENDING' },
      ]);

      expect(mockPrisma.outreachStep.createMany).toHaveBeenCalled();
    });
  });

  describe('findPendingApprovalSteps', () => {
    it('queries steps with PENDING_APPROVAL status', async () => {
      mockPrisma.outreachStep.findMany.mockResolvedValue([]);
      await repo.findPendingApprovalSteps('org-1');
      expect(mockPrisma.outreachStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING_APPROVAL', tenantId: 'org-1' }),
        }),
      );
    });
  });

  describe('countSentToday', () => {
    it('counts steps sent after UTC midnight today', async () => {
      mockPrisma.outreachStep.count.mockResolvedValue(7);
      const result = await repo.countSentToday('org-1');
      expect(result).toBe(7);
      const call = mockPrisma.outreachStep.count.mock.calls[0][0];
      expect(call.where.tenantId).toBe('org-1');
      expect(call.where.status).toBe('SENT');
      expect(call.where.sentAt.gte).toBeInstanceOf(Date);
    });
  });

  describe('hasAnySentStep', () => {
    it('returns true when count > 0', async () => {
      mockPrisma.outreachStep.count.mockResolvedValue(1);
      const result = await repo.hasAnySentStep('org-1');
      expect(result).toBe(true);
    });

    it('returns false when no sent steps', async () => {
      mockPrisma.outreachStep.count.mockResolvedValue(0);
      const result = await repo.hasAnySentStep('org-1');
      expect(result).toBe(false);
    });
  });

  describe('updateStep', () => {
    it('updates step by id', async () => {
      mockPrisma.outreachStep.update.mockResolvedValue({ id: 'step-1' });
      await repo.updateStep('step-1', { status: 'SENT', sentAt: new Date() });
      expect(mockPrisma.outreachStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });
  });

  describe('updateSequence', () => {
    it('updates sequence by id', async () => {
      mockPrisma.outreachSequence.update.mockResolvedValue({ id: 'seq-1' });
      await repo.updateSequence('seq-1', { status: 'STOPPED', stoppedAt: new Date() });
      expect(mockPrisma.outreachSequence.update).toHaveBeenCalledWith({
        where: { id: 'seq-1' },
        data: expect.objectContaining({ status: 'STOPPED' }),
      });
    });
  });

  describe('findSequenceByLeadId', () => {
    it('finds active sequence for lead', async () => {
      const seq = { id: 'seq-1', status: 'ACTIVE' };
      mockPrisma.outreachSequence.findFirst.mockResolvedValue(seq);
      const result = await repo.findSequenceByLeadId('lead-1', 'org-1');
      expect(result).toEqual(seq);
    });
  });

  describe('findStepById', () => {
    it('finds step including sequence relation', async () => {
      const step = { id: 'step-1', sequence: { leadId: 'lead-1' } };
      mockPrisma.outreachStep.findUnique.mockResolvedValue(step);
      const result = await repo.findStepById('step-1');
      expect(result).toEqual(step);
    });
  });
});
```

Run: `cd apps/api && npx jest test/outreach.repository.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement OutreachRepository**

```typescript
// apps/api/src/modules/outreach/outreach.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutreachSequence, OutreachStep, SequenceStatus, StepStatus } from '@prisma/client';

export interface CreateSequenceDto {
  tenantId: string;
  leadId: string;
  sequenceType: string;
}

export interface CreateStepDto {
  sequenceId: string;
  tenantId: string;
  stepNumber: number;
  scheduledAt: Date;
  status: StepStatus;
  subject?: string;
  body?: string;
}

export type OutreachStepWithSequence = OutreachStep & {
  sequence: OutreachSequence & {
    lead: { id: string; tenantId: string; contact: { firstName: string; lastName: string; email: string; title: string | null }; company: { name: string; website: string | null } };
  };
};

@Injectable()
export class OutreachRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSequence(dto: CreateSequenceDto): Promise<OutreachSequence> {
    return this.prisma.outreachSequence.create({
      data: { tenantId: dto.tenantId, leadId: dto.leadId, sequenceType: dto.sequenceType },
    });
  }

  async createSteps(steps: CreateStepDto[]): Promise<void> {
    await this.prisma.outreachStep.createMany({ data: steps });
  }

  async findPendingApprovalSteps(tenantId: string): Promise<OutreachStepWithSequence[]> {
    return this.prisma.outreachStep.findMany({
      where: { tenantId, status: StepStatus.PENDING_APPROVAL },
      include: {
        sequence: {
          include: {
            lead: { include: { contact: true, company: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    }) as Promise<OutreachStepWithSequence[]>;
  }

  async countSentToday(tenantId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.prisma.outreachStep.count({
      where: { tenantId, status: StepStatus.SENT, sentAt: { gte: startOfDay } },
    });
  }

  async hasAnySentStep(tenantId: string): Promise<boolean> {
    const count = await this.prisma.outreachStep.count({
      where: { tenantId, status: StepStatus.SENT },
    });
    return count > 0;
  }

  async findStepById(id: string): Promise<OutreachStepWithSequence | null> {
    return this.prisma.outreachStep.findUnique({
      where: { id },
      include: {
        sequence: {
          include: {
            lead: { include: { contact: true, company: true } },
          },
        },
      },
    }) as Promise<OutreachStepWithSequence | null>;
  }

  async findSequenceByLeadId(leadId: string, tenantId: string): Promise<OutreachSequence | null> {
    return this.prisma.outreachSequence.findFirst({
      where: { leadId, tenantId },
    });
  }

  async findStepByMessageId(messageId: string): Promise<OutreachStepWithSequence | null> {
    return this.prisma.outreachStep.findFirst({
      where: { messageId },
      include: {
        sequence: {
          include: {
            lead: { include: { contact: true, company: true } },
          },
        },
      },
    }) as Promise<OutreachStepWithSequence | null>;
  }

  async updateStep(id: string, data: Partial<Pick<OutreachStep, 'status' | 'sentAt' | 'subject' | 'body' | 'messageId' | 'openedAt'>>): Promise<OutreachStep> {
    return this.prisma.outreachStep.update({ where: { id }, data });
  }

  async updateSequence(id: string, data: Partial<Pick<OutreachSequence, 'status' | 'stoppedAt' | 'currentStep'>>): Promise<OutreachSequence> {
    return this.prisma.outreachSequence.update({ where: { id }, data });
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/outreach.repository.spec.ts --no-coverage`
Expected: All 10 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/outreach/outreach.repository.ts apps/api/test/outreach.repository.spec.ts
git commit -m "feat: add OutreachRepository with sequence and step CRUD"
```

---

## Task 3: Email generation service

**Files:**
- Create: `apps/api/src/modules/outreach/prompts/cold-email.prompt.ts`
- Create: `apps/api/src/modules/outreach/prompts/followup-email.prompt.ts`
- Create: `apps/api/src/modules/outreach/outreach.service.ts`
- Create: `apps/api/test/email-generation.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/email-generation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OutreachService } from '../src/modules/outreach/outreach.service';

const mockOpenAI = {
  chat: { completions: { create: jest.fn() } },
};

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => mockOpenAI),
}));

const configMock = { get: (key: string) => (key === 'OPENAI_API_KEY' ? 'test-key' : undefined) };

describe('OutreachService', () => {
  let service: OutreachService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutreachService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(OutreachService);
    jest.clearAllMocks();
  });

  describe('generateColdEmail', () => {
    it('returns subject and body from GPT-4o-mini', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ subject: 'Hi there', body: 'Hello Alice' }) } }],
      });

      const result = await service.generateColdEmail({
        firstName: 'Alice',
        lastName: 'Chen',
        title: 'CTO',
        companyName: 'TechStartup',
        industry: 'SaaS',
        techStack: ['React', 'Node.js'],
        location: 'Austin TX',
      });

      expect(result.subject).toBe('Hi there');
      expect(result.body).toBe('Hello Alice');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini', temperature: 0.7 }),
      );
    });

    it('throws when AI returns invalid JSON', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'not json' } }],
      });

      await expect(
        service.generateColdEmail({ firstName: 'A', lastName: 'B', title: 'CTO', companyName: 'X', industry: null, techStack: [], location: null }),
      ).rejects.toThrow('Invalid email generation response');
    });
  });

  describe('generateFollowupEmail', () => {
    it('returns subject and body for step 2', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ subject: 'Re: following up', body: 'Hey Alice' }) } }],
      });

      const result = await service.generateFollowupEmail({
        firstName: 'Alice',
        companyName: 'TechStartup',
        stepNumber: 2,
        previousSubject: 'Hi there',
      });

      expect(result.subject).toBe('Re: following up');
      expect(result.body).toBe('Hey Alice');
    });
  });
});
```

Run: `cd apps/api && npx jest test/email-generation.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Create cold email prompt**

```typescript
// apps/api/src/modules/outreach/prompts/cold-email.prompt.ts
export interface ColdEmailInput {
  firstName: string;
  lastName: string;
  title: string | null;
  companyName: string;
  industry: string | null;
  techStack: string[];
  location: string | null;
}

export function buildColdEmailPrompt(input: ColdEmailInput): string {
  const stack = input.techStack.length ? input.techStack.join(', ') : 'modern web stack';
  const loc = input.location ? ` based in ${input.location}` : '';
  const ind = input.industry ? ` (${input.industry})` : '';
  const title = input.title ? input.title : 'tech leader';

  return `You are a senior sales rep at Conversion.io, an IT services company specialising in React, Next.js, Node.js, NestJS, and TypeScript.

Write a cold outreach email to ${input.firstName} ${input.lastName}, ${title} at ${input.companyName}${ind}${loc}. Their tech stack includes ${stack}.

Rules:
- 3–5 short sentences, no fluff
- Personalise to their stack and company size/industry
- Mention one concrete benefit (fast delivery, TypeScript expertise, NestJS microservices, etc.)
- End with a soft CTA: ask for a 20-min call
- NO subject line emojis
- Subject line max 8 words
- Body max 120 words

Respond ONLY with valid JSON (no markdown):
{"subject": "...", "body": "..."}`;
}
```

- [ ] **Step 3: Create follow-up email prompt**

```typescript
// apps/api/src/modules/outreach/prompts/followup-email.prompt.ts
export interface FollowupEmailInput {
  firstName: string;
  companyName: string;
  stepNumber: number;
  previousSubject: string;
}

const FOLLOWUP_TONE: Record<number, string> = {
  2: 'Brief and friendly — assume they were busy, not uninterested.',
  3: 'Add a tiny bit of value — mention a React/Next.js trend or quick insight.',
  4: 'Final polite nudge — acknowledge this is the last email in this thread.',
};

export function buildFollowupEmailPrompt(input: FollowupEmailInput): string {
  const tone = FOLLOWUP_TONE[input.stepNumber] ?? FOLLOWUP_TONE[2];

  return `You are a senior sales rep at Conversion.io.

Write follow-up email #${input.stepNumber - 1} to ${input.firstName} at ${input.companyName}. The original thread subject was "${input.previousSubject}".

Tone: ${tone}

Rules:
- 2–4 sentences max
- Do NOT repeat the original pitch verbatim
- Subject: prefix with "Re: " then shorten the original subject
- Body max 80 words

Respond ONLY with valid JSON (no markdown):
{"subject": "...", "body": "..."}`;
}
```

- [ ] **Step 4: Create OutreachService**

```typescript
// apps/api/src/modules/outreach/outreach.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { buildColdEmailPrompt, ColdEmailInput } from './prompts/cold-email.prompt';
import { buildFollowupEmailPrompt, FollowupEmailInput } from './prompts/followup-email.prompt';

export interface GeneratedEmail {
  subject: string;
  body: string;
}

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  async generateColdEmail(input: ColdEmailInput): Promise<GeneratedEmail> {
    const prompt = buildColdEmailPrompt(input);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content ?? '';
    return this.parseEmailResponse(content);
  }

  async generateFollowupEmail(input: FollowupEmailInput): Promise<GeneratedEmail> {
    const prompt = buildFollowupEmailPrompt(input);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content ?? '';
    return this.parseEmailResponse(content);
  }

  private parseEmailResponse(content: string): GeneratedEmail {
    try {
      const parsed = JSON.parse(content) as GeneratedEmail;
      if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
        throw new Error('Missing fields');
      }
      return { subject: parsed.subject, body: parsed.body };
    } catch {
      this.logger.error(`Invalid email generation response: ${content}`);
      throw new Error('Invalid email generation response');
    }
  }
}
```

- [ ] **Step 5: Run tests — must pass**

Run: `cd apps/api && npx jest test/email-generation.service.spec.ts --no-coverage`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/outreach/prompts/ apps/api/src/modules/outreach/outreach.service.ts apps/api/test/email-generation.service.spec.ts
git commit -m "feat: add email generation service with cold-email and followup prompts"
```

---

## Task 4: SendGrid service

**Files:**
- Create: `apps/api/src/modules/outreach/sendgrid.service.ts`
- Create: `apps/api/test/sendgrid.service.spec.ts`

First install the package: `cd apps/api && npm install @sendgrid/mail`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/sendgrid.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';

const mockSendGrid = { setApiKey: jest.fn(), send: jest.fn() };
jest.mock('@sendgrid/mail', () => mockSendGrid);

const configValues: Record<string, string> = {
  SENDGRID_API_KEY: 'SG.test',
  FROM_EMAIL: 'outreach@example.com',
  FROM_NAME: 'Sharad',
  OUTREACH_DOMAIN: 'outreach.example.com',
};
const configMock = { get: (key: string) => configValues[key] };

describe('SendGridService', () => {
  let service: SendGridService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendGridService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(SendGridService);
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('calls sendgrid.send with correct fields and returns messageId', async () => {
      mockSendGrid.send.mockResolvedValue([{ headers: { 'x-message-id': 'msg-abc' } }, {}]);

      const messageId = await service.sendEmail({
        to: 'alice@example.com',
        leadId: 'lead-1',
        subject: 'Hello',
        body: 'Hi there',
      });

      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          from: { email: 'outreach@example.com', name: 'Sharad' },
          subject: 'Hello',
          replyTo: 'reply+lead-1@outreach.example.com',
        }),
      );
      expect(messageId).toBe('msg-abc');
    });

    it('throws when sendgrid errors', async () => {
      mockSendGrid.send.mockRejectedValue(new Error('rate limit'));
      await expect(
        service.sendEmail({ to: 'x@y.com', leadId: 'l', subject: 's', body: 'b' }),
      ).rejects.toThrow('rate limit');
    });
  });
});
```

Run: `cd apps/api && npx jest test/sendgrid.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement SendGridService**

```typescript
// apps/api/src/modules/outreach/sendgrid.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

export interface SendEmailOptions {
  to: string;
  leadId: string;
  subject: string;
  body: string;
}

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly outreachDomain: string;

  constructor(private readonly config: ConfigService) {
    sgMail.setApiKey(this.config.get<string>('SENDGRID_API_KEY')!);
    this.fromEmail = this.config.get<string>('FROM_EMAIL')!;
    this.fromName = this.config.get<string>('FROM_NAME')!;
    this.outreachDomain = this.config.get<string>('OUTREACH_DOMAIN')!;
  }

  async sendEmail(opts: SendEmailOptions): Promise<string> {
    const replyTo = `reply+${opts.leadId}@${this.outreachDomain}`;

    const [response] = await sgMail.send({
      to: opts.to,
      from: { email: this.fromEmail, name: this.fromName },
      replyTo,
      subject: opts.subject,
      text: opts.body,
      html: opts.body.replace(/\n/g, '<br>'),
    });

    const messageId = (response.headers as Record<string, string>)['x-message-id'] ?? '';
    this.logger.log(`Email sent to ${opts.to} — messageId=${messageId}`);
    return messageId;
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/sendgrid.service.spec.ts --no-coverage`
Expected: All 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/outreach/sendgrid.service.ts apps/api/test/sendgrid.service.spec.ts
git commit -m "feat: add SendGridService with reply-to addressing"
```

---

## Task 5: Sequence service

**Files:**
- Create: `apps/api/src/modules/outreach/outreach.constants.ts`
- Create: `apps/api/src/modules/outreach/sequence.service.ts`
- Create: `apps/api/test/sequence.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/sequence.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SequenceService, SEQUENCE_DAYS } from '../src/modules/outreach/sequence.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { OutreachService } from '../src/modules/outreach/outreach.service';

const mockRepo = {
  createSequence: jest.fn(),
  createSteps: jest.fn(),
  hasAnySentStep: jest.fn(),
};

const mockOutreachService = {
  generateColdEmail: jest.fn(),
};

const mockLeadContact = { firstName: 'Alice', lastName: 'Chen', email: 'alice@techstartup.io', title: 'CTO' };
const mockLeadCompany = { name: 'TechStartup', industry: 'SaaS', techStack: ['React'], location: 'Austin TX', website: null };

describe('SequenceService', () => {
  let service: SequenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: OutreachRepository, useValue: mockRepo },
        { provide: OutreachService, useValue: mockOutreachService },
      ],
    }).compile();
    service = module.get(SequenceService);
    jest.clearAllMocks();
  });

  describe('SEQUENCE_DAYS', () => {
    it('HOT has day offsets [0,1,4,9]', () => {
      expect(SEQUENCE_DAYS.HOT).toEqual([0, 1, 4, 9]);
    });

    it('STANDARD has day offsets [0,2,6,13]', () => {
      expect(SEQUENCE_DAYS.STANDARD).toEqual([0, 2, 6, 13]);
    });
  });

  describe('createForLead', () => {
    const input = {
      leadId: 'lead-1',
      tenantId: 'org-1',
      priority: 'HOT' as const,
      contact: mockLeadContact,
      company: mockLeadCompany,
    };

    it('creates HOT sequence with 4 steps', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      const result = await service.createForLead(input);

      expect(mockRepo.createSequence).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead-1', sequenceType: 'HOT' }),
      );
      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps).toHaveLength(4);
      expect(result.sequenceId).toBe('seq-1');
    });

    it('sets step 1 PENDING_APPROVAL when no emails sent yet (first batch)', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(false);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      const result = await service.createForLead(input);

      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps[0].status).toBe('PENDING_APPROVAL');
      expect(result.firstStepNeedsApproval).toBe(true);
    });

    it('sets step 1 APPROVED when emails already sent (auto-approve)', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      const result = await service.createForLead(input);

      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps[0].status).toBe('APPROVED');
      expect(result.firstStepNeedsApproval).toBe(false);
    });

    it('uses STANDARD sequence for WARM/COLD leads', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      await service.createForLead({ ...input, priority: 'WARM' });

      expect(mockRepo.createSequence).toHaveBeenCalledWith(
        expect.objectContaining({ sequenceType: 'STANDARD' }),
      );
      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps).toHaveLength(4);
    });

    it('stores generated subject and body on step 1', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hire React devs', body: 'Hi Alice' });

      await service.createForLead(input);

      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps[0].subject).toBe('Hire React devs');
      expect(steps[0].body).toBe('Hi Alice');
    });
  });
});
```

Run: `cd apps/api && npx jest test/sequence.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Create outreach constants**

```typescript
// apps/api/src/modules/outreach/outreach.constants.ts
export const DAILY_EMAIL_LIMIT = 25;
```

- [ ] **Step 3: Implement SequenceService**

```typescript
// apps/api/src/modules/outreach/sequence.service.ts
import { Injectable } from '@nestjs/common';
import { Priority, StepStatus } from '@prisma/client';
import { OutreachRepository } from './outreach.repository';
import { OutreachService } from './outreach.service';

export const SEQUENCE_DAYS: Record<'HOT' | 'STANDARD', number[]> = {
  HOT: [0, 1, 4, 9],
  STANDARD: [0, 2, 6, 13],
};

export interface CreateSequenceInput {
  leadId: string;
  tenantId: string;
  priority: Priority;
  contact: { firstName: string; lastName: string; email: string; title: string | null };
  company: { name: string; industry: string | null; techStack: string[]; location: string | null; website: string | null };
}

export interface CreateSequenceResult {
  sequenceId: string;
  firstStepId: string;
  firstStepNeedsApproval: boolean;
}

@Injectable()
export class SequenceService {
  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly outreachService: OutreachService,
  ) {}

  async createForLead(input: CreateSequenceInput): Promise<CreateSequenceResult> {
    const sequenceType = input.priority === Priority.HOT ? 'HOT' : 'STANDARD';
    const days = SEQUENCE_DAYS[sequenceType];

    const firstBatch = !(await this.outreachRepo.hasAnySentStep(input.tenantId));

    const email = await this.outreachService.generateColdEmail({
      firstName: input.contact.firstName,
      lastName: input.contact.lastName,
      title: input.contact.title,
      companyName: input.company.name,
      industry: input.company.industry,
      techStack: input.company.techStack,
      location: input.company.location,
    });

    const sequence = await this.outreachRepo.createSequence({
      tenantId: input.tenantId,
      leadId: input.leadId,
      sequenceType,
    });

    const now = new Date();
    const steps = days.map((dayOffset, index) => {
      const scheduledAt = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const isFirst = index === 0;

      return {
        sequenceId: sequence.id,
        tenantId: input.tenantId,
        stepNumber: index + 1,
        scheduledAt,
        status: isFirst
          ? firstBatch ? StepStatus.PENDING_APPROVAL : StepStatus.APPROVED
          : StepStatus.PENDING,
        subject: isFirst ? email.subject : undefined,
        body: isFirst ? email.body : undefined,
      };
    });

    await this.outreachRepo.createSteps(steps);

    const [firstStep] = await this.outreachRepo.findPendingApprovalSteps(input.tenantId)
      .then(pending => pending.filter(s => s.sequence.id === sequence.id));

    // If not pending_approval, find by querying — rely on createSteps returning in order
    // We need the first step id; re-query the sequence steps
    const allSteps = await this.outreachRepo['prisma'].outreachStep.findMany({
      where: { sequenceId: sequence.id, stepNumber: 1 },
    });

    return {
      sequenceId: sequence.id,
      firstStepId: allSteps[0].id,
      firstStepNeedsApproval: firstBatch,
    };
  }
}
```

Wait — `SequenceService` should not access `prisma` directly. Add a `findFirstStepOfSequence` method to `OutreachRepository` instead. Update both files:

**Update OutreachRepository** — add to the end of the class:
```typescript
async findFirstStepOfSequence(sequenceId: string): Promise<OutreachStep | null> {
  return this.prisma.outreachStep.findFirst({
    where: { sequenceId, stepNumber: 1 },
  });
}
```

**Update SequenceService** — replace the last block:
```typescript
const firstStep = await this.outreachRepo.findFirstStepOfSequence(sequence.id);

return {
  sequenceId: sequence.id,
  firstStepId: firstStep!.id,
  firstStepNeedsApproval: firstBatch,
};
```

- [ ] **Step 4: Run tests — must pass**

Run: `cd apps/api && npx jest test/sequence.service.spec.ts --no-coverage`
Expected: All 5 tests PASS

Note: The test mocks `createSteps` and `findPendingApprovalSteps`, so the `findFirstStepOfSequence` call won't be exercised in these tests. Add a mock return to `beforeEach`:
```typescript
// Add to mockRepo
findFirstStepOfSequence: jest.fn().mockResolvedValue({ id: 'step-1' }),
```
And re-run.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/outreach/outreach.constants.ts apps/api/src/modules/outreach/sequence.service.ts apps/api/src/modules/outreach/outreach.repository.ts apps/api/test/sequence.service.spec.ts
git commit -m "feat: add SequenceService with HOT/STANDARD sequence creation and first-batch gate"
```

---

## Task 6: Lead outreach processor

**Files:**
- Create: `apps/api/src/modules/outreach/processors/lead-outreach.processor.ts`
- Create: `apps/api/test/lead-outreach.processor.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/lead-outreach.processor.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LeadOutreachProcessor } from '../src/modules/outreach/processors/lead-outreach.processor';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { SequenceService } from '../src/modules/outreach/sequence.service';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { QUEUES } from '../src/queue/queue.constants';

const mockLeadsRepo = { updateStatus: jest.fn(), findById: jest.fn() };
const mockSequenceService = { createForLead: jest.fn() };
const mockSendGrid = { sendEmail: jest.fn() };
const mockOutreachRepo = { countSentToday: jest.fn(), updateStep: jest.fn(), updateSequence: jest.fn() };
const mockFollowupQueue = { add: jest.fn() };
const mockPrisma = {
  lead: {
    findUnique: jest.fn(),
  },
};

const mockLead = {
  id: 'lead-1',
  tenantId: 'org-1',
  score: 80,
  priority: 'HOT',
  contact: { firstName: 'Alice', lastName: 'Chen', email: 'alice@techstartup.io', title: 'CTO' },
  company: { name: 'TechStartup', industry: 'SaaS', techStack: ['React'], location: 'Austin TX', website: null },
};

describe('LeadOutreachProcessor', () => {
  let processor: LeadOutreachProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadOutreachProcessor,
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: SequenceService, useValue: mockSequenceService },
        { provide: SendGridService, useValue: mockSendGrid },
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(QUEUES.FOLLOWUP), useValue: mockFollowupQueue },
      ],
    }).compile();
    processor = module.get(LeadOutreachProcessor);
    jest.clearAllMocks();
  });

  it('creates sequence and updates lead to OUTREACH_PENDING_APPROVAL when first batch', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockSequenceService.createForLead.mockResolvedValue({
      sequenceId: 'seq-1',
      firstStepId: 'step-1',
      firstStepNeedsApproval: true,
    });

    await processor.process({ data: { leadId: 'lead-1' } } as any);

    expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'OUTREACH_PENDING_APPROVAL');
  });

  it('sends email and updates lead to OUTREACH_SENT when auto-approved', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockSequenceService.createForLead.mockResolvedValue({
      sequenceId: 'seq-1',
      firstStepId: 'step-1',
      firstStepNeedsApproval: false,
    });
    mockOutreachRepo.updateStep.mockResolvedValue(undefined);
    mockSendGrid.sendEmail.mockResolvedValue('msg-1');

    // Need to fetch step details — mock findStepById
    mockOutreachRepo['findStepById'] = jest.fn().mockResolvedValue({
      id: 'step-1',
      subject: 'Hello',
      body: 'Hi Alice',
      sequence: { leadId: 'lead-1' },
    });

    await processor.process({ data: { leadId: 'lead-1' } } as any);

    expect(mockSendGrid.sendEmail).toHaveBeenCalled();
    expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'OUTREACH_SENT');
  });

  it('skips and reschedules when daily limit reached', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(25);
    mockLeadsRepo.updateStatus.mockResolvedValue(undefined);

    const mockJob = {
      data: { leadId: 'lead-1' },
      moveToDelayed: jest.fn(),
    };

    await processor.process(mockJob as any);

    expect(mockJob.moveToDelayed).toHaveBeenCalled();
    expect(mockSequenceService.createForLead).not.toHaveBeenCalled();
  });

  it('skips gracefully if lead not found', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    await processor.process({ data: { leadId: 'missing' } } as any);
    expect(mockSequenceService.createForLead).not.toHaveBeenCalled();
  });
});
```

Run: `cd apps/api && npx jest test/lead-outreach.processor.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement LeadOutreachProcessor**

```typescript
// apps/api/src/modules/outreach/processors/lead-outreach.processor.ts
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadsRepository } from '../../leads/leads.repository';
import { LeadStatus, StepStatus } from '@prisma/client';
import { SequenceService } from '../sequence.service';
import { SendGridService } from '../sendgrid.service';
import { OutreachRepository } from '../outreach.repository';
import { QUEUES } from '../../../queue/queue.constants';
import { DAILY_EMAIL_LIMIT } from '../outreach.constants';
import { SEQUENCE_DAYS } from '../sequence.service';

interface OutreachJobData {
  leadId: string;
}

@Processor(QUEUES.OUTREACH)
export class LeadOutreachProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadOutreachProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsRepo: LeadsRepository,
    private readonly sequenceService: SequenceService,
    private readonly sendGrid: SendGridService,
    private readonly outreachRepo: OutreachRepository,
    @InjectQueue(QUEUES.FOLLOWUP) private readonly followupQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<OutreachJobData>): Promise<void> {
    const { leadId } = job.data;

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: true, company: true },
    });

    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found — skipping outreach`);
      return;
    }

    const sentToday = await this.outreachRepo.countSentToday(lead.tenantId);
    if (sentToday >= DAILY_EMAIL_LIMIT) {
      this.logger.warn(`Daily email limit reached (${sentToday}/${DAILY_EMAIL_LIMIT}) — rescheduling lead ${leadId}`);
      const msUntilTomorrow = this.msUntilTomorrowUtc();
      await job.moveToDelayed(Date.now() + msUntilTomorrow);
      return;
    }

    const result = await this.sequenceService.createForLead({
      leadId: lead.id,
      tenantId: lead.tenantId,
      priority: lead.priority!,
      contact: {
        firstName: lead.contact.firstName,
        lastName: lead.contact.lastName,
        email: lead.contact.email!,
        title: lead.contact.title,
      },
      company: {
        name: lead.company.name,
        industry: lead.company.industry,
        techStack: lead.company.techStack,
        location: lead.company.location,
        website: lead.company.website,
      },
    });

    if (result.firstStepNeedsApproval) {
      await this.leadsRepo.updateStatus(leadId, LeadStatus.OUTREACH_PENDING_APPROVAL);
      this.logger.log(`Lead ${leadId} awaiting approval — sequence ${result.sequenceId}`);
      return;
    }

    await this.sendStep(result.firstStepId, lead.contact.email!, leadId, result.sequenceId, lead.tenantId, lead.priority!);
  }

  async sendStep(
    stepId: string,
    toEmail: string,
    leadId: string,
    sequenceId: string,
    tenantId: string,
    priority: string,
  ): Promise<void> {
    const step = await this.outreachRepo.findStepById(stepId);
    if (!step || !step.subject || !step.body) {
      this.logger.error(`Step ${stepId} missing subject/body — cannot send`);
      return;
    }

    const messageId = await this.sendGrid.sendEmail({
      to: toEmail,
      leadId,
      subject: step.subject,
      body: step.body,
    });

    await this.outreachRepo.updateStep(stepId, {
      status: StepStatus.SENT,
      sentAt: new Date(),
      messageId,
    });

    await this.outreachRepo.updateSequence(sequenceId, { currentStep: step.stepNumber });
    await this.leadsRepo.updateStatus(leadId, LeadStatus.OUTREACH_SENT);

    // Schedule follow-up steps
    const days = SEQUENCE_DAYS[priority as 'HOT' | 'STANDARD'] ?? SEQUENCE_DAYS.STANDARD;
    for (let i = 1; i < days.length; i++) {
      const delayMs = (days[i] - days[0]) * 24 * 60 * 60 * 1000;
      await this.followupQueue.add(
        'send-followup',
        { sequenceId, stepNumber: i + 1, tenantId, leadId },
        { delay: delayMs },
      );
    }

    this.logger.log(`Lead ${leadId} — step 1 sent, ${days.length - 1} follow-ups scheduled`);
  }

  private msUntilTomorrowUtc(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return tomorrow.getTime() - now.getTime() + 60_000; // +1 min buffer
  }
}
```

- [ ] **Step 3: Run tests — must pass**

Run: `cd apps/api && npx jest test/lead-outreach.processor.spec.ts --no-coverage`
Expected: All 4 tests PASS

Note: The `sendStep` method on auto-approved path needs `findStepById` — add it to `mockOutreachRepo` in the test's `beforeEach`: `findStepById: jest.fn().mockResolvedValue({ id: 'step-1', subject: 'Hi', body: 'Hello', stepNumber: 1, sequence: { leadId: 'lead-1' } })`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/outreach/processors/lead-outreach.processor.ts apps/api/test/lead-outreach.processor.spec.ts
git commit -m "feat: add LeadOutreachProcessor with first-batch approval gate and daily limit"
```

---

## Task 7: Follow-up processor

**Files:**
- Create: `apps/api/src/modules/outreach/processors/lead-followup.processor.ts`
- Create: `apps/api/test/lead-followup.processor.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/lead-followup.processor.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LeadFollowupProcessor } from '../src/modules/outreach/processors/lead-followup.processor';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { OutreachService } from '../src/modules/outreach/outreach.service';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { QUEUES } from '../src/queue/queue.constants';

const mockOutreachRepo = {
  countSentToday: jest.fn(),
  findStepById: jest.fn(),
  findSequenceByLeadId: jest.fn(),
  updateStep: jest.fn(),
  updateSequence: jest.fn(),
};
const mockOutreachService = { generateFollowupEmail: jest.fn() };
const mockSendGrid = { sendEmail: jest.fn() };
const mockLeadsRepo = { updateStatus: jest.fn() };
const mockFollowupQueue = { add: jest.fn() };

const mockStep = {
  id: 'step-2',
  stepNumber: 2,
  status: 'PENDING',
  sequence: {
    id: 'seq-1',
    status: 'ACTIVE',
    sequenceType: 'HOT',
    lead: {
      id: 'lead-1',
      tenantId: 'org-1',
      contact: { email: 'alice@techstartup.io', firstName: 'Alice' },
      company: { name: 'TechStartup' },
    },
  },
};

describe('LeadFollowupProcessor', () => {
  let processor: LeadFollowupProcessor;

  beforeEach(async () => {
    // Fetch the step with full sequence context via findStepById
    mockOutreachRepo.findStepById.mockResolvedValue(mockStep);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadFollowupProcessor,
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: OutreachService, useValue: mockOutreachService },
        { provide: SendGridService, useValue: mockSendGrid },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: getQueueToken(QUEUES.FOLLOWUP), useValue: mockFollowupQueue },
      ],
    }).compile();
    processor = module.get(LeadFollowupProcessor);
    jest.clearAllMocks();
  });

  it('sends follow-up email when sequence is ACTIVE and under daily limit', async () => {
    mockOutreachRepo.findStepById.mockResolvedValue(mockStep);
    mockOutreachRepo.countSentToday.mockResolvedValue(10);
    mockOutreachService.generateFollowupEmail.mockResolvedValue({ subject: 'Re: Hi', body: 'Following up' });
    mockSendGrid.sendEmail.mockResolvedValue('msg-2');

    await processor.process({ data: { stepId: 'step-2' } } as any);

    expect(mockOutreachService.generateFollowupEmail).toHaveBeenCalledWith(
      expect.objectContaining({ stepNumber: 2, firstName: 'Alice', companyName: 'TechStartup' }),
    );
    expect(mockSendGrid.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@techstartup.io', leadId: 'lead-1' }),
    );
    expect(mockOutreachRepo.updateStep).toHaveBeenCalledWith('step-2', expect.objectContaining({ status: 'SENT' }));
  });

  it('skips and reschedules when daily limit reached', async () => {
    mockOutreachRepo.findStepById.mockResolvedValue(mockStep);
    mockOutreachRepo.countSentToday.mockResolvedValue(25);

    const mockJob = { data: { stepId: 'step-2' }, moveToDelayed: jest.fn() };
    await processor.process(mockJob as any);

    expect(mockJob.moveToDelayed).toHaveBeenCalled();
    expect(mockSendGrid.sendEmail).not.toHaveBeenCalled();
  });

  it('skips when sequence is not ACTIVE (e.g. STOPPED)', async () => {
    mockOutreachRepo.findStepById.mockResolvedValue({
      ...mockStep,
      sequence: { ...mockStep.sequence, status: 'STOPPED' },
    });

    await processor.process({ data: { stepId: 'step-2' } } as any);

    expect(mockSendGrid.sendEmail).not.toHaveBeenCalled();
  });

  it('marks sequence COMPLETED after last step', async () => {
    const lastStep = { ...mockStep, stepNumber: 4 }; // HOT has 4 steps
    mockOutreachRepo.findStepById.mockResolvedValue(lastStep);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockOutreachService.generateFollowupEmail.mockResolvedValue({ subject: 'Re: final', body: 'Last one' });
    mockSendGrid.sendEmail.mockResolvedValue('msg-4');

    await processor.process({ data: { stepId: 'step-4' } } as any);

    expect(mockOutreachRepo.updateSequence).toHaveBeenCalledWith(
      'seq-1',
      expect.objectContaining({ status: 'COMPLETED' }),
    );
    expect(mockFollowupQueue.add).not.toHaveBeenCalled();
  });
});
```

Run: `cd apps/api && npx jest test/lead-followup.processor.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement LeadFollowupProcessor**

The processor needs access to the step's `previousSubject` — it must look it up by querying step 1 of the sequence. Add `findFirstStepOfSequence` to `OutreachRepository` (already done in Task 2 addendum).

```typescript
// apps/api/src/modules/outreach/processors/lead-followup.processor.ts
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { LeadStatus, SequenceStatus, StepStatus } from '@prisma/client';
import { OutreachRepository } from '../outreach.repository';
import { OutreachService } from '../outreach.service';
import { SendGridService } from '../sendgrid.service';
import { LeadsRepository } from '../../leads/leads.repository';
import { QUEUES } from '../../../queue/queue.constants';
import { DAILY_EMAIL_LIMIT } from '../outreach.constants';
import { SEQUENCE_DAYS } from '../sequence.service';

interface FollowupJobData {
  stepId: string;
}

@Processor(QUEUES.FOLLOWUP)
export class LeadFollowupProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadFollowupProcessor.name);

  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly outreachService: OutreachService,
    private readonly sendGrid: SendGridService,
    private readonly leadsRepo: LeadsRepository,
    @InjectQueue(QUEUES.FOLLOWUP) private readonly followupQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<FollowupJobData>): Promise<void> {
    const { stepId } = job.data;

    const step = await this.outreachRepo.findStepById(stepId);
    if (!step) {
      this.logger.warn(`Step ${stepId} not found — skipping`);
      return;
    }

    if (step.sequence.status !== SequenceStatus.ACTIVE) {
      this.logger.log(`Sequence ${step.sequence.id} is ${step.sequence.status} — skipping step ${stepId}`);
      return;
    }

    const { lead } = step.sequence;
    const sentToday = await this.outreachRepo.countSentToday(lead.tenantId);
    if (sentToday >= DAILY_EMAIL_LIMIT) {
      this.logger.warn(`Daily limit reached — rescheduling step ${stepId}`);
      const msUntilTomorrow = this.msUntilTomorrowUtc();
      await job.moveToDelayed(Date.now() + msUntilTomorrow);
      return;
    }

    const step1 = await this.outreachRepo.findFirstStepOfSequence(step.sequence.id);
    const previousSubject = step1?.subject ?? 'our services';

    const email = await this.outreachService.generateFollowupEmail({
      firstName: lead.contact.firstName,
      companyName: lead.company.name,
      stepNumber: step.stepNumber,
      previousSubject,
    });

    const messageId = await this.sendGrid.sendEmail({
      to: lead.contact.email!,
      leadId: lead.id,
      subject: email.subject,
      body: email.body,
    });

    await this.outreachRepo.updateStep(stepId, {
      status: StepStatus.SENT,
      sentAt: new Date(),
      subject: email.subject,
      body: email.body,
      messageId,
    });

    await this.outreachRepo.updateSequence(step.sequence.id, { currentStep: step.stepNumber });

    const totalSteps = SEQUENCE_DAYS[step.sequence.sequenceType as 'HOT' | 'STANDARD']?.length ?? 4;
    if (step.stepNumber >= totalSteps) {
      await this.outreachRepo.updateSequence(step.sequence.id, { status: SequenceStatus.COMPLETED });
      this.logger.log(`Sequence ${step.sequence.id} completed for lead ${lead.id}`);
    }

    this.logger.log(`Lead ${lead.id} — step ${step.stepNumber} sent`);
  }

  private msUntilTomorrowUtc(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return tomorrow.getTime() - now.getTime() + 60_000;
  }
}
```

- [ ] **Step 3: Add `findFirstStepOfSequence` to OutreachRepository if not already present**

Append to `outreach.repository.ts`:
```typescript
async findFirstStepOfSequence(sequenceId: string): Promise<OutreachStep | null> {
  return this.prisma.outreachStep.findFirst({
    where: { sequenceId, stepNumber: 1 },
  });
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `cd apps/api && npx jest test/lead-followup.processor.spec.ts --no-coverage`
Expected: All 4 tests PASS

Note: The test mock for `findStepById` returns a step whose `sequence` has `lead.tenantId` embedded. Add `findFirstStepOfSequence` to `mockOutreachRepo` in the test's `beforeEach`:
```typescript
mockOutreachRepo.findFirstStepOfSequence = jest.fn().mockResolvedValue({ id: 'step-1', subject: 'Original subject' });
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/outreach/processors/lead-followup.processor.ts apps/api/test/lead-followup.processor.spec.ts
git commit -m "feat: add LeadFollowupProcessor for sequence steps 2-4"
```

---

## Task 8: Approval API

**Files:**
- Create: `apps/api/src/modules/approval/approval.service.ts`
- Create: `apps/api/src/modules/approval/approval.controller.ts`
- Create: `apps/api/src/modules/approval/approval.module.ts`
- Create: `apps/api/test/approval.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/approval.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../src/modules/approval/approval.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';
import { OutreachRepository as OR } from '../src/modules/outreach/outreach.repository';

const mockOutreachRepo = {
  findPendingApprovalSteps: jest.fn(),
  findStepById: jest.fn(),
  updateStep: jest.fn(),
  updateSequence: jest.fn(),
};
const mockLeadsRepo = { updateStatus: jest.fn() };
const mockSendGrid = { sendEmail: jest.fn() };
const mockFollowupQueue = { add: jest.fn() };

const approvalStep = {
  id: 'step-1',
  subject: 'Hello Alice',
  body: 'We help with React dev',
  stepNumber: 1,
  sequence: {
    id: 'seq-1',
    sequenceType: 'HOT',
    status: 'ACTIVE',
    lead: {
      id: 'lead-1',
      tenantId: 'org-1',
      contact: { firstName: 'Alice', lastName: 'Chen', email: 'alice@techstartup.io', title: 'CTO' },
      company: { name: 'TechStartup' },
    },
  },
};

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(async () => {
    const { getQueueToken } = await import('@nestjs/bullmq');
    const { QUEUES } = await import('../src/queue/queue.constants');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: SendGridService, useValue: mockSendGrid },
        { provide: getQueueToken(QUEUES.FOLLOWUP), useValue: mockFollowupQueue },
      ],
    }).compile();
    service = module.get(ApprovalService);
    jest.clearAllMocks();
  });

  describe('listPendingApprovals', () => {
    it('returns pending steps with lead details', async () => {
      mockOutreachRepo.findPendingApprovalSteps.mockResolvedValue([approvalStep]);
      const result = await service.listPendingApprovals('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].stepId).toBe('step-1');
      expect(result[0].contactEmail).toBe('alice@techstartup.io');
    });
  });

  describe('approve', () => {
    it('sends email, marks step SENT, updates lead OUTREACH_SENT', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(approvalStep);
      mockSendGrid.sendEmail.mockResolvedValue('msg-1');
      mockOutreachRepo.updateStep.mockResolvedValue(undefined);
      mockOutreachRepo.updateSequence.mockResolvedValue(undefined);
      mockLeadsRepo.updateStatus.mockResolvedValue(undefined);

      await service.approve('step-1', 'org-1');

      expect(mockSendGrid.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@techstartup.io', subject: 'Hello Alice' }),
      );
      expect(mockOutreachRepo.updateStep).toHaveBeenCalledWith(
        'step-1',
        expect.objectContaining({ status: 'SENT' }),
      );
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'OUTREACH_SENT');
    });

    it('throws NotFoundException when step not found', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(null);
      await expect(service.approve('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when tenantId does not match', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue({
        ...approvalStep,
        sequence: { ...approvalStep.sequence, lead: { ...approvalStep.sequence.lead, tenantId: 'other' } },
      });
      await expect(service.approve('step-1', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('marks step FAILED, stops sequence, disqualifies lead', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(approvalStep);

      await service.reject('step-1', 'org-1');

      expect(mockOutreachRepo.updateStep).toHaveBeenCalledWith('step-1', { status: 'FAILED' });
      expect(mockOutreachRepo.updateSequence).toHaveBeenCalledWith('seq-1', expect.objectContaining({ status: 'STOPPED' }));
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'DISQUALIFIED');
    });
  });
});
```

Run: `cd apps/api && npx jest test/approval.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement ApprovalService**

```typescript
// apps/api/src/modules/approval/approval.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LeadStatus, SequenceStatus, StepStatus } from '@prisma/client';
import { OutreachRepository } from '../outreach/outreach.repository';
import { LeadsRepository } from '../leads/leads.repository';
import { SendGridService } from '../outreach/sendgrid.service';
import { QUEUES } from '../../queue/queue.constants';
import { SEQUENCE_DAYS } from '../outreach/sequence.service';

export interface PendingApprovalDto {
  stepId: string;
  leadId: string;
  contactName: string;
  contactEmail: string;
  contactTitle: string | null;
  companyName: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly leadsRepo: LeadsRepository,
    private readonly sendGrid: SendGridService,
    @InjectQueue(QUEUES.FOLLOWUP) private readonly followupQueue: Queue,
  ) {}

  async listPendingApprovals(tenantId: string): Promise<PendingApprovalDto[]> {
    const steps = await this.outreachRepo.findPendingApprovalSteps(tenantId);
    return steps.map((step) => ({
      stepId: step.id,
      leadId: step.sequence.lead.id,
      contactName: `${step.sequence.lead.contact.firstName} ${step.sequence.lead.contact.lastName}`,
      contactEmail: step.sequence.lead.contact.email,
      contactTitle: step.sequence.lead.contact.title,
      companyName: step.sequence.lead.company.name,
      subject: step.subject ?? '',
      body: step.body ?? '',
      scheduledAt: step.scheduledAt,
    }));
  }

  async approve(stepId: string, tenantId: string): Promise<void> {
    const step = await this.outreachRepo.findStepById(stepId);
    if (!step || step.sequence.lead.tenantId !== tenantId) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }

    const { lead } = step.sequence;

    const messageId = await this.sendGrid.sendEmail({
      to: lead.contact.email!,
      leadId: lead.id,
      subject: step.subject!,
      body: step.body!,
    });

    await this.outreachRepo.updateStep(stepId, {
      status: StepStatus.SENT,
      sentAt: new Date(),
      messageId,
    });

    await this.outreachRepo.updateSequence(step.sequence.id, { currentStep: step.stepNumber });
    await this.leadsRepo.updateStatus(lead.id, LeadStatus.OUTREACH_SENT);

    // Schedule remaining follow-up steps
    const days = SEQUENCE_DAYS[step.sequence.sequenceType as 'HOT' | 'STANDARD'] ?? SEQUENCE_DAYS.STANDARD;
    for (let i = 1; i < days.length; i++) {
      const delayMs = (days[i] - days[0]) * 24 * 60 * 60 * 1000;
      // Find the step ids for the sequence — they are already created; we need to find them by stepNumber
      const allSteps = await this.outreachRepo.findPendingApprovalSteps(tenantId); // re-use helper? No, query PENDING steps
      // Better: query all PENDING steps for this sequence by stepNumber
      // Use a direct helper
    }

    this.logger.log(`Step ${stepId} approved and sent to ${lead.contact.email}`);
  }

  async reject(stepId: string, tenantId: string): Promise<void> {
    const step = await this.outreachRepo.findStepById(stepId);
    if (!step || step.sequence.lead.tenantId !== tenantId) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }

    await this.outreachRepo.updateStep(stepId, { status: StepStatus.FAILED });
    await this.outreachRepo.updateSequence(step.sequence.id, {
      status: SequenceStatus.STOPPED,
      stoppedAt: new Date(),
    });
    await this.leadsRepo.updateStatus(step.sequence.lead.id, LeadStatus.DISQUALIFIED);

    this.logger.log(`Step ${stepId} rejected — lead ${step.sequence.lead.id} disqualified`);
  }
}
```

**Note on follow-up scheduling in approve():** Add `findPendingStepsBySequenceId` to `OutreachRepository`:

```typescript
// Add to OutreachRepository
async findPendingStepsBySequenceId(sequenceId: string): Promise<OutreachStep[]> {
  return this.prisma.outreachStep.findMany({
    where: { sequenceId, status: StepStatus.PENDING },
    orderBy: { stepNumber: 'asc' },
  });
}
```

Then replace the follow-up loop in `approve()`:
```typescript
// After leadsRepo.updateStatus call, replace the todo loop with:
const pendingSteps = await this.outreachRepo.findPendingStepsBySequenceId(step.sequence.id);
const days = SEQUENCE_DAYS[step.sequence.sequenceType as 'HOT' | 'STANDARD'] ?? SEQUENCE_DAYS.STANDARD;
for (const pending of pendingSteps) {
  const dayOffset = days[pending.stepNumber - 1] ?? 0;
  const delayMs = dayOffset * 24 * 60 * 60 * 1000;
  await this.followupQueue.add(
    'send-followup',
    { stepId: pending.id },
    { delay: delayMs },
  );
}
```

- [ ] **Step 3: Implement ApprovalController**

```typescript
// apps/api/src/modules/approval/approval.controller.ts
import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  listPending(@Query('tenantId') tenantId: string) {
    return this.approvalService.listPendingApprovals(tenantId);
  }

  @Post(':stepId/approve')
  approve(@Param('stepId') stepId: string, @Query('tenantId') tenantId: string) {
    return this.approvalService.approve(stepId, tenantId);
  }

  @Post(':stepId/reject')
  reject(@Param('stepId') stepId: string, @Query('tenantId') tenantId: string) {
    return this.approvalService.reject(stepId, tenantId);
  }
}
```

- [ ] **Step 4: Implement ApprovalModule**

```typescript
// apps/api/src/modules/approval/approval.module.ts
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
```

- [ ] **Step 5: Run tests — must pass**

Run: `cd apps/api && npx jest test/approval.service.spec.ts --no-coverage`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/approval/ apps/api/test/approval.service.spec.ts
git commit -m "feat: add ApprovalController and ApprovalService for human approval queue"
```

---

## Task 9: Webhook handler (reply detection)

**Files:**
- Create: `apps/api/src/modules/webhooks/webhooks.service.ts`
- Create: `apps/api/src/modules/webhooks/webhooks.controller.ts`
- Create: `apps/api/src/modules/webhooks/webhooks.module.ts`
- Create: `apps/api/test/webhooks.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/webhooks.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { LeadsRepository } from '../src/modules/leads/leads.repository';

const mockOutreachRepo = {
  findStepByMessageId: jest.fn(),
  findSequenceByLeadId: jest.fn(),
  updateSequence: jest.fn(),
};
const mockLeadsRepo = { updateStatus: jest.fn() };

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
      ],
    }).compile();
    service = module.get(WebhooksService);
    jest.clearAllMocks();
  });

  describe('handleInboundEmail', () => {
    it('stops sequence and marks lead REPLIED when leadId extracted from To address', async () => {
      mockOutreachRepo.findSequenceByLeadId.mockResolvedValue({ id: 'seq-1', status: 'ACTIVE' });

      await service.handleInboundEmail({
        to: 'reply+lead-abc123@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Re: Hello',
        text: 'Thanks for reaching out',
        headers: '',
      });

      expect(mockOutreachRepo.findSequenceByLeadId).toHaveBeenCalledWith('lead-abc123', expect.any(String));
      expect(mockOutreachRepo.updateSequence).toHaveBeenCalledWith('seq-1', expect.objectContaining({ status: 'STOPPED' }));
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-abc123', 'REPLIED');
    });

    it('does nothing when To address does not match reply+ pattern', async () => {
      await service.handleInboundEmail({
        to: 'random@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Hi',
        text: 'Hello',
        headers: '',
      });

      expect(mockOutreachRepo.findSequenceByLeadId).not.toHaveBeenCalled();
    });

    it('does nothing when sequence already stopped', async () => {
      mockOutreachRepo.findSequenceByLeadId.mockResolvedValue({ id: 'seq-1', status: 'STOPPED' });

      await service.handleInboundEmail({
        to: 'reply+lead-abc123@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Re: Hi',
        text: 'No thanks',
        headers: '',
      });

      expect(mockOutreachRepo.updateSequence).not.toHaveBeenCalled();
      expect(mockLeadsRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('does nothing when no sequence found for leadId', async () => {
      mockOutreachRepo.findSequenceByLeadId.mockResolvedValue(null);

      await service.handleInboundEmail({
        to: 'reply+lead-abc123@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Re: Hi',
        text: '',
        headers: '',
      });

      expect(mockOutreachRepo.updateSequence).not.toHaveBeenCalled();
    });
  });
});
```

Run: `cd apps/api && npx jest test/webhooks.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement WebhooksService**

```typescript
// apps/api/src/modules/webhooks/webhooks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { LeadStatus, SequenceStatus } from '@prisma/client';
import { OutreachRepository } from '../outreach/outreach.repository';
import { LeadsRepository } from '../leads/leads.repository';

export interface InboundEmailPayload {
  to: string;
  from: string;
  subject: string;
  text: string;
  headers: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly REPLY_PLUS_REGEX = /reply\+([^@]+)@/;

  constructor(
    private readonly outreachRepo: OutreachRepository,
    private readonly leadsRepo: LeadsRepository,
  ) {}

  async handleInboundEmail(payload: InboundEmailPayload): Promise<void> {
    const match = this.REPLY_PLUS_REGEX.exec(payload.to);
    if (!match) {
      this.logger.log(`Inbound email to ${payload.to} — no reply+ pattern, ignoring`);
      return;
    }

    const leadId = match[1];
    // tenantId lookup: find sequence by leadId — sequence has tenantId
    const sequences = await this.outreachRepo['prisma'].outreachSequence.findMany({
      where: { leadId },
    });

    if (!sequences.length) {
      this.logger.warn(`No sequence for lead ${leadId} — ignoring reply`);
      return;
    }

    const sequence = sequences[0];

    // Use the public method signature with both params
    const seq = await this.outreachRepo.findSequenceByLeadId(leadId, sequence.tenantId);
    if (!seq || seq.status === SequenceStatus.STOPPED || seq.status === SequenceStatus.COMPLETED) {
      this.logger.log(`Sequence for lead ${leadId} already inactive — ignoring reply`);
      return;
    }

    await this.outreachRepo.updateSequence(seq.id, {
      status: SequenceStatus.STOPPED,
      stoppedAt: new Date(),
    });

    await this.leadsRepo.updateStatus(leadId, LeadStatus.REPLIED);
    this.logger.log(`Reply detected from ${payload.from} — lead ${leadId} marked REPLIED`);
  }
}
```

**Note:** `WebhooksService` accesses `outreachRepo['prisma']` for the initial lookup. To keep this clean, add a `findSequencesByLeadId` method to `OutreachRepository`:

```typescript
// Add to OutreachRepository
async findSequencesByLeadId(leadId: string): Promise<OutreachSequence[]> {
  return this.prisma.outreachSequence.findMany({ where: { leadId } });
}
```

Then update `WebhooksService` to use it:
```typescript
// Replace prisma direct access with:
const sequences = await this.outreachRepo.findSequencesByLeadId(leadId);
```

- [ ] **Step 3: Implement WebhooksController**

SendGrid Inbound Parse sends a `multipart/form-data` body. NestJS doesn't parse this by default — use `express.urlencoded` (already included) with raw body type. The easiest approach is to mark the controller as consuming `multipart/form-data` and accepting `any` body, then extract fields.

```typescript
// apps/api/src/modules/webhooks/webhooks.controller.ts
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('inbound-email')
  async handleInboundEmail(@Body() body: Record<string, string>) {
    this.logger.log(`Inbound email from ${body['from']} to ${body['to']}`);
    await this.webhooksService.handleInboundEmail({
      to: body['to'] ?? '',
      from: body['from'] ?? '',
      subject: body['subject'] ?? '',
      text: body['text'] ?? '',
      headers: body['headers'] ?? '',
    });
    return { ok: true };
  }
}
```

**Note:** For SendGrid Inbound Parse to work, the NestJS app must be configured to parse URL-encoded bodies (default in NestJS via Express). The `@Body()` decorator will receive the form fields as a flat object. No additional setup needed.

- [ ] **Step 4: Implement WebhooksModule**

```typescript
// apps/api/src/modules/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { OutreachModule } from '../outreach/outreach.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [OutreachModule, LeadsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
```

- [ ] **Step 5: Run tests — must pass**

Run: `cd apps/api && npx jest test/webhooks.service.spec.ts --no-coverage`
Expected: All 4 tests PASS

Note: The test mocks `findSequenceByLeadId` directly. After the `findSequencesByLeadId` refactor, update the test mock to add `findSequencesByLeadId: jest.fn().mockResolvedValue([{ id: 'seq-1', tenantId: 'org-1', status: 'ACTIVE' }])` and update `findSequenceByLeadId` mock accordingly.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/webhooks/ apps/api/test/webhooks.service.spec.ts
git commit -m "feat: add WebhooksModule for SendGrid inbound email reply detection"
```

---

## Task 10: Wire scoring processor → outreach queue

**Files:**
- Modify: `apps/api/src/modules/scoring/processors/lead-scoring.processor.ts`
- Modify: `apps/api/src/modules/scoring/scoring.module.ts`

- [ ] **Step 1: Update scoring processor to enqueue outreach job after scoring**

In `lead-scoring.processor.ts`:

1. Add `@InjectQueue(QUEUES.OUTREACH) private readonly outreachQueue: Queue` to the constructor
2. After the `this.leadsRepo.updateScore(...)` call, add:

```typescript
await this.outreachQueue.add('create-sequence', { leadId });
this.logger.log(`Lead ${leadId} scored — enqueued for outreach`);
```

Full updated constructor and imports:
```typescript
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadsRepository } from '../../leads/leads.repository';
import { ScoringService } from '../scoring.service';
import { QUEUES } from '../../../queue/queue.constants';
import { LeadScoringInput } from '../prompts/scoring.prompt';

// in class constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly leadsRepo: LeadsRepository,
  private readonly scoringService: ScoringService,
  @InjectQueue(QUEUES.OUTREACH) private readonly outreachQueue: Queue,
) {
  super();
}
```

- [ ] **Step 2: Update ScoringModule to import and register outreach queue**

```typescript
// apps/api/src/modules/scoring/scoring.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScoringService } from './scoring.service';
import { LeadScoringProcessor } from './processors/lead-scoring.processor';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.LEAD_SCORING },
      { name: QUEUES.OUTREACH },
    ),
    LeadsModule,
  ],
  providers: [ScoringService, LeadScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
```

- [ ] **Step 3: Update the scoring processor test to include the queue mock**

In `apps/api/test/scoring.service.spec.ts` (or whichever file tests the processor), add the outreach queue mock if it tests the processor. The scoring *service* tests don't need it. If there's a `lead-scoring.processor.spec.ts` test, add:
```typescript
{ provide: getQueueToken(QUEUES.OUTREACH), useValue: { add: jest.fn() } }
```

- [ ] **Step 4: Run all existing tests — must still pass**

Run: `cd apps/api && npx jest --no-coverage`
Expected: All previously passing tests still PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scoring/processors/lead-scoring.processor.ts apps/api/src/modules/scoring/scoring.module.ts
git commit -m "feat: enqueue lead-outreach job after scoring completes"
```

---

## Task 11: Register queues and wire all modules

**Files:**
- Modify: `apps/api/src/queue/queue.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/modules/outreach/outreach.module.ts`

- [ ] **Step 1: Create OutreachModule**

```typescript
// apps/api/src/modules/outreach/outreach.module.ts
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
```

- [ ] **Step 2: Register outreach and followup queues in QueueModule**

```typescript
// apps/api/src/queue/queue.module.ts — update registerQueue call
BullModule.registerQueue(
  { name: QUEUES.LEAD_DISCOVERY },
  { name: QUEUES.LEAD_SCORING },
  { name: QUEUES.OUTREACH },
  { name: QUEUES.FOLLOWUP },
),
```

- [ ] **Step 3: Update AppModule**

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
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Run full test suite**

Run: `cd apps/api && npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Build check**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/outreach/outreach.module.ts apps/api/src/queue/queue.module.ts apps/api/src/app.module.ts
git commit -m "feat: wire OutreachModule, ApprovalModule, WebhooksModule into app"
```

---

## Task 12: Frontend — Approval queue page

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/app/approvals/page.tsx`
- Create: `apps/web/src/app/approvals/actions.ts`

- [ ] **Step 1: Add approval API calls to api-client.ts**

Append to `apps/web/src/lib/api-client.ts`:

```typescript
export interface PendingApproval {
  stepId: string;
  leadId: string;
  contactName: string;
  contactEmail: string;
  contactTitle: string | null;
  companyName: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const res = await fetch(`${API_URL}/approvals?tenantId=${ORG_ID}`);
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json() as Promise<PendingApproval[]>;
}

export async function approveStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_URL}/approvals/${stepId}/approve?tenantId=${ORG_ID}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to approve step');
}

export async function rejectStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_URL}/approvals/${stepId}/reject?tenantId=${ORG_ID}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reject step');
}
```

Also add `NEXT_PUBLIC_ORG_ID=00000000-0000-0000-0000-000000000001` to `apps/web/.env.local`.

- [ ] **Step 2: Create server actions**

```typescript
// apps/web/src/app/approvals/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { approveStep, rejectStep } from '@/lib/api-client';

export async function approveAction(stepId: string) {
  await approveStep(stepId);
  revalidatePath('/approvals');
}

export async function rejectAction(stepId: string) {
  await rejectStep(stepId);
  revalidatePath('/approvals');
}
```

- [ ] **Step 3: Create approvals page**

```typescript
// apps/web/src/app/approvals/page.tsx
import { fetchPendingApprovals } from '@/lib/api-client';
import { approveAction, rejectAction } from './actions';

export default async function ApprovalsPage() {
  let approvals = [];
  try {
    approvals = await fetchPendingApprovals();
  } catch {
    // API not running during build — show empty state
  }

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <span className="text-sm text-gray-500">{approvals.length} pending</span>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-400">
          No emails pending approval
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((item) => (
            <div key={item.stepId} className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{item.contactName}</div>
                  <div className="text-sm text-gray-500">
                    {item.contactTitle ? `${item.contactTitle} · ` : ''}
                    {item.companyName} · {item.contactEmail}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={approveAction.bind(null, item.stepId)}>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      Approve &amp; Send
                    </button>
                  </form>
                  <form action={rejectAction.bind(null, item.stepId)}>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-gray-50 p-4 text-sm">
                <div className="font-medium mb-1">Subject: {item.subject}</div>
                <div className="whitespace-pre-wrap text-gray-700">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Add nav link to approvals**

In `apps/web/src/app/leads/page.tsx` (or global layout if it exists), add a nav link to `/approvals`. If there's a layout file, add it there; otherwise add a back-link at the top of the approvals page.

Check if `apps/web/src/app/layout.tsx` exists:
```bash
ls apps/web/src/app/layout.tsx
```

If it exists, add `<a href="/approvals">Approvals</a>` to the nav section. If not, add a simple nav header to `approvals/page.tsx` with links to `/leads` and `/approvals`.

- [ ] **Step 5: Test the build**

Run: `cd apps/web && npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api-client.ts apps/web/src/app/approvals/
git commit -m "feat: add approval queue page with approve/reject actions"
```

---

## Task 13: Frontend — Leads table sequence status

**Files:**
- Modify: `apps/web/src/app/leads/page.tsx`
- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: Extend Lead type to include sequence status**

In `apps/web/src/lib/api-client.ts`, update the `Lead` interface to include `status` (already present) and confirm `LeadStatus` covers the new outreach statuses (`OUTREACH_PENDING_APPROVAL`, `OUTREACH_SENT`, `REPLIED`). The type is already a `string` so no change needed — just verify.

- [ ] **Step 2: Add status badge to leads table**

In `apps/web/src/app/leads/page.tsx`, add a `Status` column to the table showing the lead's status with a color-coded badge:

```typescript
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-700',
    SCORING: 'bg-yellow-100 text-yellow-700',
    SCORED: 'bg-blue-100 text-blue-700',
    OUTREACH_PENDING_APPROVAL: 'bg-orange-100 text-orange-700',
    OUTREACH_APPROVED: 'bg-indigo-100 text-indigo-700',
    OUTREACH_SENT: 'bg-purple-100 text-purple-700',
    REPLIED: 'bg-green-100 text-green-700',
    MEETING_BOOKED: 'bg-teal-100 text-teal-700',
    DISQUALIFIED: 'bg-red-100 text-red-700',
    CONVERTED: 'bg-emerald-100 text-emerald-700',
  };
  const label = status.replace(/_/g, ' ');
  const cls = colors[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
```

Add this `StatusBadge` component to the leads page and insert a `Status` column in the table. For the existing table in `page.tsx`, add `<td className="px-4 py-3"><StatusBadge status={lead.status} /></td>` and a matching `<th>Status</th>` header.

- [ ] **Step 3: Build check**

Run: `cd apps/web && npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/leads/page.tsx
git commit -m "feat: add status badge to leads table showing outreach pipeline stage"
```

---

## Final wiring check

Before calling Phase 2 complete, verify:

- [ ] **Run full API test suite**

```bash
cd apps/api && npx jest --no-coverage
```
Expected: All tests PASS (18 from Phase 1 + new Phase 2 tests)

- [ ] **TypeScript build**

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```
Expected: No errors

- [ ] **End-to-end smoke test** (manual, requires running services)

1. Start API: `cd apps/api && npm run start:dev`
2. Trigger discovery → score a lead → verify status becomes `OUTREACH_PENDING_APPROVAL`
3. `GET http://localhost:3001/approvals?tenantId=00000000-0000-0000-0000-000000000001` → see pending step with email preview
4. `POST http://localhost:3001/approvals/{stepId}/approve?tenantId=...` → verify email sent via SendGrid, lead status → `OUTREACH_SENT`

- [ ] **Final commit tag**

```bash
git tag phase-2-complete
git push origin main --tags
```

---

## Environment setup notes

Before running tests that hit SendGrid, add to `apps/api/.env`:
```
SENDGRID_API_KEY=SG.your_actual_key
FROM_EMAIL=outreach@yourcompany.com
FROM_NAME=Sharad from Conversion.io
OUTREACH_DOMAIN=outreach.yourcompany.com
```

For SendGrid Inbound Parse:
1. In SendGrid dashboard → Settings → Inbound Parse → Add Host & URL
2. Hostname: `outreach.yourcompany.com`
3. URL: `https://your-api-url/webhooks/inbound-email`
4. Check "POST the raw, full MIME message"

For `SENDGRID_WEBHOOK_SECRET` (optional): configure SendGrid event webhook signing key for signature verification on the inbound endpoint. Can be added in Phase 3 hardening.
