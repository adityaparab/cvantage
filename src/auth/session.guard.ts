import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { Session } from './auth.service';
export type AuthRequest = Request & { session: Session };
export function sessionCookie(request: Request) {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('cvantage_session='))
    ?.slice('cvantage_session='.length);
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.session = await this.auth.session(sessionCookie(request));
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers['x-csrf-token'] !== request.session.csrfToken
    )
      throw new ForbiddenException('Invalid request token; refresh and retry');
    return true;
  }
}
