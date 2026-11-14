import type { Request } from 'express';

/** Roles an authenticated principal can have. A new kind of user adds its role here. */
export const USER_ROLES = ['superadmin', 'business-boss'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** A super admin: the owner of the platform account. `userId` is the id of the super admin. */
export interface SuperAdminPrincipal {
  userId: string;
  role: 'superadmin';
}

/**
 * The boss of ONE business, signed in with an emailed code. The session belongs to a single assignment
 * (this person as boss of this business): `userId` is the normalized email, and the token says nothing about
 * other businesses the same person may boss. Whether the assignment is still current is checked on every
 * request by the business-access module, not trusted from the token.
 */
export interface BusinessBossPrincipal {
  userId: string;
  role: 'business-boss';
  businessId: string;
  assignmentId: string;
}

/**
 * Who is making the request. It is the only thing modules know about the session: they never see
 * the token, its signature or its claims.
 */
export type AuthenticatedUser = SuperAdminPrincipal | BusinessBossPrincipal;

/** A request after `AuthenticationGuard` has verified its token. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
