# Phase 1 — Pipeline Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational pipeline — project scaffolding, full CRM schema, Apollo lead discovery, GPT-4o-mini lead scoring, CSV import fallback, and a minimal leads table UI.

**Architecture:** npm workspaces monorepo with `apps/api` (NestJS modular monolith) and `apps/web` (Next.js). PostgreSQL via Prisma, BullMQ queues via Upstash Redis. Lead discovery and scoring are decoupled BullMQ processors chained by events. Single-tenant for now; `tenant_id` UUID is in every table, seeded from a single Organization row.

**Tech Stack:** NestJS 10, Prisma 5, BullMQ 5, OpenAI SDK 4, Next.js 14 App Router, Tailwind CSS, ShadCN UI, TypeScript 5, Docker Compose (local dev), Supabase/Neon (PostgreSQL), Upstash Redis.

---

## File Map

```
lead-generator/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   ├── config/
│   │   │   │   └── config.module.ts          # @nestjs/config with Joi validation
│   │   │   ├── queue/
│   │   │   │   ├── queue.constants.ts         # queue name enum
│   │   │   │   └── queue.module.ts            # BullMQ shared module
│   │   │   └── modules/
│   │   │       ├── companies/
│   │   │       │   ├── companies.module.ts
│   │   │       │   ├── companies.service.ts
│   │   │       │   ├── companies.repository.ts
│   │   │       │   └── dto/
│   │   │       │       └── upsert-company.dto.ts
│   │   │       ├── contacts/
│   │   │       │   ├── contacts.module.ts
│   │   │       │   ├── contacts.service.ts
│   │   │       │   └── contacts.repository.ts
│   │   │       ├── leads/
│   │   │       │   ├── leads.module.ts
│   │   │       │   ├── leads.controller.ts
│   │   │       │   ├── leads.service.ts
│   │   │       │   ├── leads.repository.ts
│   │   │       │   └── dto/
│   │   │       │       ├── lead-filters.dto.ts
│   │   │       │       └── lead-response.dto.ts
│   │   │       ├── discovery/
│   │   │       │   ├── discovery.module.ts
│   │   │       │   ├── discovery.controller.ts
│   │   │       │   ├── discovery.service.ts
│   │   │       │   ├── processors/
│   │   │       │   │   └── lead-discovery.processor.ts
│   │   │       │   └── adapters/
│   │   │       │       ├── lead-source.adapter.ts    # interface
│   │   │       │       ├── apollo.adapter.ts
│   │   │       │       └── csv.adapter.ts
│   │   │       └── scoring/
│   │   │           ├── scoring.module.ts
│   │   │           ├── scoring.service.ts
│   │   │           ├── processors/
│   │   │           │   └── lead-scoring.processor.ts
│   │   │           └── prompts/
│   │   │               └── scoring.prompt.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── test/
│   │   │   ├── apollo.adapter.spec.ts
│   │   │   ├── scoring.service.spec.ts
│   │   │   └── discovery.service.spec.ts
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   └── leads/
│       │   │       └── page.tsx
│       │   ├── components/
│       │   │   └── leads/
│       │   │       ├── leads-table.tsx
│       │   │       └── score-badge.tsx
│       │   └── lib/
│       │       └── api-client.ts
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── package.json
├── docker-compose.yml
├── package.json                     # npm workspaces root
└── .env.example
```

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (workspace root)
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`

- [ ] **Step 1: Initialize workspace root**

```bash
cd /Users/sharadwankhade/Desktop/projects/lead-generator
npm init -y
```

- [ ] **Step 2: Write workspace root `package.json`**

```json
{
  "name": "lead-generator",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/api",
    "apps/web"
  ],
  "scripts": {
    "dev:api": "npm run dev --workspace=apps/api",
    "dev:web": "npm run dev --workspace=apps/web",
    "build:api": "npm run build --workspace=apps/api",
    "build:web": "npm run build --workspace=apps/web"
  }
}
```

- [ ] **Step 3: Scaffold NestJS API**

```bash
cd /Users/sharadwankhade/Desktop/projects/lead-generator
npx @nestjs/cli@latest new apps/api --package-manager npm --skip-git --strict
```

- [ ] **Step 4: Scaffold Next.js web app**

```bash
npx create-next-app@latest apps/web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --skip-install
```

Wait — the Next.js src dir should be used for consistency. Re-run with:

```bash
npx create-next-app@latest apps/web \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --skip-install
```

- [ ] **Step 5: Write `docker-compose.yml`**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: lead_generator
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  postgres_data:
```

- [ ] **Step 6: Write `.env.example`**

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lead_generator"

# Redis (local dev uses docker-compose, prod uses Upstash)
REDIS_URL="redis://localhost:6379"

# Apollo.io
APOLLO_API_KEY=""
APOLLO_BASE_URL="https://api.apollo.io/v1"

# OpenAI
OPENAI_API_KEY=""

# Anthropic (Claude Haiku — proposals only)
ANTHROPIC_API_KEY=""

# App
PORT=3001
NODE_ENV=development

# Organization (single tenant)
ORG_ID="00000000-0000-0000-0000-000000000001"
ORG_NAME="Your Company Name"

# SendGrid (Phase 2)
SENDGRID_API_KEY=""
SENDGRID_FROM_EMAIL=""
SENDGRID_FROM_NAME=""
```

- [ ] **Step 7: Start Docker services and verify**

```bash
docker compose up -d
docker compose ps
```

Expected: Both `postgres` and `redis` containers show `running`.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initialize monorepo with NestJS API and Next.js web app"
```

---

## Task 2: NestJS API Dependencies & Configuration

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/config/config.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Install API dependencies**

```bash
cd apps/api
npm install \
  @nestjs/config \
  @nestjs/bull \
  bullmq \
  @bull-board/nestjs \
  @bull-board/api \
  @bull-board/express \
  @prisma/client \
  prisma \
  openai \
  @anthropic-ai/sdk \
  axios \
  csv-parse \
  multer \
  joi \
  @nestjs/swagger \
  swagger-ui-express \
  class-validator \
  class-transformer

npm install -D \
  @types/multer \
  @types/node
```

- [ ] **Step 2: Write `apps/api/src/config/config.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        APOLLO_API_KEY: Joi.string().required(),
        OPENAI_API_KEY: Joi.string().required(),
        ANTHROPIC_API_KEY: Joi.string().required(),
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        ORG_ID: Joi.string().uuid().required(),
        ORG_NAME: Joi.string().required(),
      }),
    }),
  ],
})
export class ConfigModule {}
```

