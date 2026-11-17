import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, applyDecorators, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../../../platform/security/authenticated-user';
import { AuthenticationGuard } from '../../../platform/security/authentication.guard';
import { AdminSessionService } from '../application/admin-session.service';
import { AdministeredBusinessesService } from '../application/administered-businesses.service';
import type { AdminSession } from '../domain/admin-session';

/** A request after `BusinessAdminGuard`: who it is and the server-side session that backs the token. */
export type AdminRequest = AuthenticatedRequest & { adminSession?: AdminSession; params: Record<string, string> };

/**
 * Authorization of an administrator of businesses, checked against the database on EVERY request: the token alone
 * is not enough, because a session can be ended (sign out, forget the device, "sign out everywhere else") or can
 * expire after the token was issued.
 *
 * - Not an administrator token (for example a super admin's): 403.
 * - The session ended or expired: 401 `session-expired`, and the person must verify the email again.
 *
 * It must run after `AuthenticationGuard`; use it through `@BusinessAdminOnly()`.
 */
@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedException();
    if (user.role !== 'business-admin') throw new ForbiddenException();
    request.adminSession = await this.sessions.requireActive(user.sessionId, user.userId);
    return true;
  }
}

/** For sensitive actions: the last code the person confirmed must be recent, otherwise 403 `reverification-required`. */
@Injectable()
export class RecentVerificationGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const session = context.switchToHttp().getRequest<AdminRequest>().adminSession;
    if (!session) throw new UnauthorizedException();
    this.sessions.requireRecentVerification(session);
    return true;
  }
}

const MODULE_KEY = 'business-access:module';

/**
 * Lets the request through only if the business in `:businessId` is administered by the signed-in person right now
 * (current boss, active business) AND has the functionality named by `@RequiresBusinessModule` enabled.
 */
@Injectable()
export class BusinessModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly businesses: AdministeredBusinessesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleId = this.reflector.getAllAndOverride<string | undefined>(MODULE_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const email = request.adminSession?.email;
    if (!moduleId || !email) throw new UnauthorizedException();
    await this.businesses.requireModule(email, request.params.businessId, moduleId);
    return true;
  }
}

/** Restricts a route to a signed-in administrator of businesses: authenticates the token, then checks the session. */
export const BusinessAdminOnly = () => applyDecorators(UseGuards(AuthenticationGuard, BusinessAdminGuard));

/** Like `BusinessAdminOnly`, and the code must have been confirmed recently (sensitive actions). */
export const RecentlyVerified = () => applyDecorators(UseGuards(AuthenticationGuard, BusinessAdminGuard, RecentVerificationGuard));

/**
 * Restricts a route `/…/:businessId/…` to an administrator of THAT business, and only if it has this functionality
 * enabled. This is how the modules that serve a functionality (reservas, turnos...) protect their routes: the
 * server decides, hiding an option in the interface is not authorization.
 */
export const RequiresBusinessModule = (moduleId: string) =>
  applyDecorators(SetMetadata(MODULE_KEY, moduleId), UseGuards(AuthenticationGuard, BusinessAdminGuard, BusinessModuleGuard));
