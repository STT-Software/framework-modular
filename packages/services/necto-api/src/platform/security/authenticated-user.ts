import type { Request } from 'express';

/** Roles an authenticated user can have. A new kind of user (for example a business admin) adds its role here. */
export const USER_ROLES = ['superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Who is making the request. It is the only thing modules know about the session: they never see
 * the token, its signature or its claims.
 */
export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

/** A request after `AuthenticationGuard` has verified its token. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
