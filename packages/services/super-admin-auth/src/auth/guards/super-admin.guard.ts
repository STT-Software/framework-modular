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
 * "Authorization: Bearer <jwt>" header signed by this service with the
 * "superadmin" role. The business admin login will use a different role, so this
 * guard will not let that token through.
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
      if (payload.role !== 'superadmin') {
        throw new UnauthorizedException();
      }
      request.superAdmin = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
