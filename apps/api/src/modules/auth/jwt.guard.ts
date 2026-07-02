import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';
import { isAuthDisabled, devUser } from './auth.utils';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Dev-only escape hatch: skip token checking and attach a synthetic
    // admin user so downstream handlers and RolesGuard keep working.
    if (isAuthDisabled(this.config)) {
      const req = context.switchToHttp().getRequest<{ user: unknown }>();
      req.user = devUser(this.config);
      return true;
    }

    return super.canActivate(context);
  }
}
