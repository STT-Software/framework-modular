import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-user';

/**
 * Authorization: only a super admin gets through. It checks the identity that `AuthenticationGuard`
 * already verified; it never reads or validates a token itself. Use it through `@SuperAdminOnly()`,
 * which runs both guards in the right order.
 *
 * - No identity on the request (the authentication guard did not run): 401.
 * - Authenticated, but with another role: 403.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.role !== 'superadmin') {
      throw new ForbiddenException();
    }
    return true;
  }
}
