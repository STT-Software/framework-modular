import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser, BusinessBossPrincipal } from '../../../platform/security/authenticated-user';
import { CurrentUser } from '../../../platform/security/current-user.decorator';
import { BossSessionService } from '../application/boss-session.service';
import { BossOnly } from './boss-only.decorator';
import { RequestCodeDto, VerifyCodeDto } from './dto/access-code.dto';

/**
 * How the boss of a business signs in: with a code sent to their email, no password. These two routes are
 * public on purpose, so they answer the same whether or not the email is assigned.
 */
@Controller('business-access')
export class BossAccessController {
  constructor(private readonly sessions: BossSessionService) {}

  @Post('otp/request')
  @HttpCode(202)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async requestCode(@Body() dto: RequestCodeDto, @Ip() ip: string) {
    await this.sessions.requestLoginCode({ businessId: dto.businessId, email: dto.email, ip });
    return { message: 'If that email is assigned to this business, a code is on its way' };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyCode(@Body() dto: VerifyCodeDto, @Ip() ip: string) {
    return this.sessions.verify({ businessId: dto.businessId, email: dto.email, code: dto.code, ip });
  }

  /** The business and boss of the current session. */
  @Get('me')
  @BossOnly()
  me(@CurrentUser() user: AuthenticatedUser) {
    // `BossOnly` guarantees a boss; the cast tells TypeScript what the guard already checked.
    return this.sessions.overview(user as BusinessBossPrincipal);
  }
}
