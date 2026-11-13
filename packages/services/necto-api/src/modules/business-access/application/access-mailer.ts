import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { MailSendError, MailTransport } from '../../../platform/mail/mail-transport';
import { Clock } from '../../../platform/time/clock';
import { AccessPolicy } from '../domain/access-policy';
import type { ChallengePurpose, DeliveryFailureCode } from '../domain/challenge';
import { ChallengeRepository } from '../domain/challenge.repository';
import { buildAccessEmail } from './access-email';

export interface AccessMailJob {
  challengeId: string;
  purpose: ChallengePurpose;
  businessId: string;
  businessName: string;
  bossName: string;
  /** Where the email goes. */
  email: string;
  code: string;
}

/**
 * Sends the access emails in the background and records what happened to each one. The request that
 * issued the code does not wait for the mail provider, so a slow or broken provider cannot hang a creation.
 *
 * It records the attempt, the provider's acceptance and failures. It never records "delivered".
 */
@Injectable()
export class AccessMailer implements OnApplicationShutdown {
  private readonly logger = new Logger(AccessMailer.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly transport: MailTransport,
    private readonly challenges: ChallengeRepository,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  dispatch(job: AccessMailJob): void {
    const task: Promise<void> = this.deliver(job).finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  /** Resolves when every email being sent has finished (used on shutdown, so none is cut off, and by tests). */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  onApplicationShutdown(): Promise<void> {
    return this.drain();
  }

  private async deliver(job: AccessMailJob): Promise<void> {
    const attemptedAt = this.clock.now();
    try {
      const url = new URL('/business/access', this.policy.publicAppUrl);
      url.searchParams.set('business', job.businessId);
      const email = buildAccessEmail({
        purpose: job.purpose,
        businessName: job.businessName,
        bossName: job.bossName,
        code: job.code,
        ttlMinutes: Math.round(this.policy.ttlMs / 60_000),
        accessUrl: url.toString(),
      });
      await this.transport.send({ to: job.email, ...email });
      await this.challenges.recordDelivery(job.challengeId, {
        status: 'accepted',
        attemptedAt,
        acceptedAt: this.clock.now(),
        failedAt: null,
        failureCode: null,
      });
    } catch (error) {
      const failureCode: DeliveryFailureCode = error instanceof MailSendError ? error.code : 'unknown';
      // Only ids and a failure code: never the address, the code or the message.
      this.logger.warn(`Access email not sent (challenge ${job.challengeId}): ${failureCode}`);
      try {
        await this.challenges.recordDelivery(job.challengeId, {
          status: 'failed',
          attemptedAt,
          acceptedAt: null,
          failedAt: this.clock.now(),
          failureCode,
        });
      } catch {
        this.logger.error(`The failure of challenge ${job.challengeId} could not be recorded`);
      }
    }
  }
}
