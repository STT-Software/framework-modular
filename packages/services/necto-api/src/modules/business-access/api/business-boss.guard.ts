import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../../platform/security/authenticated-user';
import { BusinessDirectory } from '../../businesses/public';

/**
 * Authorization for a business boss, checked against the database on EVERY request (the token alone is not
 * enough, because a boss can be replaced or the business paused after it was issued):
 *
 * - Not a boss token (for example a super admin's): 403. A boss route is not a super admin route either way.
 * - The business is gone, or this person is no longer its boss: 401 (the session is no longer valid).
 * - The business is paused: 403 (the boss is blocked until the owner resumes it).
 *
 * It must run after `AuthenticationGuard`; use it through `@BossOnly()`.
 */
@Injectable()
export class BusinessBossGuard implements CanActivate {
  constructor(private readonly directory: BusinessDirectory) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedException();
    if (user.role !== 'business-boss') throw new ForbiddenException();

    const business = await this.directory.find(user.businessId);
    if (!business || business.boss.assignmentId !== user.assignmentId) throw new UnauthorizedException();
    if (business.status !== 'active') throw new ForbiddenException('The business is paused');
    return true;
  }
}
