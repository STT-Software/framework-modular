import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../../platform/security/token.service';
import type { BusinessBossPrincipal } from '../../../platform/security/authenticated-user';
import { Clock } from '../../../platform/time/clock';
import { normalizeEmail } from '../../../platform/text/normalize';
import { BusinessDirectory, type BusinessAccessView } from '../../businesses/public';
import { AccessPolicy } from '../domain/access-policy';
import { ChallengeRepository } from '../domain/challenge.repository';
import { InvalidAccessCodeError, TooManyRequestsError } from '../domain/errors';
import { AccessCodeService } from './access-code.service';
import { AccessMailer } from './access-mailer';

export interface BossSession {
  accessToken: string;
  business: { id: string; name: string };
  boss: { name: string; email: string };
}

/** What the boss sees about their own business after signing in. */
export interface BossOverview {
  business: { id: string; name: string; status: 'active' | 'paused'; modules: readonly string[] };
  boss: { name: string; email: string };
}

/** Signing in as a boss: ask for a code, use it, and read the session. Passwordless sign-in by email. */
@Injectable()
export class BossSessionService {
  constructor(
    private readonly directory: BusinessDirectory,
    private readonly codes: AccessCodeService,
    private readonly challenges: ChallengeRepository,
    private readonly mailer: AccessMailer,
    private readonly tokens: TokenService,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  /**
   * Emails a new code to the boss, if that email is the current boss of that active business. It answers
   * the same in every case (assigned or not, too soon or not) so it reveals nothing about who is assigned.
   * The only visible refusal is a rate limit, which counts every request alike.
   */
  async requestLoginCode(input: { businessId: string; email: string; ip: string }): Promise<void> {
    const email = normalizeEmail(input.email);
    await this.codes.assertCanRequest({ businessId: input.businessId, email, ip: input.ip });

    const business = await this.directory.find(input.businessId);
    if (!this.isCurrentBoss(business, email)) return;

    const last = await this.challenges.latestCreatedAt(business.id, email);
    if (last && this.clock.now().getTime() - last.getTime() < this.policy.resendCooldownMs) return;

    const { challenge, code } = await this.codes.issue({
      businessId: business.id,
      assignmentId: business.boss.assignmentId,
      email,
      purpose: 'login',
    });
    this.mailer.dispatch({
      challengeId: challenge.id,
      purpose: 'login',
      businessId: business.id,
      businessName: business.name,
      bossName: business.boss.name,
      email,
      code,
    });
  }

  /** Verifies the code, spends it and opens a session for this boss of this business. */
  async verify(input: { businessId: string; email: string; code: string; ip: string }): Promise<BossSession> {
    const email = normalizeEmail(input.email);
    const business = await this.directory.find(input.businessId);
    if (!this.isCurrentBoss(business, email)) {
      // Count the try like any other, so probing unassigned emails costs the same as guessing codes.
      await this.codes.verify({ ...input, email, assignmentId: 'none' }).catch((error: unknown) => {
        if (error instanceof TooManyRequestsError) throw error;
      });
      throw new InvalidAccessCodeError();
    }
    await this.codes.verify({ businessId: business.id, assignmentId: business.boss.assignmentId, email, code: input.code, ip: input.ip });

    const accessToken = await this.tokens.issue({
      userId: email,
      role: 'business-boss',
      businessId: business.id,
      assignmentId: business.boss.assignmentId,
    });
    return { accessToken, business: { id: business.id, name: business.name }, boss: { name: business.boss.name, email } };
  }

  /** The business and boss of a session whose assignment the guard has already confirmed. */
  async overview(principal: BusinessBossPrincipal): Promise<BossOverview> {
    const business = await this.directory.find(principal.businessId);
    if (!business || business.boss.assignmentId !== principal.assignmentId) throw new UnauthorizedException();
    return {
      business: { id: business.id, name: business.name, status: business.status, modules: business.modules },
      boss: { name: business.boss.name, email: business.boss.email },
    };
  }

  /** An active business whose current boss has that email. */
  private isCurrentBoss(business: BusinessAccessView | null, email: string): business is BusinessAccessView {
    return business !== null && business.status === 'active' && business.boss.email === email;
  }
}
