import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface SuperAdminJwtPayload {
  sub: string;
  role: 'superadmin';
}

export type SuperAdminRequest = Request & { superAdmin?: SuperAdminJwtPayload };

/**
 * Protects routes that only an authenticated super admin can use. It requires an
 * "Authorization: Bearer <jwt>" header issued by super-admin-auth (same signing
 * secret) with the "superadmin" role. It validates the token locally: it does not
 * call super-admin-auth, so this service keeps working if that one is down.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SuperAdminRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwt.verifyAsync<SuperAdminJwtPayload>(token);
      if (payload.role !== 'superadmin' || typeof payload.sub !== 'string' || payload.sub === '') {
        throw new UnauthorizedException();
      }
      request.superAdmin = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
