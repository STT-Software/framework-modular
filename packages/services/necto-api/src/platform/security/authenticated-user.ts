import type { Request } from 'express';

/** Roles an authenticated principal can have. A new kind of user adds its role here. */
export const USER_ROLES = ['superadmin', 'business-admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** A super admin: the owner of the platform account. `userId` is the id of the super admin. */
export interface SuperAdminPrincipal {
  userId: string;
  role: 'superadmin';
}

/**
 * The administrator of one or more businesses, signed in with an emailed code. `userId` is the normalized email.
 * The token carries the id of a server-side session (`sessionId`) and nothing about which businesses the person
 * administers: the business-access module checks the session, the current assignment, the business status and
 * the enabled modules on every request, so revoking a session or replacing a boss takes effect immediately.
 */
export interface BusinessAdminPrincipal {
  userId: string;
  role: 'business-admin';
  sessionId: string;
}
/**
 * Who is making the request. It is the only thing modules know about the session: they never see
 * the token, its signature or its claims.
 */
export type AuthenticatedUser = SuperAdminPrincipal | BusinessAdminPrincipal;

/** A request after `AuthenticationGuard` has verified its token. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