- [ ] **Step 3: Copy `.env.example` to `.env` inside `apps/api/` and fill values**

```bash
cp ../../.env.example .env
# Edit .env and fill in actual values
```

- [ ] **Step 4: Write `apps/api/src/queue/queue.constants.ts`**

```typescript
export const QUEUES = {
  LEAD_DISCOVERY: 'lead:discovery',
  LEAD_SCORING: 'lead:scoring',
  OUTREACH: 'lead:outreach',       // Phase 2
  FOLLOWUP: 'lead:followup',       // Phase 2
  MEETING: 'lead:meeting',         // Phase 3
  PROPOSAL: 'lead:proposal',       // Phase 3
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
```

- [ ] **Step 5: Write `apps/api/src/queue/queue.module.ts`**

```typescript
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
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [ ] **Step 6: Update `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { LeadsModule } from './modules/leads/leads.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ContactsModule } from './modules/contacts/contacts.module';

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
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Update `apps/api/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Lead Generator API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 8: Run API and verify it starts**

```bash
cd apps/api
npm run start:dev
```

Expected: `Application is running on: http://localhost:3001`

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ apps/api/package.json apps/api/package-lock.json
git commit -m "feat: configure NestJS modules, queues, and config validation"
```

---

## Task 3: Prisma Schema & Database Setup

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
cd apps/api
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  companies  Company[]
  contacts   Contact[]
  leads      Lead[]
  activities Activity[]
}

model Company {
  id            String   @id @default(uuid())
  tenantId      String
  apolloId      String?  @unique
  name          String
  website       String?
  industry      String?
  teamSize      String?
  fundingStage  String?
  fundingAmount Float?
  techStack     String[]
  location      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  organization Organization @relation(fields: [tenantId], references: [id])
  contacts     Contact[]
  leads        Lead[]

  @@index([tenantId])
  @@index([name])
}

model Contact {
  id          String   @id @default(uuid())
  tenantId    String
  companyId   String
  apolloId    String?  @unique
  firstName   String
  lastName    String
  email       String?
  linkedinUrl String?
  title       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  organization Organization @relation(fields: [tenantId], references: [id])
  company      Company      @relation(fields: [companyId], references: [id])
  leads        Lead[]

  @@index([tenantId])
  @@index([companyId])
  @@index([email])
}

model Lead {
  id            String     @id @default(uuid())
  tenantId      String
  contactId     String
  companyId     String
  status        LeadStatus @default(NEW)
  score         Int?
  priority      Priority?
  scoreReasons  String[]
  hiringSignals Json?
  source        String     @default("apollo")
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  organization  Organization  @relation(fields: [tenantId], references: [id])
  contact       Contact       @relation(fields: [contactId], references: [id])
  company       Company       @relation(fields: [companyId], references: [id])
  activities    Activity[]
  opportunities Opportunity[]
  meetings      Meeting[]
  sequences     OutreachSequence[]

  @@index([tenantId])
  @@index([status])
  @@index([priority])
}

enum LeadStatus {
  NEW
  SCORING
  SCORED
  OUTREACH_PENDING_APPROVAL
  OUTREACH_APPROVED
  OUTREACH_SENT
  REPLIED
  MEETING_BOOKED
  PROPOSAL_SENT
  CONVERTED
  DISQUALIFIED
}

enum Priority {
  HOT
  WARM
  COLD
}

model Activity {
  id           String       @id @default(uuid())
  tenantId     String
  leadId       String?
  type         ActivityType
  description  String
  metadata     Json?
  createdAt    DateTime     @default(now())

  organization Organization @relation(fields: [tenantId], references: [id])
  lead         Lead?        @relation(fields: [leadId], references: [id])

  @@index([tenantId])
  @@index([leadId])
}

enum ActivityType {
  LEAD_CREATED
  SCORE_CALCULATED
  EMAIL_SENT
  EMAIL_OPENED
  EMAIL_REPLIED
  MEETING_BOOKED
  MEETING_COMPLETED
  PROPOSAL_SENT
  NOTE_ADDED
  STATUS_CHANGED
}

model Opportunity {
  id          String           @id @default(uuid())
  tenantId    String
  leadId      String
  title       String
  value       Float?
  stage       OpportunityStage @default(DISCOVERY)
  closeDate   DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  lead      Lead       @relation(fields: [leadId], references: [id])
  proposals Proposal[]
  meetings  Meeting[]

  @@index([tenantId])
}

enum OpportunityStage {
  DISCOVERY
  PROPOSAL_SENT
  NEGOTIATION
  CLOSED_WON
  CLOSED_LOST
}

model Meeting {
  id            String        @id @default(uuid())
  tenantId      String
  leadId        String
  opportunityId String?
  calComEventId String?
  scheduledAt   DateTime
  durationMins  Int
  status        MeetingStatus @default(SCHEDULED)
  notes         String?
  createdAt     DateTime      @default(now())

  lead        Lead         @relation(fields: [leadId], references: [id])
  opportunity Opportunity? @relation(fields: [opportunityId], references: [id])

  @@index([tenantId])
}

enum MeetingStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  NO_SHOW
}

model Proposal {
  id            String         @id @default(uuid())
  tenantId      String
  opportunityId String
  title         String
  content       Json
  pdfUrl        String?
  status        ProposalStatus @default(DRAFT)
  sentAt        DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  opportunity Opportunity @relation(fields: [opportunityId], references: [id])

  @@index([tenantId])
}

enum ProposalStatus {
  DRAFT
  SENT
  VIEWED
  ACCEPTED
  REJECTED
}

model OutreachSequence {
  id           String         @id @default(uuid())
  tenantId     String
  leadId       String         @unique
  sequenceType String
  currentStep  Int            @default(0)
  status       SequenceStatus @default(ACTIVE)
  startedAt    DateTime       @default(now())
  stoppedAt    DateTime?

  lead  Lead           @relation(fields: [leadId], references: [id])
  steps OutreachStep[]

  @@index([tenantId])
  @@index([status])
}

enum SequenceStatus {
  ACTIVE
  PAUSED
  STOPPED
  COMPLETED
}

model OutreachStep {
  id         String     @id @default(uuid())
  sequenceId String
  stepNumber Int
  scheduledAt DateTime
  sentAt     DateTime?
  subject    String?
  body       String?
  status     StepStatus @default(PENDING)
  messageId  String?
  openedAt   DateTime?

  sequence OutreachSequence @relation(fields: [sequenceId], references: [id])

  @@index([sequenceId])
  @@index([scheduledAt])
}

enum StepStatus {
  PENDING
  PENDING_APPROVAL
  APPROVED
  SENT
  OPENED
  REPLIED
  BOUNCED
  FAILED
}

model CaseStudy {
  id        String   @id @default(uuid())
  tenantId  String
  title     String
  client    String
  industry  String?
  techStack String[]
  challenge String
  solution  String
  result    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

model RateCard {
  id             String   @id @default(uuid())
  tenantId       String
  role           String
  seniorityLevel String
  monthlyRate    Float
  hourlyRate     Float
  currency       String   @default("USD")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId])
}
```

