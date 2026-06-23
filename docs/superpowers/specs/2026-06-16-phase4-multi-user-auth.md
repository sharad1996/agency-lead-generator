# Phase 4: Multi-User Auth with Google OAuth and Roles

## Overview

Add authentication and role-based access control to the AI Sales Automation Platform. Any Google account can sign in. Users are assigned one of two roles: **ADMIN** or **MEMBER**. The first admin is bootstrapped via an `ADMIN_EMAIL` env var; all subsequent sign-ins default to MEMBER and can be promoted by an admin.

**Auth strategy:** Next-Auth (Google OAuth) on the frontend, JWT validated by NestJS. Next-Auth is configured to issue plain HS256 JWTs (overriding its default JWE encryption) so NestJS can validate them directly using the shared `NEXTAUTH_SECRET`. No separate token exchange.

---

## Architecture

```
Browser → Next.js (Next-Auth Google OAuth)
             ↓ signIn callback
         POST /users/upsert  (x-internal-secret header, no JWT guard)
             ↓ returns { id, role }
         JWT payload: { sub, email, name, userId, role }
             ↓ signed with NEXTAUTH_SECRET (HS256)

Browser → Next.js Server Action
             ↓ getToken() → JWT
         NestJS API (Authorization: Bearer <jwt>)
             ↓ JwtGuard validates NEXTAUTH_SECRET
             ↓ RolesGuard checks role claim
         Controller
```

Webhooks (`/webhooks/*`) are excluded from the JWT guard — they are already secured by their own HMAC secrets (`SENDGRID_WEBHOOK_SECRET`, `CAL_COM_WEBHOOK_SECRET`).

---

## Data Model

### New Prisma model

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
}
```

No changes to existing models.

### Bootstrap logic

On `POST /users/upsert`:
- If `email === ADMIN_EMAIL` and no user exists yet → create with `role = ADMIN`
- If user already exists → return existing record (role unchanged)
- Otherwise → create with `role = MEMBER`

---

## Backend Changes (NestJS)

### New env vars

```
NEXTAUTH_SECRET=<32-char random string>
INTERNAL_API_SECRET=<32-char random string>
ADMIN_EMAIL=sharad@conversion.io
```

### New files

- `apps/api/src/modules/auth/jwt.strategy.ts` — Passport JWT strategy; validates HS256 JWT signed with `NEXTAUTH_SECRET`; extracts `{ userId, email, role }` from payload
- `apps/api/src/modules/auth/jwt.guard.ts` — extends `AuthGuard('jwt')`; checks for `@Public()` decorator to skip
- `apps/api/src/modules/auth/roles.guard.ts` — checks `user.role` against `@Roles()` decorator; no decorator = any authenticated user passes
- `apps/api/src/modules/auth/roles.decorator.ts` — `@Roles('ADMIN')` metadata decorator
- `apps/api/src/modules/auth/public.decorator.ts` — `@Public()` metadata decorator to skip JWT guard
- `apps/api/src/modules/auth/auth.module.ts` — imports PassportModule + JwtModule, exports guards
- `apps/api/src/modules/users/users.repository.ts` — `upsert(dto)`, `findAll(tenantId)`, `updateRole(id, role)`
- `apps/api/src/modules/users/users.service.ts` — `upsertOnSignIn(dto)`, `listUsers(tenantId)`, `updateRole(id, role)`
- `apps/api/src/modules/users/users.controller.ts` — three endpoints (see below)
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/dto/upsert-user.dto.ts`
- `apps/api/src/modules/users/dto/update-role.dto.ts`
- `apps/api/test/users.service.spec.ts`

### Modified files

- `apps/api/src/app.module.ts` — register `APP_GUARD` for JwtGuard and RolesGuard; import AuthModule and UsersModule
- `apps/api/src/config/config.module.ts` — add `NEXTAUTH_SECRET`, `INTERNAL_API_SECRET`, `ADMIN_EMAIL` to Joi schema
- `apps/api/.env.example` — add new vars

### Endpoints

| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| POST | `/users/upsert` | `@Public()` + `x-internal-secret` header check | Called by Next-Auth on sign-in |
| GET | `/users` | JWT + `@Roles('ADMIN')` | List all users |
| PATCH | `/users/:id/role` | JWT + `@Roles('ADMIN')` | Promote or demote a user |

`POST /users/upsert` body:
```json
{ "email": "alice@example.com", "name": "Alice Chen", "googleId": "1234567890" }
```
Response: `{ "id": "uuid", "role": "MEMBER" }`

`PATCH /users/:id/role` body:
```json
{ "role": "ADMIN" }
```

---

## Frontend Changes (Next.js)

### New env vars

```
NEXTAUTH_SECRET=<same value as API>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
INTERNAL_API_SECRET=<same value as API>
```

### New files

- `apps/web/src/app/api/auth/[...nextauth]/route.ts` — Next-Auth config: Google provider, custom HS256 JWT encode/decode, `signIn` + `jwt` + `session` callbacks
- `apps/web/src/app/login/page.tsx` — Google sign-in button (ShadCN UI), redirects to `/` on success
- `apps/web/src/app/admin/users/page.tsx` — users table with role dropdown; admin-only
- `apps/web/src/app/admin/users/actions.ts` — Server Action: `updateUserRole(id, role)`
- `apps/web/src/middleware.ts` — redirect unauthenticated to `/login`; pass through `/api/auth/*`
- `apps/web/src/types/next-auth.d.ts` — extend `Session` and `JWT` types with `userId` and `role`

### Modified files

- `apps/web/src/lib/api-client.ts` — add `getAuthHeaders()` helper that calls `getToken()` server-side and returns `{ Authorization: 'Bearer <jwt>' }`; add all existing fetch calls use this helper
- `apps/web/src/app/layout.tsx` — add "Users" nav link (admin only, check `session.user.role`)

### Next-Auth JWT callbacks

Only two callbacks are needed — no `signIn` callback. The `jwt` callback handles upsert and role embedding on first sign-in; `session` exposes role to the client.

```typescript
// jwt callback — upserts user on first sign-in, embeds role into JWT
async jwt({ token, user }) {
  if (user) {
    // 'user' is only present on the first sign-in
    const res = await fetch(`${API_URL}/users/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_API_SECRET },
      body: JSON.stringify({ email: user.email, name: user.name, googleId: user.id }),
    })
    const data = await res.json()
    token.userId = data.id
    token.role = data.role
  }
  return token
}

// session callback — exposes role to the client
async session({ session, token }) {
  session.user.userId = token.userId as string
  session.user.role = token.role as string
  return session
}
```

### Middleware

```typescript
// apps/web/src/middleware.ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Role Enforcement Summary

| Feature | MEMBER | ADMIN |
|---------|--------|-------|
| View dashboard | ✓ | ✓ |
| View leads | ✓ | ✓ |
| View proposals | ✓ | ✓ |
| Approve outreach batches | ✓ | ✓ |
| View content (case studies, rate cards) | ✓ | ✓ |
| Manage content (create/delete) | ✓ | ✓ |
| Generate proposals | ✓ | ✓ |
| Manage users (promote/demote) | ✗ | ✓ |
| View users list | ✗ | ✓ |

---

## New Packages

**API:** `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`, `@types/passport-jwt`

**Web:** `next-auth`

---

## Test Coverage

- `apps/api/test/users.service.spec.ts` — upsert creates ADMIN for ADMIN_EMAIL, upsert creates MEMBER for unknown email, upsert returns existing user, updateRole changes role
- JWT guard and roles guard tested via integration (build check + manual smoke test)
