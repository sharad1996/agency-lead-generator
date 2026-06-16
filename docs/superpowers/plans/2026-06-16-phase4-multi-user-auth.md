# Phase 4: Multi-User Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth login via Next-Auth, persist users with ADMIN/MEMBER roles, protect all NestJS API endpoints with a JWT guard, and add an admin Users page for role management.

**Architecture:** Next-Auth handles Google OAuth and issues HS256 JWTs (custom encode/decode overrides Next-Auth's default JWE). NestJS adds a global `JwtGuard` that validates the same `NEXTAUTH_SECRET`. On first sign-in, Next-Auth's `jwt` callback calls `POST /users/upsert` to create the user record and embeds `{ userId, role }` into the JWT. All existing api-client.ts calls are updated to read the session cookie and pass it as `Authorization: Bearer`. Webhooks and `/users/upsert` are marked `@Public()` to skip the guard.

**Tech Stack:** NestJS 11, `@nestjs/passport`, `passport-jwt`, `@nestjs/jwt`, Next.js 14 App Router, `next-auth` v4, `jose` (already a next-auth transitive dep), Prisma 7, ShadCN UI

---

## File Map

**New API files:**
- `apps/api/src/modules/auth/public.decorator.ts` — `@Public()` metadata decorator
- `apps/api/src/modules/auth/roles.decorator.ts` — `@Roles('ADMIN')` metadata decorator
- `apps/api/src/modules/auth/jwt.strategy.ts` — Passport JWT strategy; validates HS256 JWT with `NEXTAUTH_SECRET`
- `apps/api/src/modules/auth/jwt.guard.ts` — global guard; skips `@Public()` endpoints
- `apps/api/src/modules/auth/roles.guard.ts` — checks `request.user.role` against `@Roles()` metadata
- `apps/api/src/modules/auth/auth.module.ts` — wires PassportModule + JwtModule
- `apps/api/src/modules/users/dto/upsert-user.dto.ts`
- `apps/api/src/modules/users/dto/update-role.dto.ts`
- `apps/api/src/modules/users/users.repository.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/test/users.service.spec.ts`

**Modified API files:**
- `apps/api/src/config/config.module.ts` — add `NEXTAUTH_SECRET`, `INTERNAL_API_SECRET`, `ADMIN_EMAIL`
- `apps/api/src/app.module.ts` — import AuthModule, UsersModule; register APP_GUARD for JwtGuard + RolesGuard
- `apps/api/src/modules/webhooks/webhooks.controller.ts` — add `@Public()` to class
- `apps/api/src/modules/meetings/meetings.controller.ts` — add `@Public()` to class
- `apps/api/.env.example` — add new vars

**New Web files:**
- `apps/web/src/lib/auth.ts` — Next-Auth `authOptions` (shared between API route and server components)
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` — Next-Auth handler
- `apps/web/src/types/next-auth.d.ts` — extend Session + JWT types with `userId` and `role`
- `apps/web/src/middleware.ts` — protect all routes except `/login` and `/api/auth/*`
- `apps/web/src/app/login/page.tsx` — Google sign-in button
- `apps/web/src/app/admin/users/page.tsx` — users table (admin only)
- `apps/web/src/app/admin/users/actions.ts` — Server Action: `updateUserRole`
- `apps/web/src/app/admin/users/role-selector.tsx` — client component: role dropdown with `useTransition`

**Modified Web files:**
- `apps/web/src/lib/api-client.ts` — add `getAuthHeaders()` helper; update all fetch calls
- `apps/web/src/app/layout.tsx` — show Users nav link for admin role

---

## Task 1: Install packages and update config

**Files:**
- Modify: `apps/api/src/config/config.module.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Install API auth packages**

```bash
cd apps/api && npm install @nestjs/passport passport passport-jwt @nestjs/jwt && npm install --save-dev @types/passport-jwt
```

Expected: packages added to `apps/api/package.json`.

- [ ] **Step 2: Install web auth package**

```bash
cd apps/web && npm install next-auth
```

Expected: `next-auth` added to `apps/web/package.json`.

- [ ] **Step 3: Update config validation schema**

In `apps/api/src/config/config.module.ts`, add three new vars to the `Joi.object({...})`:

```typescript
NEXTAUTH_SECRET: Joi.string().required(),
INTERNAL_API_SECRET: Joi.string().required(),
ADMIN_EMAIL: Joi.string().email().required(),
```

Full updated file:

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
        SENDGRID_API_KEY: Joi.string().required(),
        FROM_EMAIL: Joi.string().email().required(),
        FROM_NAME: Joi.string().required(),
        OUTREACH_DOMAIN: Joi.string().required(),
        SENDGRID_WEBHOOK_SECRET: Joi.string().optional(),
        CAL_COM_WEBHOOK_SECRET: Joi.string().optional(),
        NEXTAUTH_SECRET: Joi.string().required(),
        INTERNAL_API_SECRET: Joi.string().required(),
        ADMIN_EMAIL: Joi.string().email().required(),
        PORT: Joi.number().default(3001),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        ORG_ID: Joi.string().uuid().required(),
        ORG_NAME: Joi.string().required(),
      }),
    }),
  ],
})
export class ConfigModule {}
```

- [ ] **Step 4: Update .env.example**

Add to `apps/api/.env.example`:

```
NEXTAUTH_SECRET=your_32_char_random_secret_here
INTERNAL_API_SECRET=your_32_char_internal_secret_here
ADMIN_EMAIL=sharad@conversion.io
```

Add to your local `apps/api/.env` — generate values with:
```bash
openssl rand -base64 32
```

- [ ] **Step 5: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/config.module.ts apps/api/.env.example apps/api/package.json apps/api/package-lock.json apps/web/package.json apps/web/package-lock.json
git commit -m "feat: install auth packages and add NEXTAUTH_SECRET, INTERNAL_API_SECRET, ADMIN_EMAIL config"
```

---

## Task 2: Prisma migration — add User model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add UserRole enum and User model to schema**

Add the following to `apps/api/prisma/schema.prisma` (after the existing enums, before or after `RateCard`):

```prisma
enum UserRole {
  ADMIN
  MEMBER
}

model User {
  id        String   @id @default(uuid())
  tenantId  String
  email     String   @unique
  name      String?
  googleId  String   @unique
  role      UserRole @default(MEMBER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

- [ ] **Step 2: Add users relation to Organization model**

In the `Organization` model, add:

```prisma
users        User[]
```

The updated `Organization` model should look like:

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  companies    Company[]
  contacts     Contact[]
  leads        Lead[]
  activities   Activity[]
  opportunities Opportunity[]
  meetings     Meeting[]
  proposals    Proposal[]
  sequences    OutreachSequence[]
  caseStudies  CaseStudy[]
  rateCards    RateCard[]
  users        User[]
}
```

- [ ] **Step 3: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add-user-model
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 4: Verify Prisma client has User type**

```bash
cd apps/api && node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.user);"
```

Expected: `object`

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add User model with UserRole enum to Prisma schema"
```

---

## Task 3: Auth decorators, guards, and AuthModule

**Files:**
- Create: `apps/api/src/modules/auth/public.decorator.ts`
- Create: `apps/api/src/modules/auth/roles.decorator.ts`
- Create: `apps/api/src/modules/auth/jwt.strategy.ts`
- Create: `apps/api/src/modules/auth/jwt.guard.ts`
- Create: `apps/api/src/modules/auth/roles.guard.ts`
- Create: `apps/api/src/modules/auth/auth.module.ts`

- [ ] **Step 1: Create @Public() decorator**

```typescript
// apps/api/src/modules/auth/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Create @Roles() decorator**

```typescript
// apps/api/src/modules/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 3: Create JwtStrategy**

```typescript
// apps/api/src/modules/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('NEXTAUTH_SECRET')!,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
```

- [ ] **Step 4: Create JwtGuard**

```typescript
// apps/api/src/modules/auth/jwt.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 5: Create RolesGuard**

```typescript
// apps/api/src/modules/auth/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return requiredRoles.some((role) => user?.role === role);
  }
}
```

- [ ] **Step 6: Create AuthModule**

```typescript
// apps/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('NEXTAUTH_SECRET'),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  providers: [JwtStrategy, JwtGuard, RolesGuard],
  exports: [JwtGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 7: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/auth/
git commit -m "feat: add JWT auth guards, decorators, and AuthModule"
```

---

## Task 4: UsersRepository

**Files:**
- Create: `apps/api/src/modules/users/users.repository.ts`
- Create: `apps/api/test/users.repository.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/users.repository.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { UsersRepository } from '../src/modules/users/users.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockPrisma = {
  user: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockUser = {
  id: 'user-1',
  tenantId: 'org-1',
  email: 'alice@example.com',
  name: 'Alice Chen',
  googleId: '123456',
  role: UserRole.MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    repo = module.get(UsersRepository);
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    it('creates a new user when none exists', async () => {
      mockPrisma.user.upsert.mockResolvedValue(mockUser);

      const result = await repo.upsert({
        tenantId: 'org-1',
        email: 'alice@example.com',
        name: 'Alice Chen',
        googleId: '123456',
        role: UserRole.MEMBER,
      });

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'alice@example.com' },
          create: expect.objectContaining({ email: 'alice@example.com', role: UserRole.MEMBER }),
          update: { name: 'Alice Chen' },
        }),
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('returns all users for tenant ordered by createdAt', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      const result = await repo.findAll('org-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'org-1' } }),
      );
    });
  });

  describe('updateRole', () => {
    it('updates user role by id', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });
      const result = await repo.updateRole('user-1', UserRole.ADMIN);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.ADMIN },
      });
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });
});
```

Run: `cd apps/api && npx jest test/users.repository.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement UsersRepository**

```typescript
// apps/api/src/modules/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertUserDto {
  tenantId: string;
  email: string;
  name?: string | null;
  googleId: string;
  role: UserRole;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertUserDto): Promise<User> {
    return this.prisma.user.upsert({
      where: { email: dto.email },
      create: {
        tenantId: dto.tenantId,
        email: dto.email,
        name: dto.name,
        googleId: dto.googleId,
        role: dto.role,
      },
      update: { name: dto.name ?? undefined },
    });
  }

  async findAll(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }
}
```

- [ ] **Step 3: Run tests — must pass**

```bash
cd apps/api && npx jest test/users.repository.spec.ts --no-coverage
```

Expected: All 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/users/users.repository.ts apps/api/test/users.repository.spec.ts
git commit -m "feat: add UsersRepository with upsert, findAll, updateRole"
```

---

## Task 5: UsersService

**Files:**
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/test/users.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/test/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';
import { UsersRepository } from '../src/modules/users/users.repository';

const mockRepo = {
  upsert: jest.fn(),
  findAll: jest.fn(),
  updateRole: jest.fn(),
};

const configMock = {
  get: (k: string) => {
    if (k === 'ADMIN_EMAIL') return 'admin@example.com';
    if (k === 'ORG_ID') return 'org-1';
    return undefined;
  },
};

const baseUser = {
  id: 'user-1',
  tenantId: 'org-1',
  email: 'user@example.com',
  name: 'Test User',
  googleId: 'gid-1',
  role: UserRole.MEMBER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepo },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('upsertOnSignIn', () => {
    it('creates ADMIN when email matches ADMIN_EMAIL', async () => {
      mockRepo.upsert.mockResolvedValue({ ...baseUser, email: 'admin@example.com', role: UserRole.ADMIN });

      const result = await service.upsertOnSignIn({
        email: 'admin@example.com',
        name: 'Admin User',
        googleId: 'gid-admin',
      });

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('creates MEMBER for unknown email', async () => {
      mockRepo.upsert.mockResolvedValue(baseUser);

      const result = await service.upsertOnSignIn({
        email: 'user@example.com',
        name: 'Regular User',
        googleId: 'gid-1',
      });

      expect(mockRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.MEMBER }),
      );
      expect(result.role).toBe(UserRole.MEMBER);
    });

    it('returns existing user without changing role on subsequent sign-ins', async () => {
      mockRepo.upsert.mockResolvedValue({ ...baseUser, role: UserRole.ADMIN });

      const result = await service.upsertOnSignIn({
        email: 'user@example.com',
        name: 'Promoted User',
        googleId: 'gid-1',
      });

      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('listUsers', () => {
    it('delegates to repository', async () => {
      mockRepo.findAll.mockResolvedValue([baseUser]);
      const result = await service.listUsers('org-1');
      expect(result).toHaveLength(1);
      expect(mockRepo.findAll).toHaveBeenCalledWith('org-1');
    });
  });

  describe('updateRole', () => {
    it('delegates to repository', async () => {
      mockRepo.updateRole.mockResolvedValue({ ...baseUser, role: UserRole.ADMIN });
      const result = await service.updateRole('user-1', UserRole.ADMIN);
      expect(result.role).toBe(UserRole.ADMIN);
      expect(mockRepo.updateRole).toHaveBeenCalledWith('user-1', UserRole.ADMIN);
    });
  });
});
```

Run: `cd apps/api && npx jest test/users.service.spec.ts --no-coverage`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement UsersService**

```typescript
// apps/api/src/modules/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@prisma/client';
import { UsersRepository } from './users.repository';

export interface UpsertOnSignInInput {
  email: string;
  name?: string | null;
  googleId: string;
}

@Injectable()
export class UsersService {
  private readonly adminEmail: string;
  private readonly orgId: string;

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly config: ConfigService,
  ) {
    this.adminEmail = this.config.get<string>('ADMIN_EMAIL')!;
    this.orgId = this.config.get<string>('ORG_ID')!;
  }

  async upsertOnSignIn(input: UpsertOnSignInInput): Promise<User> {
    const role = input.email === this.adminEmail ? UserRole.ADMIN : UserRole.MEMBER;
    return this.usersRepo.upsert({
      tenantId: this.orgId,
      email: input.email,
      name: input.name,
      googleId: input.googleId,
      role,
    });
  }

  async listUsers(tenantId: string): Promise<User[]> {
    return this.usersRepo.findAll(tenantId);
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.usersRepo.updateRole(id, role);
  }
}
```

Note: `upsert` uses an `upsert` operation — if the user already exists, only `name` is updated. The `role` in the `create` branch is what gets set on first sign-in. On subsequent sign-ins the existing role is preserved because `update: { name }` doesn't touch role.

- [ ] **Step 3: Run tests — must pass**

```bash
cd apps/api && npx jest test/users.service.spec.ts --no-coverage
```

Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/users/users.service.ts apps/api/test/users.service.spec.ts
git commit -m "feat: add UsersService with ADMIN_EMAIL bootstrap logic"
```

---

## Task 6: UsersController, DTOs, UsersModule, wire AppModule

**Files:**
- Create: `apps/api/src/modules/users/dto/upsert-user.dto.ts`
- Create: `apps/api/src/modules/users/dto/update-role.dto.ts`
- Create: `apps/api/src/modules/users/users.controller.ts`
- Create: `apps/api/src/modules/users/users.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/webhooks/webhooks.controller.ts`
- Modify: `apps/api/src/modules/meetings/meetings.controller.ts`

- [ ] **Step 1: Create UpsertUserDto**

```typescript
// apps/api/src/modules/users/dto/upsert-user.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsString()
  @IsNotEmpty()
  googleId: string;
}
```

- [ ] **Step 2: Create UpdateRoleDto**

```typescript
// apps/api/src/modules/users/dto/update-role.dto.ts
import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
```

- [ ] **Step 3: Create UsersController**

```typescript
// apps/api/src/modules/users/users.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('upsert')
  @Public()
  async upsert(
    @Headers('x-internal-secret') secret: string,
    @Body() dto: UpsertUserDto,
  ) {
    if (secret !== this.config.get<string>('INTERNAL_API_SECRET')) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    const user = await this.usersService.upsertOnSignIn(dto);
    return { id: user.id, role: user.role };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  listUsers(@Query('tenantId') tenantId: string) {
    return this.usersService.listUsers(tenantId);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }
}
```

- [ ] **Step 4: Create UsersModule**

```typescript
// apps/api/src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
```

- [ ] **Step 5: Add @Public() to WebhooksController**

In `apps/api/src/modules/webhooks/webhooks.controller.ts`, add `@Public()` to the class:

```typescript
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { Public } from '../auth/public.decorator';

@Public()
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

- [ ] **Step 6: Add @Public() to MeetingsController**

In `apps/api/src/modules/meetings/meetings.controller.ts`, add `@Public()` to the class and the import:

```typescript
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { Public } from '../auth/public.decorator';

@Public()
@Controller('webhooks/calcom')
export class MeetingsController {
  // ... rest unchanged
```

- [ ] **Step 7: Wire AppModule with APP_GUARD**

Replace `apps/api/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JwtGuard } from './modules/auth/jwt.guard';
import { RolesGuard } from './modules/auth/roles.guard';

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
    AuthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Run all tests**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All existing tests still PASS (guards don't affect unit tests since they mock modules directly).

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/users/ apps/api/src/modules/webhooks/webhooks.controller.ts apps/api/src/modules/meetings/meetings.controller.ts apps/api/src/app.module.ts
git commit -m "feat: add UsersModule, wire JWT+Roles guards globally, mark webhooks @Public"
```

---

## Task 7: Next-Auth config (lib/auth.ts + API route + types)

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/src/types/next-auth.d.ts`

- [ ] **Step 1: Create shared authOptions in lib/auth.ts**

```typescript
// apps/web/src/lib/auth.ts
import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  jwt: {
    async encode({ token }) {
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) return null;
      const { payload } = await jwtVerify(token, secret);
      return payload as Record<string, unknown>;
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const res = await fetch(`${API_BASE}/users/upsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET!,
          },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            googleId: user.id,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { id: string; role: string };
          token.userId = data.id;
          token.role = data.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId as string;
      session.user.role = token.role as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
```

- [ ] **Step 2: Create Next-Auth API route**

```typescript
// apps/web/src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 3: Create Next-Auth type extensions**

```typescript
// apps/web/src/types/next-auth.d.ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      userId: string;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string;
  }
}
```

- [ ] **Step 4: Add web env vars**

Add to `apps/web/.env.local` (create if it doesn't exist):

```
NEXTAUTH_SECRET=<same value as apps/api/.env NEXTAUTH_SECRET>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
INTERNAL_API_SECRET=<same value as apps/api/.env INTERNAL_API_SECRET>
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

To get Google credentials:
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` to Authorized redirect URIs
4. Copy Client ID and Client Secret

- [ ] **Step 5: Build check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/app/api/auth/ apps/web/src/types/
git commit -m "feat: add Next-Auth config with Google OAuth and HS256 JWT"
```

---

## Task 8: Next.js middleware and login page

**Files:**
- Create: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: Create middleware**

```typescript
// apps/web/src/middleware.ts
export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
};
```

This uses Next-Auth's built-in middleware which redirects unauthenticated requests to the `signIn` page (`/login` as configured in `authOptions.pages`).

- [ ] **Step 2: Create login page**

```typescript
// apps/web/src/app/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Lead Generator</h1>
          <p className="text-sm text-gray-500 mt-1">AI Sales Automation Platform</p>
        </div>
        <Button
          className="w-full"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/app/login/
git commit -m "feat: add Next-Auth middleware and Google sign-in login page"
```

---

## Task 9: Update api-client with auth headers

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

All api-client functions are called server-side (Server Components or Server Actions). The Next-Auth session token cookie IS the HS256 JWT — we read it directly from cookies and pass it as Bearer.

- [ ] **Step 1: Add getAuthHeaders helper and update all fetch calls**

Replace the full contents of `apps/web/src/lib/api-client.ts` with:

```typescript
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get('next-auth.session-token')?.value ??
    cookieStore.get('__Secure-next-auth.session-token')?.value;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export interface LeadContact {
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
}

export interface LeadCompany {
  name: string;
  website: string | null;
  industry: string | null;
  techStack: string[];
  location: string | null;
}

export interface Lead {
  id: string;
  status: string;
  score: number | null;
  priority: 'HOT' | 'WARM' | 'COLD' | null;
  scoreReasons: string[];
  source: string;
  createdAt: string;
  contact: LeadContact;
  company: LeadCompany;
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

  const res = await fetch(`${API_BASE}/leads?${query}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json() as Promise<LeadsResponse>;
}

export async function triggerDiscovery(limit = 50): Promise<{ jobId: string; message: string }> {
  const res = await fetch(`${API_BASE}/discovery/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ limit }),
  });
  if (!res.ok) throw new Error('Failed to trigger discovery');
  return res.json() as Promise<{ jobId: string; message: string }>;
}

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

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const res = await fetch(`${API_BASE}/approvals?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json() as Promise<PendingApproval[]>;
}

export async function approveStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/approve?tenantId=${ORG_ID}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to approve step');
}

export async function rejectStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/reject?tenantId=${ORG_ID}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reject step');
}

export interface DashboardMetrics {
  leads: { total: number; byStatus: Record<string, number> };
  emails: { sentToday: number; sentThisWeek: number; replyRate: number };
  meetings: { scheduled: number; total: number };
  proposals: { draft: number; sent: number };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch(`${API_BASE}/dashboard/metrics?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  return res.json() as Promise<DashboardMetrics>;
}

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
  const res = await fetch(`${API_BASE}/case-studies?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch case studies');
  return res.json() as Promise<CaseStudy[]>;
}

export async function createCaseStudy(data: Omit<CaseStudy, 'id'>): Promise<CaseStudy> {
  const res = await fetch(`${API_BASE}/case-studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ ...data, tenantId: ORG_ID }),
  });
  if (!res.ok) throw new Error('Failed to create case study');
  return res.json() as Promise<CaseStudy>;
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/case-studies/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete case study');
}

export async function fetchRateCards(): Promise<RateCard[]> {
  const res = await fetch(`${API_BASE}/rate-cards?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch rate cards');
  return res.json() as Promise<RateCard[]>;
}

export async function upsertRateCard(data: Omit<RateCard, 'id'>): Promise<RateCard> {
  const res = await fetch(`${API_BASE}/rate-cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ ...data, tenantId: ORG_ID }),
  });
  if (!res.ok) throw new Error('Failed to upsert rate card');
  return res.json() as Promise<RateCard>;
}

export async function deleteRateCard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rate-cards/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete rate card');
}

export interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  opportunityId: string;
}

export async function fetchProposals(): Promise<Proposal[]> {
  const res = await fetch(`${API_BASE}/proposals?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
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
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create proposal');
  return res.json() as Promise<Proposal>;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json() as Promise<User[]>;
}

export async function updateUserRole(id: string, role: 'ADMIN' | 'MEMBER'): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('Failed to update user role');
  return res.json() as Promise<User>;
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "feat: add getAuthHeaders to api-client, pass Bearer JWT on all API calls"
```

---

## Task 10: Admin Users page

**Files:**
- Create: `apps/web/src/app/admin/users/page.tsx`
- Create: `apps/web/src/app/admin/users/actions.ts`

- [ ] **Step 1: Create Server Action**

```typescript
// apps/web/src/app/admin/users/actions.ts
'use server';

import { updateUserRole } from '@/lib/api-client';
import { revalidatePath } from 'next/cache';

export async function changeUserRole(id: string, role: 'ADMIN' | 'MEMBER') {
  await updateUserRole(id, role);
  revalidatePath('/admin/users');
}
```

- [ ] **Step 2: Create Users admin page**

The role dropdown needs a client component for interactivity — the page itself is a Server Component that fetches data, and `RoleSelector` (created in Step 3) handles the client-side change:

```typescript
// apps/web/src/app/admin/users/page.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { fetchUsers } from '@/lib/api-client';
import { RoleSelector } from './role-selector';

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/');

  const users = await fetchUsers();

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Users</h1>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-gray-900">{user.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <RoleSelector userId={user.id} currentRole={user.role as 'ADMIN' | 'MEMBER'} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create RoleSelector client component**

```typescript
// apps/web/src/app/admin/users/role-selector.tsx
'use client';

import { useState, useTransition } from 'react';
import { changeUserRole } from './actions';

export function RoleSelector({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: 'ADMIN' | 'MEMBER';
}) {
  const [role, setRole] = useState(currentRole);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as 'ADMIN' | 'MEMBER';
    setRole(newRole);
    startTransition(() => {
      changeUserRole(userId, newRole);
    });
  }

  return (
    <select
      value={role}
      onChange={handleChange}
      disabled={isPending}
      className="text-sm border rounded px-2 py-1 bg-white disabled:opacity-50"
    >
      <option value="MEMBER">Member</option>
      <option value="ADMIN">Admin</option>
    </select>
  );
}
```

- [ ] **Step 4: Build check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/
git commit -m "feat: add admin Users page with role management"
```

---

## Task 11: Update nav with Users link

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx to show Users link for admin**

Replace `apps/web/src/app/layout.tsx` with:

```typescript
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lead Generator',
  description: 'AI Sales Automation Platform',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession(authOptions);

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
          {session?.user.role === 'ADMIN' && (
            <a href="/admin/users" className="text-gray-700 hover:text-gray-900">Users</a>
          )}
          {session && (
            <span className="ml-auto text-gray-400 text-xs self-center">
              {session.user.email}
            </span>
          )}
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: show Users nav link for admin, display current user email"
```

---

## Task 12: End-to-end build check and smoke test

- [ ] **Step 1: Full API build check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Full web build check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all API tests**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 4: Smoke test (manual)**

Start both apps:
```bash
# Terminal 1
cd apps/api && npm run start:dev

# Terminal 2
cd apps/web && npm run dev
```

Verify:
1. Navigate to `http://localhost:3000` — redirected to `/login`
2. Click "Sign in with Google" — Google OAuth flow completes
3. Redirected back to `/` — nav shows Dashboard, Leads, Approvals, Proposals, Content, and your email
4. If `ADMIN_EMAIL` matches your Google account: "Users" appears in nav
5. Navigate to `/admin/users` — table shows your user with role ADMIN
6. Check the API is protected: `curl http://localhost:3001/api/v1/leads` should return 401
7. Webhook is public: `curl -X POST http://localhost:3001/api/v1/webhooks/inbound-email -H "Content-Type: application/json" -d '{}'` should return `{"ok":true}` (not 401)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: phase 4 complete — Google OAuth, JWT guards, admin users page"
```
