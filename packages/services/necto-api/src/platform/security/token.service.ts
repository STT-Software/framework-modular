import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { USER_ROLES, type AuthenticatedUser, type UserRole } from './authenticated-user';

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * Issues and verifies the session tokens (JWT, HS256). It is the only code that knows the signing
 * secret and the token format: a module that needs a session token asks for one here and gets
 * back an `AuthenticatedUser` when it verifies one.
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  /** Signs a token for an identity that a module has already validated (for example, after a login). */
  issue(user: AuthenticatedUser): Promise<string> {
    if (user.role === 'business-boss') {
      return this.jwt.signAsync({ sub: user.userId, role: user.role, bid: user.businessId, aid: user.assignmentId });
    }
    return this.jwt.signAsync({ sub: user.userId, role: user.role });
  }

  /** The identity inside a valid, unexpired token; `null` for anything else (malformed, forged, expired, unknown role). */
  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const claims = await this.jwt.verifyAsync<{ sub?: unknown; role?: unknown; bid?: unknown; aid?: unknown }>(token);
      if (!nonEmptyString(claims.sub)) return null;
      if (!USER_ROLES.includes(claims.role as UserRole)) return null;
      if (claims.role === 'business-boss') {
        if (!nonEmptyString(claims.bid) || !nonEmptyString(claims.aid)) return null;
        return { userId: claims.sub, role: 'business-boss', businessId: claims.bid, assignmentId: claims.aid };
      }
      return { userId: claims.sub, role: 'superadmin' };
    } catch {
      return null;
    }
  }
}
