import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { USER_ROLES, type AuthenticatedUser, type UserRole } from './authenticated-user';

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
    return this.jwt.signAsync({ sub: user.userId, role: user.role });
  }

  /** The identity inside a valid, unexpired token; `null` for anything else (malformed, forged, expired, unknown role). */
  async verify(token: string): Promise<AuthenticatedUser | null> {
    try {
      const claims = await this.jwt.verifyAsync<{ sub?: unknown; role?: unknown }>(token);
      if (typeof claims.sub !== 'string' || claims.sub === '') return null;
      if (!USER_ROLES.includes(claims.role as UserRole)) return null;
      return { userId: claims.sub, role: claims.role as UserRole };
    } catch {
      return null;
    }
  }
}
