import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SuperAdminGuard, type SuperAdminRequest } from '../auth/super-admin.guard';
import { SavePhoneDto } from './dto/save-phone.dto';
import { SaveSourcesDto } from './dto/save-sources.dto';
import { ProfileService } from './profile.service';

/** The profile of the authenticated super admin. The user id always comes from the token. */
@Controller('onboarding/profile')
@UseGuards(SuperAdminGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('me')
  me(@Req() req: SuperAdminRequest) {
    return this.profile.get(req.superAdmin!.sub);
  }

  // Stricter limit: a 409 reveals whether a number is taken, so this must not be used to probe numbers.
  @Put('phone')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  savePhone(@Req() req: SuperAdminRequest, @Body() dto: SavePhoneDto) {
    return this.profile.savePhone(req.superAdmin!.sub, dto.phone);
  }

  @Put('sources')
  saveSources(@Req() req: SuperAdminRequest, @Body() dto: SaveSourcesDto) {
    return this.profile.saveSources(req.superAdmin!.sub, dto.sources);
  }
}
