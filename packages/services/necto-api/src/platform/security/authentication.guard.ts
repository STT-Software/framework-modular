import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-user';
import { TokenService } from './token.service';

/**
 * Authentication: answers "who is this?". It requires an "Authorization: Bearer <jwt>" header with a
 * valid token and leaves the identity in `request.user`. It does not look at the role: whether that
 * identity is allowed to do something is an authorization decision (see `SuperAdminGuard`).
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }
    const user = await this.tokens.verify(token);
    if (!user) {
      throw new UnauthorizedException();
    }
    request.user = user;
    return true;
  }
}
