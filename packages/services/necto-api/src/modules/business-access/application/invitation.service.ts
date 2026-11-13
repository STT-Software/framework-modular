import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { BossAssigned, BusinessDirectory, type BusinessAccessView } from '../../businesses/public';
import { AccessPolicy } from '../domain/access-policy';
import type { DeliveryFailureCode } from '../domain/challenge';
import { ChallengeRepository } from '../domain/challenge.repository';
import { InvitationBusinessNotFoundError, InvitationNotAvailableError, InvitationTooSoonError, TooManyRequestsError } from '../domain/errors';
import { RateLimiter } from '../domain/rate-limiter';
import { AccessCodeService } from './access-code.service';
import { AccessMailer } from './access-mailer';

/**
 * The state of the invitation sent to the boss of a business, for its owner.
 *
 * `status` is what we know: `sending` (attempt in progress), `accepted` (the mail provider took it) or `failed`.
 * There is no "delivered": a provider accepting a message does not prove the person received it, so
 * `deliveryConfirmed` is always false.
 */
export interface InvitationStatus {
  status: 'none' | 'sending' | 'accepted' | 'failed';
  bossEmail: string;
  attemptedAt: Date | null;
  acceptedAt: Date | null;
  failureCode: DeliveryFailureCode | null;
  expiresAt: Date | null;
  expired: boolean;
  deliveryConfirmed: false;
  /** When a new invitation may be sent; null if it may be sent now. */
  resendAvailableAt: Date | null;
}

/** Sending the first access to a boss, and letting the owner see its state and send it again. */
@Injectable()
export class InvitationService {
  constructor(
    private readonly directory: BusinessDirectory,
    private readonly codes: AccessCodeService,
    private readonly challenges: ChallengeRepository,
    private readonly mailer: AccessMailer,
    private readonly limiter: RateLimiter,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  /**
   * A boss was assigned (business created, or boss replaced). The previous boss's pending codes are cancelled
   * and a new code is emailed to the new boss. If the business was just created there is nothing to cancel.
   */
  async onBossAssigned(event: BossAssigned): Promise<void> {
    await this.codes.revokeAllExcept(event.businessId, event.assignmentId);
    await this.issueAndSend(
      { id: event.businessId, name: event.businessName },
      { assignmentId: event.assignmentId, name: event.bossName, email: event.bossEmail },
    );
  }

  async status(ownerId: string, businessId: string): Promise<InvitationStatus> {
    const business = await this.requireOwned(ownerId, businessId);
    return this.statusOf(business);
  }

  /**
   * Sends a new code to the current boss. Limited: not within the cooldown of the last code, and not more than
   * the hourly cap per business. A failed first attempt is recovered here without creating anything twice.
   */
  async resend(ownerId: string, businessId: string): Promise<InvitationStatus> {
    const business = await this.requireOwned(ownerId, businessId);
    if (business.status !== 'active') throw new InvitationNotAvailableError();

    const now = this.clock.now();
    const last = await this.challenges.latestCreatedAt(business.id, business.boss.email);
    if (last) {
      const waitMs = last.getTime() + this.policy.resendCooldownMs - now.getTime();
      if (waitMs > 0) throw new InvitationTooSoonError(Math.ceil(waitMs / 1000));
    }
    const cap = await this.limiter.hit(`invite:${business.id}`, this.policy.contextSendLimit, this.policy.sendWindowMs, now);
    if (!cap.allowed) throw new TooManyRequestsError(cap.retryAfterSeconds);

    await this.issueAndSend({ id: business.id, name: business.name }, business.boss);
    return this.statusOf(business);
  }

  private async issueAndSend(
    business: { id: string; name: string },
    boss: { assignmentId: string; name: string; email: string },
  ): Promise<void> {
    const { challenge, code } = await this.codes.issue({
      businessId: business.id,
      assignmentId: boss.assignmentId,
      email: boss.email,
      purpose: 'invitation',
    });
    this.mailer.dispatch({
      challengeId: challenge.id,
      purpose: 'invitation',
      businessId: business.id,
      businessName: business.name,
      bossName: boss.name,
      email: boss.email,
      code,
    });
  }

  private async statusOf(business: BusinessAccessView): Promise<InvitationStatus> {
    const now = this.clock.now();
    const latest = await this.challenges.latestInvitation(business.id);
    const last = await this.challenges.latestCreatedAt(business.id, business.boss.email);
    const waitUntil = last ? new Date(last.getTime() + this.policy.resendCooldownMs) : null;
    const resendAvailableAt = waitUntil && waitUntil.getTime() > now.getTime() ? waitUntil : null;

    // An invitation that belongs to a boss who was replaced does not count as the current boss's invitation.
    const current = latest && latest.assignmentId === business.boss.assignmentId ? latest : null;
    return {
      status: current ? current.delivery.status : 'none',
      bossEmail: business.boss.email,
      attemptedAt: current?.delivery.attemptedAt ?? null,
      acceptedAt: current?.delivery.acceptedAt ?? null,
      failureCode: current?.delivery.failureCode ?? null,
      expiresAt: current?.expiresAt ?? null,
      expired: current ? current.expiresAt.getTime() <= now.getTime() : false,
      deliveryConfirmed: false,
      resendAvailableAt,
    };
  }

  private async requireOwned(ownerId: string, businessId: string): Promise<BusinessAccessView> {
    const business = await this.directory.findOwned(ownerId, businessId);
    if (!business) throw new InvitationBusinessNotFoundError();
    return business;
  }
}
