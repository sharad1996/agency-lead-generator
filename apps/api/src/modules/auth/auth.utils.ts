import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { JwtPayload } from './jwt.strategy';

/**
 * Whether API auth (JWT + roles) should be bypassed.
 * Only honored outside production, so it can never accidentally
 * disable auth on a deployed environment.
 */
export function isAuthDisabled(config: ConfigService): boolean {
  if (config.get<string>('NODE_ENV') === 'production') return false;
  return config.get<boolean>('DISABLE_AUTH') === true;
}

/** Synthetic admin user attached to requests when auth is disabled in development. */
export function devUser(config: ConfigService): JwtPayload {
  return {
    sub: 'dev-user',
    userId: 'dev-user',
    email: config.get<string>('ADMIN_EMAIL') ?? 'dev@localhost',
    name: 'Dev User',
    role: UserRole.ADMIN,
  };
}
