import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { CurrentUser } from '../../../platform/security/current-user.decorator';
import { SuperAdminOnly } from '../../../platform/security/super-admin-only.decorator';
import { InvitationService, type InvitationStatus } from '../application/invitation.service';

function toResponse(status: InvitationStatus) {
  return {
    status: status.status,
    bossEmail: status.bossEmail,
    attemptedAt: status.attemptedAt?.toISOString() ?? null,
    acceptedAt: status.acceptedAt?.toISOString() ?? null,
    failureCode: status.failureCode,
    expiresAt: status.expiresAt?.toISOString() ?? null,
    expired: status.expired,
    deliveryConfirmed: status.deliveryConfirmed,
    resendAvailableAt: status.resendAvailableAt?.toISOString() ?? null,
  };
}

/** The invitation sent to the boss of a business, for its owner. Never shows codes. */
@Controller('businesses/:businessId/invitation')
@SuperAdminOnly()
export class InvitationsController {
  constructor(private readonly invitations: InvitationService) {}

  @Get()
  async status(@CurrentUser() user: AuthenticatedUser, @Param('businessId') businessId: string) {
    return toResponse(await this.invitations.status(user.userId, businessId));
  }

  /** Sends a new code to the current boss (for example after a failed send). Limited. */
  @Post('resend')
  @HttpCode(202)
  async resend(@CurrentUser() user: AuthenticatedUser, @Param('businessId') businessId: string) {
    return toResponse(await this.invitations.resend(user.userId, businessId));
  }
}
