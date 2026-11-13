import { Body, Controller, Get, Put } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { CurrentUser } from '../../../platform/security/current-user.decorator';
import { SuperAdminOnly } from '../../../platform/security/super-admin-only.decorator';
import { OnboardingService } from '../application/onboarding.service';
import { SavePhoneDto } from './dto/save-phone.dto';
import { SaveSourcesDto } from './dto/save-sources.dto';

/**
 * The onboarding profile of the authenticated user. The user id always comes from the session,
 * never from the body or the URL, so nobody can read or write another account's profile.
 * Today onboarding is for super admins only; opening it to another role means changing this decorator.
 */
@Controller('onboarding/profile')
@SuperAdminOnly()
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.get(user.userId);
  }

  // Stricter limit: a 409 reveals whether a number is taken, so this must not be used to probe numbers.
  @Put('phone')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  savePhone(@CurrentUser() user: AuthenticatedUser, @Body() dto: SavePhoneDto) {
    return this.onboarding.savePhone(user.userId, dto.phone);
  }

  @Put('sources')
  saveSources(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveSourcesDto) {
    return this.onboarding.saveSources(user.userId, dto.sources);
  }
}
