import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
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

  /**
   * A temporary sign-in code for the boss, to copy and hand over (it is not emailed). The only response that ever
   * carries a code: it is shown once and is not kept anywhere in readable form.
   */
  @Post('temporary-code')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  async temporaryCode(@CurrentUser() user: AuthenticatedUser, @Param('businessId') businessId: string) {
    const issued = await this.invitations.issueTemporaryCode(user.userId, businessId);
    return { code: issued.code, bossEmail: issued.bossEmail, expiresAt: issued.expiresAt.toISOString() };
  }

  /** Sends a new code to the current boss (for example after a failed send). Limited. */
  @Post('resend')
  @HttpCode(202)
  async resend(@CurrentUser() user: AuthenticatedUser, @Param('businessId') businessId: string) {
    return toResponse(await this.invitations.resend(user.userId, businessId));
  }
}