- [ ] **Step 3: Write `apps/api/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgId = process.env.ORG_ID ?? '00000000-0000-0000-0000-000000000001';

  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: process.env.ORG_NAME ?? 'My Company',
    },
  });

  console.log(`Seeded organization: ${orgId}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Add seed script to `apps/api/package.json`**

Add under `"scripts"`:
```json
"prisma:seed": "ts-node prisma/seed.ts",
"prisma:migrate": "prisma migrate dev",
"prisma:generate": "prisma generate"
```

And add to `package.json` root level:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

- [ ] **Step 5: Run migration and seed**

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

Expected:
```
✔ Generated Prisma Client
✔ Running seed command...
Seeded organization: 00000000-0000-0000-0000-000000000001
```

- [ ] **Step 6: Write `apps/api/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- [ ] **Step 7: Write `apps/api/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 8: Verify schema in Prisma Studio**

```bash
cd apps/api
npx prisma studio
```

Expected: Browser opens, all tables visible with correct columns.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/ apps/api/src/prisma/
git commit -m "feat: add prisma schema with full CRM entity model and initial seed"
```

---

## Task 4: Companies & Contacts Modules

**Files:**
- Create: `apps/api/src/modules/companies/companies.repository.ts`
- Create: `apps/api/src/modules/companies/companies.service.ts`
- Create: `apps/api/src/modules/companies/dto/upsert-company.dto.ts`
- Create: `apps/api/src/modules/companies/companies.module.ts`
- Create: `apps/api/src/modules/contacts/contacts.repository.ts`
- Create: `apps/api/src/modules/contacts/contacts.service.ts`
- Create: `apps/api/src/modules/contacts/contacts.module.ts`

- [ ] **Step 1: Write `apps/api/src/modules/companies/dto/upsert-company.dto.ts`**

```typescript
export interface UpsertCompanyDto {
  tenantId: string;
  apolloId?: string;
  name: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  fundingStage?: string;
  fundingAmount?: number;
  techStack?: string[];
  location?: string;
}
```

- [ ] **Step 2: Write `apps/api/src/modules/companies/companies.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCompanyDto } from './dto/upsert-company.dto';
import { Company } from '@prisma/client';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByApolloId(dto: UpsertCompanyDto): Promise<Company> {
    if (dto.apolloId) {
      return this.prisma.company.upsert({
        where: { apolloId: dto.apolloId },
        update: {
          name: dto.name,
          website: dto.website,
          industry: dto.industry,
          teamSize: dto.teamSize,
          fundingStage: dto.fundingStage,
          fundingAmount: dto.fundingAmount,
          techStack: dto.techStack ?? [],
          location: dto.location,
        },
        create: {
          tenantId: dto.tenantId,
          apolloId: dto.apolloId,
          name: dto.name,
          website: dto.website,
          industry: dto.industry,
          teamSize: dto.teamSize,
          fundingStage: dto.fundingStage,
          fundingAmount: dto.fundingAmount,
          techStack: dto.techStack ?? [],
          location: dto.location,
        },
      });
    }

    return this.prisma.company.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name,
        website: dto.website,
        industry: dto.industry,
        teamSize: dto.teamSize,
        fundingStage: dto.fundingStage,
        fundingAmount: dto.fundingAmount,
        techStack: dto.techStack ?? [],
        location: dto.location,
      },
    });
  }

  async findByTenantId(tenantId: string): Promise<Company[]> {
    return this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

- [ ] **Step 3: Write `apps/api/src/modules/companies/companies.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { CompaniesRepository } from './companies.repository';
import { UpsertCompanyDto } from './dto/upsert-company.dto';
import { Company } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly repo: CompaniesRepository) {}

  upsert(dto: UpsertCompanyDto): Promise<Company> {
    return this.repo.upsertByApolloId(dto);
  }

  findAll(tenantId: string): Promise<Company[]> {
    return this.repo.findByTenantId(tenantId);
  }
}
```

- [ ] **Step 4: Write `apps/api/src/modules/companies/companies.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';

@Module({
  providers: [CompaniesRepository, CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
```

- [ ] **Step 5: Write `apps/api/src/modules/contacts/contacts.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Contact } from '@prisma/client';

export interface UpsertContactDto {
  tenantId: string;
  companyId: string;
  apolloId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
}

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByApolloId(dto: UpsertContactDto): Promise<Contact> {
    if (dto.apolloId) {
      return this.prisma.contact.upsert({
        where: { apolloId: dto.apolloId },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          linkedinUrl: dto.linkedinUrl,
          title: dto.title,
        },
        create: {
          tenantId: dto.tenantId,
          companyId: dto.companyId,
          apolloId: dto.apolloId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          linkedinUrl: dto.linkedinUrl,
          title: dto.title,
        },
      });
    }

    return this.prisma.contact.create({
      data: {
        tenantId: dto.tenantId,
        companyId: dto.companyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        linkedinUrl: dto.linkedinUrl,
        title: dto.title,
      },
    });
  }
}
```

- [ ] **Step 6: Write `apps/api/src/modules/contacts/contacts.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ContactsRepository, UpsertContactDto } from './contacts.repository';
import { Contact } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private readonly repo: ContactsRepository) {}

  upsert(dto: UpsertContactDto): Promise<Contact> {
    return this.repo.upsertByApolloId(dto);
  }
}
```

- [ ] **Step 7: Write `apps/api/src/modules/contacts/contacts.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';

@Module({
  providers: [ContactsRepository, ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/companies/ apps/api/src/modules/contacts/
git commit -m "feat: add Companies and Contacts modules with upsert-by-apollo-id pattern"
```

---

## Task 5: Leads Module

**Files:**
- Create: `apps/api/src/modules/leads/leads.repository.ts`
- Create: `apps/api/src/modules/leads/leads.service.ts`
- Create: `apps/api/src/modules/leads/leads.controller.ts`
- Create: `apps/api/src/modules/leads/dto/lead-filters.dto.ts`
- Create: `apps/api/src/modules/leads/leads.module.ts`
- Create: `apps/api/test/leads.repository.spec.ts`

- [ ] **Step 1: Write the failing test for LeadsRepository**

Create `apps/api/test/leads.repository.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { LeadStatus, Priority } from '@prisma/client';

describe('LeadsRepository', () => {
  let repo: LeadsRepository;
  let prisma: { lead: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      lead: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
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

    await repo.findAll({ tenantId: 'org-1', priority: Priority.HOT });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ priority: Priority.HOT }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api
npx jest test/leads.repository.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/modules/leads/leads.repository'`

- [ ] **Step 3: Write `apps/api/src/modules/leads/dto/lead-filters.dto.ts`**

```typescript
import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus, Priority } from '@prisma/client';

export class LeadFiltersDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [ ] **Step 4: Write `apps/api/src/modules/leads/leads.repository.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Lead, LeadStatus, Priority, Prisma } from '@prisma/client';
import { LeadFiltersDto } from './dto/lead-filters.dto';

