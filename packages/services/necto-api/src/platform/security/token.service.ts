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
  issue(user: AuthenticatedUser, options: { expiresInSeconds?: number } = {}): Promise<string> {
    const signOptions = options.expiresInSeconds ? { expiresIn: options.expiresInSeconds } : undefined;
    if (user.role === 'business-admin') {
      return this.jwt.signAsync({ sub: user.userId, role: user.role, sid: user.sessionId }, signOptions);
    }
    return this.jwt.signAsync({ sub: user.userId, role: user.role }, signOptions);
  }

  /** The identity inside a valid, unexpired token; `null` for anything else (malformed, forged, expired, unknown role). */
  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const claims = await this.jwt.verifyAsync<{ sub?: unknown; role?: unknown; sid?: unknown }>(token);
      if (!nonEmptyString(claims.sub)) return null;
      if (!USER_ROLES.includes(claims.role as UserRole)) return null;
      if (claims.role === 'business-admin') {
        if (!nonEmptyString(claims.sid)) return null;
        return { userId: claims.sub, role: 'business-admin', sessionId: claims.sid };
      }
      return { userId: claims.sub, role: 'superadmin' };
    } catch {
      return null;
    }
  }
}
