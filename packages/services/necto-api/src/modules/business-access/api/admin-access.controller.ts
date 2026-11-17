import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminLoginService } from '../application/admin-login.service';
import { AdminSessionService, type SessionGrant } from '../application/admin-session.service';
import { AdministeredBusinessesService } from '../application/administered-businesses.service';
import { AccessPolicy } from '../domain/access-policy';
import { ReverifyDto, RequestCodeDto, VerifyCodeDto } from './dto/admin-access.dto';
import { BusinessAdminOnly, RecentlyVerified, type AdminRequest } from './business-admin.guards';
import { clearSessionCookie, readCookie, SESSION_COOKIE, setSessionCookie } from './session-cookie';

function toGrantResponse(grant: SessionGrant) {
  return {
    accessToken: grant.accessToken,
    expiresInSeconds: grant.expiresInSeconds,
    admin: { email: grant.email, remember: grant.remember },
    businesses: grant.businesses,
  };
}

/**
 * How an administrator of businesses signs in: with a code sent to their email, no password, and an optional
 * remembered device. The public routes answer the same whether or not the email is assigned.
 *
 * The browser keeps a secret HttpOnly cookie (the session) and a short access token in memory; the token is
 * renewed from the cookie, so a page reload does not ask for another code while the session lasts.
 */
@Controller('business-access')
export class AdminAccessController {
  constructor(
    private readonly login: AdminLoginService,
    private readonly sessions: AdminSessionService,
    private readonly businesses: AdministeredBusinessesService,
    private readonly policy: AccessPolicy,
  ) {}

  @Post('otp/request')
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async requestCode(@Body() dto: RequestCodeDto, @Ip() ip: string) {
    await this.login.requestCode({ email: dto.email, ip });
    return { message: 'A code is on its way', ...this.login.rules() };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyCode(@Body() dto: VerifyCodeDto, @Ip() ip: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { started, grant } = await this.login.verifyCode({
      email: dto.email,
      code: dto.code,
      ip,
      remember: dto.remember === true,
      previousCookie: readCookie(request, SESSION_COOKIE),
    });
    setSessionCookie(response, this.policy, started.cookieValue, started.cookieMaxAgeMs);
    return toGrantResponse(grant);
  }

  /** Is there a valid session on this browser? Used to offer "continue" without another code. */
  @Get('session')
  async current(@Req() request: Request) {
    const session = await this.sessions.requireCookie(readCookie(request, SESSION_COOKIE));
    return {
      email: session.email,
      remember: session.remember,
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    };
  }

  /** Continues with the session on this browser: a new access token, and the businesses authorized right now. */
  @Post('session/refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() request: Request) {
    return toGrantResponse(await this.sessions.refresh(readCookie(request, SESSION_COOKIE)));
  }

  /** Signs out and forgets this device: ends the session on the server and clears the cookie. Safe to repeat. */
  @Delete('session')
  @HttpCode(204)
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.sessions.endByCookie(readCookie(request, SESSION_COOKIE), 'signed-out');
    clearSessionCookie(response, this.policy);
  }

  /** Emails a code to confirm a sensitive action. */
  @Post('session/reverify/request')
  @HttpCode(202)
  @BusinessAdminOnly()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async requestReverification(@Req() request: AdminRequest, @Ip() ip: string) {
    await this.sessions.requestReverification(request.adminSession!, ip);
    return { message: 'A code is on its way', ...this.login.rules() };
  }

  @Post('session/reverify')
  @HttpCode(200)
  @BusinessAdminOnly()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reverify(@Body() dto: ReverifyDto, @Req() request: AdminRequest, @Ip() ip: string) {
    const { verifiedAt } = await this.sessions.reverify(request.adminSession!, dto.code, ip);
    return { verifiedAt: verifiedAt.toISOString() };
  }

  /** "Sign out everywhere else". A sensitive action: it needs a recently confirmed code. */
  @Post('session/revoke-others')
  @HttpCode(200)
  @RecentlyVerified()
  async revokeOthers(@Req() request: AdminRequest) {
    return { revoked: await this.sessions.revokeOthers(request.adminSession!) };
  }

  /** Only the businesses this person administers right now (active, and they are its current boss). */
  @Get('businesses')
  @BusinessAdminOnly()
  async listBusinesses(@Req() request: AdminRequest) {
    return { businesses: await this.businesses.list(request.adminSession!.email) };
  }

  @Get('businesses/:businessId')
  @BusinessAdminOnly()
  getBusiness(@Req() request: AdminRequest, @Param('businessId') businessId: string) {
    return this.businesses.get(request.adminSession!.email, businessId);
  }

  /** Can this administrator open this functionality of this business? 403 `module-not-enabled` if it is not enabled. */
  @Get('businesses/:businessId/modules/:moduleId')
  @BusinessAdminOnly()
  async checkModule(@Req() request: AdminRequest, @Param('businessId') businessId: string, @Param('moduleId') moduleId: string) {
    await this.businesses.requireModule(request.adminSession!.email, businessId, moduleId);
    return { moduleId, enabled: true };
  }
}