export interface CreateLeadDto {
  tenantId: string;
  contactId: string;
  companyId: string;
  source: string;
  hiringSignals?: Prisma.InputJsonValue;
}

export interface UpdateLeadScoreDto {
  id: string;
  score: number;
  priority: Priority;
  scoreReasons: string[];
}

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    return this.prisma.lead.create({
      data: {
        tenantId: dto.tenantId,
        contactId: dto.contactId,
        companyId: dto.companyId,
        status: LeadStatus.NEW,
        source: dto.source,
        hiringSignals: dto.hiringSignals,
      },
    });
  }

  async findAll(
    filters: LeadFiltersDto & { tenantId: string },
  ): Promise<{ leads: Lead[]; total: number }> {
    const where: Prisma.LeadWhereInput = {
      tenantId: filters.tenantId,
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
    };

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: { contact: true, company: true },
        orderBy: { createdAt: 'desc' },
        skip: ((filters.page ?? 1) - 1) * (filters.limit ?? 20),
        take: filters.limit ?? 20,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { leads, total };
  }

  async findById(id: string, tenantId: string): Promise<Lead | null> {
    return this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: { contact: true, company: true, activities: true },
    });
  }

  async updateScore(dto: UpdateLeadScoreDto): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id: dto.id },
      data: {
        score: dto.score,
        priority: dto.priority,
        scoreReasons: dto.scoreReasons,
        status: LeadStatus.SCORED,
      },
    });
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    return this.prisma.lead.update({
      where: { id },
      data: { status },
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest test/leads.repository.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Write `apps/api/src/modules/leads/leads.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadsRepository, CreateLeadDto } from './leads.repository';
import { LeadFiltersDto } from './dto/lead-filters.dto';
import { Lead } from '@prisma/client';

@Injectable()
export class LeadsService {
  private readonly tenantId: string;

  constructor(
    private readonly repo: LeadsRepository,
    private readonly config: ConfigService,
  ) {
    this.tenantId = this.config.get<string>('ORG_ID')!;
  }

  create(dto: Omit<CreateLeadDto, 'tenantId'>): Promise<Lead> {
    return this.repo.create({ ...dto, tenantId: this.tenantId });
  }

  findAll(filters: LeadFiltersDto) {
    return this.repo.findAll({ ...filters, tenantId: this.tenantId });
  }

  async findById(id: string): Promise<Lead> {
    const lead = await this.repo.findById(id, this.tenantId);
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }
}
```

- [ ] **Step 7: Write `apps/api/src/modules/leads/leads.controller.ts`**

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { LeadFiltersDto } from './dto/lead-filters.dto';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List all leads with optional filters' })
  findAll(@Query() filters: LeadFiltersDto) {
    return this.leadsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead by ID' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }
}
```

- [ ] **Step 8: Write `apps/api/src/modules/leads/leads.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';

@Module({
  providers: [LeadsRepository, LeadsService],
  controllers: [LeadsController],
  exports: [LeadsService, LeadsRepository],
})
export class LeadsModule {}
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/leads/ apps/api/test/leads.repository.spec.ts
git commit -m "feat: add Leads module with repository, service, and GET endpoints"
```

---

## Task 6: Apollo Adapter

**Files:**
- Create: `apps/api/src/modules/discovery/adapters/lead-source.adapter.ts`
- Create: `apps/api/src/modules/discovery/adapters/apollo.adapter.ts`
- Create: `apps/api/test/apollo.adapter.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/apollo.adapter.spec.ts`:

```typescript
import { ApolloAdapter } from '../src/modules/discovery/adapters/apollo.adapter';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApolloAdapter', () => {
  let adapter: ApolloAdapter;

  beforeEach(() => {
    const config = {
      get: (key: string) => {
        const map: Record<string, string> = {
          APOLLO_API_KEY: 'test-key',
          APOLLO_BASE_URL: 'https://api.apollo.io/v1',
        };
        return map[key];
      },
    } as ConfigService;

    adapter = new ApolloAdapter(config);
  });

  it('searches people and returns normalized leads', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: {
        people: [
          {
            id: 'apollo-person-1',
            first_name: 'Jane',
            last_name: 'Doe',
            title: 'CTO',
            email: 'jane@acme.com',
            linkedin_url: 'https://linkedin.com/in/janedoe',
            organization: {
              id: 'apollo-org-1',
              name: 'Acme Corp',
              website_url: 'https://acme.com',
              industry: 'Software',
              estimated_num_employees: 50,
              funding_stage: 'Series A',
              technologies: [{ name: 'React' }, { name: 'Node.js' }],
              city: 'San Francisco',
              country: 'United States',
            },
          },
        ],
        pagination: { total_entries: 1 },
      },
    });

    const results = await adapter.searchLeads({ limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0].contact.firstName).toBe('Jane');
    expect(results[0].company.techStack).toContain('React');
    expect(results[0].company.location).toBe('San Francisco, United States');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest test/apollo.adapter.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Write `apps/api/src/modules/discovery/adapters/lead-source.adapter.ts`**

```typescript
export interface RawContact {
  apolloId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
}

export interface RawCompany {
  apolloId?: string;
  name: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  fundingStage?: string;
  fundingAmount?: number;
  techStack: string[];
  location?: string;
}

export interface RawLead {
  contact: RawContact;
  company: RawCompany;
  hiringSignals?: Record<string, unknown>;
  source: string;
}

export interface SearchOptions {
  limit: number;
  page?: number;
  titles?: string[];
  locations?: string[];
}

export interface LeadSourceAdapter {
  searchLeads(options: SearchOptions): Promise<RawLead[]>;
}
```

- [ ] **Step 4: Write `apps/api/src/modules/discovery/adapters/apollo.adapter.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  LeadSourceAdapter,
  RawLead,
  SearchOptions,
} from './lead-source.adapter';

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string | null;
  linkedin_url: string | null;
  organization: ApolloOrganization | null;
}

interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  funding_stage: string | null;
  technologies: { name: string }[];
  city: string | null;
  country: string | null;
}

@Injectable()
export class ApolloAdapter implements LeadSourceAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('APOLLO_API_KEY')!;
    this.baseUrl = this.config.get<string>('APOLLO_BASE_URL')!;
  }

  async searchLeads(options: SearchOptions): Promise<RawLead[]> {
    const response = await axios.post<{ people: ApolloPerson[] }>(
      `${this.baseUrl}/mixed_people/search`,
      {
        api_key: this.apiKey,
        page: options.page ?? 1,
        per_page: options.limit,
        person_titles: options.titles ?? [
          'CTO',
          'VP of Engineering',
          'Head of Engineering',
          'Engineering Manager',
          'Co-Founder',
          'Founder',
          'Technical Co-Founder',
        ],
        person_locations: options.locations ?? ['United States'],
        organization_num_employees_ranges: ['1,500'],
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    return response.data.people
      .filter((p) => p.organization !== null)
      .map((p) => this.normalize(p));
  }

  private normalize(person: ApolloPerson): RawLead {
    const org = person.organization!;
    const location = [org.city, org.country].filter(Boolean).join(', ');
    const teamSize = org.estimated_num_employees
      ? this.bucketTeamSize(org.estimated_num_employees)
      : undefined;

    return {
      source: 'apollo',
      contact: {
        apolloId: person.id,
        firstName: person.first_name,
        lastName: person.last_name,
        email: person.email ?? undefined,
        linkedinUrl: person.linkedin_url ?? undefined,
        title: person.title,
      },
      company: {
        apolloId: org.id,
        name: org.name,
        website: org.website_url ?? undefined,
        industry: org.industry ?? undefined,
        teamSize,
        fundingStage: org.funding_stage ?? undefined,
        techStack: org.technologies.map((t) => t.name),
        location: location || undefined,
      },
    };
  }

  private bucketTeamSize(n: number): string {
    if (n <= 10) return '1-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 500) return '201-500';
    return '500+';
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest test/apollo.adapter.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/discovery/adapters/ apps/api/test/apollo.adapter.spec.ts
git commit -m "feat: add Apollo adapter with people search and lead normalization"
```

---

## Task 7: CSV Import Adapter

**Files:**
- Create: `apps/api/src/modules/discovery/adapters/csv.adapter.ts`
- Create: `apps/api/test/csv.adapter.spec.ts`

The CSV format expected:
`firstName,lastName,email,title,companyName,website,industry,techStack,location`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/csv.adapter.spec.ts`:

```typescript
import { CsvAdapter } from '../src/modules/discovery/adapters/csv.adapter';

describe('CsvAdapter', () => {
  let adapter: CsvAdapter;

  beforeEach(() => {
    adapter = new CsvAdapter();
  });

  it('parses a CSV buffer into raw leads', async () => {
    const csv = Buffer.from(
      `firstName,lastName,email,title,companyName,website,industry,techStack,location
Jane,Doe,jane@acme.com,CTO,Acme Corp,https://acme.com,SaaS,"React,Node.js",San Francisco`,
    );

    const results = await adapter.parseBuffer(csv);

    expect(results).toHaveLength(1);
    expect(results[0].contact.firstName).toBe('Jane');
    expect(results[0].company.techStack).toEqual(['React', 'Node.js']);
  });

  it('skips rows with missing companyName', async () => {
    const csv = Buffer.from(
      `firstName,lastName,email,title,companyName,website,industry,techStack,location
Jane,Doe,jane@acme.com,CTO,,https://acme.com,SaaS,React,SF`,
    );

    const results = await adapter.parseBuffer(csv);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest test/csv.adapter.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write `apps/api/src/modules/discovery/adapters/csv.adapter.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { RawLead } from './lead-source.adapter';

interface CsvRow {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  companyName: string;
  website: string;
  industry: string;
  techStack: string;
  location: string;
}

@Injectable()
export class CsvAdapter {
  parseBuffer(buffer: Buffer): Promise<RawLead[]> {
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    const leads: RawLead[] = rows
      .filter((row) => row.companyName?.trim())
      .map((row) => ({
        source: 'csv',
        contact: {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email || undefined,
          title: row.title || undefined,
        },
        company: {
          name: row.companyName,
          website: row.website || undefined,
          industry: row.industry || undefined,
          techStack: row.techStack
            ? row.techStack.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          location: row.location || undefined,
        },
      }));

    return Promise.resolve(leads);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest test/csv.adapter.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/discovery/adapters/csv.adapter.ts apps/api/test/csv.adapter.spec.ts
git commit -m "feat: add CSV import adapter with column parsing and validation"
```

---

## Task 8: Lead Discovery Module (NestJS + BullMQ)

**Files:**
- Create: `apps/api/src/modules/discovery/discovery.service.ts`
- Create: `apps/api/src/modules/discovery/processors/lead-discovery.processor.ts`
- Create: `apps/api/src/modules/discovery/discovery.controller.ts`
- Create: `apps/api/src/modules/discovery/discovery.module.ts`
- Create: `apps/api/test/discovery.service.spec.ts`

- [ ] **Step 1: Write the failing test for DiscoveryService**

Create `apps/api/test/discovery.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { DiscoveryService } from '../src/modules/discovery/discovery.service';
import { CompaniesService } from '../src/modules/companies/companies.service';
import { ContactsService } from '../src/modules/contacts/contacts.service';
import { LeadsService } from '../src/modules/leads/leads.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../src/queue/queue.constants';
import { ApolloAdapter } from '../src/modules/discovery/adapters/apollo.adapter';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let apolloAdapter: { searchLeads: jest.Mock };
  let companiesService: { upsert: jest.Mock };
  let contactsService: { upsert: jest.Mock };
  let leadsService: { create: jest.Mock };
  let scoringQueue: { add: jest.Mock };

  beforeEach(async () => {
    apolloAdapter = { searchLeads: jest.fn() };
    companiesService = { upsert: jest.fn() };
    contactsService = { upsert: jest.fn() };
    leadsService = { create: jest.fn() };
    scoringQueue = { add: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: ApolloAdapter, useValue: apolloAdapter },
        { provide: CompaniesService, useValue: companiesService },
        { provide: ContactsService, useValue: contactsService },
        { provide: LeadsService, useValue: leadsService },
        { provide: getQueueToken(QUEUES.LEAD_SCORING), useValue: scoringQueue },
      ],
    }).compile();

    service = module.get(DiscoveryService);
  });

  it('discovers leads and enqueues scoring for each', async () => {
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
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest test/discovery.service.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write `apps/api/src/modules/discovery/discovery.service.ts`**

```typescript
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
    this.logger.log(`Starting discovery: limit=${options.limit}`);

    const rawLeads = await this.apolloAdapter.searchLeads({ limit: options.limit });
    let discovered = 0;

    for (const raw of rawLeads) {
      try {
        await this.saveAndEnqueue(raw, options.tenantId);
        discovered++;
      } catch (err) {
        this.logger.error(`Failed to save lead ${raw.contact.email}: ${err}`);
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
      hiringSignals: raw.hiringSignals,
    });

    await this.scoringQueue.add(
      'score-lead',
      { leadId: lead.id },
      { priority: 1 },
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest test/discovery.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Write `apps/api/src/modules/discovery/processors/lead-discovery.processor.ts`**

```typescript
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
```

- [ ] **Step 6: Write `apps/api/src/modules/discovery/discovery.controller.ts`**

```typescript
import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from './discovery.service';
import { QUEUES } from '../../queue/queue.constants';
import { IsInt, Min, Max } from 'class-validator';

class TriggerDiscoveryDto {
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 50;
}

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.LEAD_DISCOVERY) private readonly discoveryQueue: Queue,
  ) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Trigger Apollo lead discovery job' })
  async trigger(@Body() dto: TriggerDiscoveryDto) {
    const job = await this.discoveryQueue.add('discover', { limit: dto.limit });
    return { jobId: job.id, message: `Discovery job queued for ${dto.limit} leads` };
  }

  @Post('import/csv')
  @ApiOperation({ summary: 'Import leads from CSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('CSV file is required');
    const tenantId = this.config.get<string>('ORG_ID')!;
    const result = await this.discoveryService.importFromCsv(file.buffer, tenantId);
    return result;
  }
}
```

- [ ] **Step 7: Write `apps/api/src/modules/discovery/discovery.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { LeadDiscoveryProcessor } from './processors/lead-discovery.processor';
import { ApolloAdapter } from './adapters/apollo.adapter';
import { CsvAdapter } from './adapters/csv.adapter';
import { CompaniesModule } from '../companies/companies.module';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.LEAD_DISCOVERY },
      { name: QUEUES.LEAD_SCORING },
    ),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }), // 5MB max
    CompaniesModule,
    ContactsModule,
    LeadsModule,
  ],
  providers: [DiscoveryService, LeadDiscoveryProcessor, ApolloAdapter, CsvAdapter],
  controllers: [DiscoveryController],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/discovery/ apps/api/test/discovery.service.spec.ts
git commit -m "feat: add Lead Discovery module with Apollo + CSV adapters and BullMQ processor"
```

---

## Task 9: Lead Scoring Module

**Files:**
- Create: `apps/api/src/modules/scoring/prompts/scoring.prompt.ts`
- Create: `apps/api/src/modules/scoring/scoring.service.ts`
- Create: `apps/api/src/modules/scoring/processors/lead-scoring.processor.ts`
- Create: `apps/api/src/modules/scoring/scoring.module.ts`
- Create: `apps/api/test/scoring.service.spec.ts`

- [ ] **Step 1: Write failing test for ScoringService**

Create `apps/api/test/scoring.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ScoringService } from '../src/modules/scoring/scoring.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

jest.mock('openai');

describe('ScoringService', () => {
  let service: ScoringService;
  let mockOpenAI: { chat: { completions: { create: jest.Mock } } };

  beforeEach(async () => {
    mockOpenAI = {
      chat: { completions: { create: jest.fn() } },
    };
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockOpenAI as unknown as OpenAI,
    );

    const module = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: ConfigService,
          useValue: { get: () => 'test-key' },
        },
      ],
    }).compile();

    service = module.get(ScoringService);
  });

  it('returns HOT for a well-matched lead', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 85,
              priority: 'HOT',
              reasons: ['Hiring React developers', 'Series A funded', 'US-based SaaS'],
            }),
          },
        },
      ],
    });

    const result = await service.scoreLead({
      companyName: 'Acme',
      industry: 'SaaS',
      location: 'San Francisco, United States',
      teamSize: '11-50',
      fundingStage: 'Series A',
      fundingAmount: 5000000,
      techStack: ['React', 'Node.js'],
      hiringSignals: { roles: ['Senior React Developer'] },
      contactTitle: 'CTO',
    });

    expect(result.score).toBe(85);
    expect(result.priority).toBe('HOT');
    expect(result.reasons).toHaveLength(3);
  });

  it('throws if OpenAI returns invalid JSON', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });

    await expect(service.scoreLead({ companyName: 'X' } as never)).rejects.toThrow(
      'Invalid scoring response',
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest test/scoring.service.spec.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Write `apps/api/src/modules/scoring/prompts/scoring.prompt.ts`**

```typescript
export interface LeadScoringInput {
  companyName: string;
  industry?: string;
  location?: string;
  teamSize?: string;
  fundingStage?: string;
  fundingAmount?: number;
  techStack?: string[];
  hiringSignals?: Record<string, unknown>;
  contactTitle?: string;
}

export function buildScoringPrompt(input: LeadScoringInput): string {
  return `You are a lead scoring agent for an IT services company specializing in React.js, Next.js, Node.js, NestJS, and TypeScript development. The company provides dedicated development teams and custom software development to US startups and SaaS companies.

Score this prospect from 0 to 100 and classify as HOT (score >= 70), WARM (score 40-69), or COLD (score < 40).

SCORING CRITERIA (apply each that matches):
+25 points: Actively hiring React, Node.js, Next.js, or TypeScript developers
+20 points: Received funding in the last 6 months (Seed, Series A, Series B)
+15 points: SaaS company or product company
+15 points: US-based (United States)
+10 points: Team size 11-200 (sweet spot for outsourcing)
+10 points: Tech stack includes React, Node.js, Next.js, TypeScript, or MERN
-10 points: Team size > 500 (unlikely to need outsourcing)
-15 points: Non-tech industry (retail, food, manufacturing)
-20 points: No tech signals matching our stack

PROSPECT DATA:
Company: ${input.companyName}
Industry: ${input.industry ?? 'Unknown'}
Location: ${input.location ?? 'Unknown'}
Team Size: ${input.teamSize ?? 'Unknown'}
Funding Stage: ${input.fundingStage ?? 'Unknown'}
Funding Amount: ${input.fundingAmount ? `$${(input.fundingAmount / 1e6).toFixed(1)}M` : 'Unknown'}
Tech Stack: ${input.techStack?.join(', ') || 'Unknown'}
Hiring Signals: ${JSON.stringify(input.hiringSignals ?? {})}
Contact Title: ${input.contactTitle ?? 'Unknown'}

Respond with ONLY valid JSON — no markdown, no explanation:
{"score": <0-100>, "priority": "<HOT|WARM|COLD>", "reasons": ["<concise reason>", ...]}`;
}
```

- [ ] **Step 4: Write `apps/api/src/modules/scoring/scoring.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LeadScoringInput, buildScoringPrompt } from './prompts/scoring.prompt';
import { Priority } from '@prisma/client';

export interface ScoringResult {
  score: number;
  priority: Priority;
  reasons: string[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  async scoreLead(input: LeadScoringInput): Promise<ScoringResult> {
    const prompt = buildScoringPrompt(input);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content ?? '';

    try {
      const parsed = JSON.parse(content) as ScoringResult;

      if (
        typeof parsed.score !== 'number' ||
        !['HOT', 'WARM', 'COLD'].includes(parsed.priority) ||
        !Array.isArray(parsed.reasons)
      ) {
        throw new Error('Schema mismatch');
      }

      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        priority: parsed.priority,
        reasons: parsed.reasons,
      };
    } catch {
      this.logger.error(`Invalid scoring response: ${content}`);
      throw new Error('Invalid scoring response from AI');
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest test/scoring.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Write `apps/api/src/modules/scoring/processors/lead-scoring.processor.ts`**

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
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
      this.logger.warn(`Lead ${leadId} not found, skipping`);
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

    this.logger.log(
      `Scored lead ${leadId}: score=${result.score} priority=${result.priority}`,
    );
  }
}
```

- [ ] **Step 7: Write `apps/api/src/modules/scoring/scoring.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScoringService } from './scoring.service';
import { LeadScoringProcessor } from './processors/lead-scoring.processor';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.LEAD_SCORING }),
    LeadsModule,
  ],
  providers: [ScoringService, LeadScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
```

- [ ] **Step 8: Run all tests**

```bash
cd apps/api
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/scoring/ apps/api/test/scoring.service.spec.ts
git commit -m "feat: add Lead Scoring module with GPT-4o-mini and BullMQ processor"
```

---

## Task 10: Phase 1 Frontend — Leads Table

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/components/leads/score-badge.tsx`
- Create: `apps/web/src/components/leads/leads-table.tsx`
- Create: `apps/web/src/app/leads/page.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Install ShadCN UI in the web app**

```bash
cd apps/web
npx shadcn@latest init
# Choose: Default style, Slate base color, yes to CSS variables
npx shadcn@latest add table badge button card
```

- [ ] **Step 2: Write `apps/web/src/lib/api-client.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface Lead {
  id: string;
  status: string;
  score: number | null;
  priority: 'HOT' | 'WARM' | 'COLD' | null;
  scoreReasons: string[];
  source: string;
  createdAt: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string | null;
    title: string | null;
  };
  company: {
    name: string;
    website: string | null;
    industry: string | null;
    techStack: string[];
    location: string | null;
  };
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
}

export async function fetchLeads(params?: {
  page?: number;
  limit?: number;
  priority?: string;
  status?: string;
}): Promise<LeadsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.priority) query.set('priority', params.priority);
  if (params?.status) query.set('status', params.status);

  const res = await fetch(`${API_BASE}/leads?${query}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json();
}

export async function triggerDiscovery(limit = 50): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/discovery/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
  if (!res.ok) throw new Error('Failed to trigger discovery');
  return res.json();
}
```

- [ ] **Step 3: Write `apps/web/src/components/leads/score-badge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge';

interface ScoreBadgeProps {
  score: number | null;
  priority: 'HOT' | 'WARM' | 'COLD' | null;
}

const priorityConfig = {
  HOT: { label: 'HOT', className: 'bg-red-100 text-red-800 border-red-200' },
  WARM: { label: 'WARM', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  COLD: { label: 'COLD', className: 'bg-blue-100 text-blue-800 border-blue-200' },
};

export function ScoreBadge({ score, priority }: ScoreBadgeProps) {
  if (!priority || score === null) {
    return <Badge variant="outline" className="text-gray-400">Pending</Badge>;
  }

  const config = priorityConfig[priority];

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={config.className}>{config.label}</Badge>
      <span className="text-sm font-mono text-gray-600">{score}</span>
    </div>
  );
}
```

- [ ] **Step 4: Write `apps/web/src/components/leads/leads-table.tsx`**

```tsx
'use client';

import { Lead } from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScoreBadge } from './score-badge';
import { Badge } from '@/components/ui/badge';

interface LeadsTableProps {
  leads: Lead[];
}

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No leads yet. Trigger a discovery run to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Industry</TableHead>
          <TableHead>Tech Stack</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>
              <div>
                <p className="font-medium">
                  {lead.contact.firstName} {lead.contact.lastName}
                </p>
                <p className="text-sm text-gray-500">{lead.contact.title}</p>
                {lead.contact.email && (
                  <p className="text-xs text-gray-400">{lead.contact.email}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{lead.company.name}</p>
                {lead.company.location && (
                  <p className="text-xs text-gray-500">{lead.company.location}</p>
                )}
              </div>
            </TableCell>
            <TableCell>{lead.company.industry ?? '—'}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {lead.company.techStack.slice(0, 3).map((tech) => (
                  <Badge key={tech} variant="secondary" className="text-xs">
                    {tech}
                  </Badge>
                ))}
                {lead.company.techStack.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{lead.company.techStack.length - 3}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <ScoreBadge score={lead.score} priority={lead.priority} />
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs capitalize">
                {lead.status.toLowerCase().replace(/_/g, ' ')}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-gray-500 capitalize">
              {lead.source}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: Write `apps/web/src/app/leads/page.tsx`**

```tsx
import { fetchLeads, triggerDiscovery } from '@/lib/api-client';
import { LeadsTable } from '@/components/leads/leads-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { revalidatePath } from 'next/cache';

async function TriggerDiscoveryButton() {
  async function handleTrigger() {
    'use server';
    await triggerDiscovery(50);
    revalidatePath('/leads');
  }

  return (
    <form action={handleTrigger}>
      <Button type="submit">Run Discovery (50 leads)</Button>
    </form>
  );
}

export default async function LeadsPage() {
  const { leads, total } = await fetchLeads({ limit: 50 });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-gray-500">{total} total leads discovered</p>
        </div>
        <TriggerDiscoveryButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsTable leads={leads} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/.env.local`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

- [ ] **Step 7: Start both servers and verify the leads page renders**

Terminal 1:
```bash
cd apps/api && npm run start:dev
```

Terminal 2:
```bash
cd apps/web && npm run dev
```

Open `http://localhost:3000/leads`. Expected: Leads table renders with "No leads yet" empty state and a "Run Discovery" button.

- [ ] **Step 8: Commit**

```bash
git add apps/web/
git commit -m "feat: add Phase 1 frontend with leads table, score badge, and discovery trigger"
```

---

## Task 11: End-to-End Smoke Test

- [ ] **Step 1: Add a CSV test fixture**

Create `apps/api/test/fixtures/sample-leads.csv`:

```csv
firstName,lastName,email,title,companyName,website,industry,techStack,location
Alice,Chen,alice@techstartup.io,CTO,TechStartup Inc,https://techstartup.io,SaaS,"React,Node.js,TypeScript",Austin TX
Bob,Smith,bob@growthapp.com,VP Engineering,GrowthApp,https://growthapp.com,SaaS,"Next.js,PostgreSQL",San Francisco CA
```

- [ ] **Step 2: Test CSV import via the API**

```bash
curl -X POST http://localhost:3001/api/v1/discovery/import/csv \
  -F "file=@apps/api/test/fixtures/sample-leads.csv"
```

Expected response:
```json
{ "imported": 2 }
```

- [ ] **Step 3: Verify leads appear in the database**

```bash
cd apps/api
npx prisma studio
```

Check: `Lead` table has 2 rows with `status: NEW`. After a few seconds (BullMQ processes the scoring job), status should update to `SCORED` with a score and priority.

- [ ] **Step 4: Verify leads appear in the frontend**

Open `http://localhost:3000/leads`. Expected: 2 leads visible in the table with scores and HOT/WARM/COLD badges.

- [ ] **Step 5: Final commit**

```bash
git add apps/api/test/fixtures/
git commit -m "test: add CSV fixture for end-to-end smoke test"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Covered in Task |
|---|---|
| Apollo as primary lead source | Task 6 (ApolloAdapter) |
| CSV import fallback | Task 7 (CsvAdapter) |
| Lead scoring 0-100 with HOT/WARM/COLD | Task 9 (ScoringService) |
| Scoring criteria (React hiring, funding, US-based, SaaS) | Task 9 (scoring.prompt.ts) |
| BullMQ queue chaining discovery → scoring | Task 8 (DiscoveryService.saveAndEnqueue) |
| CRM schema (Companies, Contacts, Leads, Activities, Opportunities, Meetings, Proposals) | Task 3 |
| Leads list API with filters | Task 5 (LeadsController) |
| Frontend leads table | Task 10 |
| Score badge UI | Task 10 (ScoreBadge) |
| Trigger discovery from UI | Task 10 (TriggerDiscoveryButton) |
| tenant_id on all tables | Task 3 (schema.prisma) |
| 50 leads/day rate limit | Configured in BullMQ defaultJobOptions (attempts) — **GAP: daily rate limiter not implemented** |

### Gap: Daily Rate Limiter

The spec requires max 50 leads/day. This is not yet enforced. Add the following to `DiscoveryController.trigger`:

```typescript
// Add to discovery.controller.ts — check today's count before queuing
async trigger(@Body() dto: TriggerDiscoveryDto) {
  const todayCount = await this.prisma.lead.count({
    where: {
      tenantId: this.config.get('ORG_ID'),
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

  if (todayCount + dto.limit > 50) {
    throw new BadRequestException(
      `Daily limit reached: ${todayCount} leads created today (max 50)`,
    );
  }

  const job = await this.discoveryQueue.add('discover', { limit: dto.limit });
  return { jobId: job.id, message: `Discovery job queued for ${dto.limit} leads` };
}
```

Add `PrismaService` injection to `DiscoveryController` constructor to support this.

---

## Phase 2 & 3 Notes

This plan covers **Phase 1 only**. Two additional plans are needed:

- **`2026-06-09-phase2-outreach-engine.md`** — SendGrid integration, email generation (GPT-4o-mini), HOT/STANDARD sequence templates, BullMQ delayed jobs, human approval checkpoint, reply detection (SendGrid Inbound Parse webhook)
- **`2026-06-09-phase3-closing-layer.md`** — Cal.com meeting booking, proposal generator (Claude Haiku + Puppeteer PDF), case study/rate card admin, analytics dashboard

These should be created after Phase 1 is shipped and tested.
