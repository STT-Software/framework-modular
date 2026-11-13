import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { AccessPolicy } from '../domain/access-policy';
import type { AccessChallenge, ChallengePurpose, NewChallenge } from '../domain/challenge';
import { ChallengeRepository } from '../domain/challenge.repository';
import { generateCode, hmacCode, sameHmac } from '../domain/code-hmac';
import { InvalidAccessCodeError, TooManyRequestsError } from '../domain/errors';
import { RateLimiter } from '../domain/rate-limiter';

export interface IssueInput {
  businessId: string;
  assignmentId: string;
  /** Normalized. */
  email: string;
  purpose: ChallengePurpose;
}

/** A freshly issued code. `code` exists only here, in memory, long enough to be emailed: it is never stored or logged. */
export interface IssuedCode {
  challenge: NewChallenge;
  code: string;
}

export interface VerifyInput {
  businessId: string;
  assignmentId: string;
  email: string;
  code: string;
  ip: string;
}

/**
 * The one-time codes themselves: issuing, protecting, verifying and limiting them. It knows nothing about
 * businesses or emails beyond the identifiers a code is bound to.
 */
@Injectable()
export class AccessCodeService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly limiter: RateLimiter,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  /** Counts a request for a new code against the per-IP and per-person-and-business limits. */
  async assertCanRequest(input: { businessId: string; email: string; ip: string }): Promise<void> {
    await this.enforce(
      [
        [`request:ip:${input.ip}`, this.policy.ipSendLimit],
        [`request:ctx:${input.businessId}:${input.email}`, this.policy.contextSendLimit],
      ],
      this.policy.sendWindowMs,
    );
  }

  /**
   * Issues a new code and invalidates the previous ones of the same person and business.
   * The older codes are superseded AFTER the new one exists, so there is never a moment without a valid code,
   * and a locked newest code can never "reveal" an older pending one.
   */
  async issue(input: IssueInput): Promise<IssuedCode> {
    const now = this.clock.now();
    const id = randomUUID();
    const code = generateCode();
    const challenge: NewChallenge = {
      id,
      businessId: input.businessId,
      assignmentId: input.assignmentId,
      email: input.email,
      purpose: input.purpose,
      codeHmac: hmacCode(this.policy.secret, { challengeId: id, ...input }, code),
      expiresAt: new Date(now.getTime() + this.policy.ttlMs),
      maxAttempts: this.policy.maxAttempts,
      createdAt: now,
      delivery: { status: 'sending', attemptedAt: now, acceptedAt: null, failedAt: null, failureCode: null },
    };
    await this.challenges.create(challenge);
    await this.challenges.supersedePending(input.businessId, input.email, id);
    return { challenge, code };
  }

  /** Cancels every pending code of the business that is not for the current boss (the boss was replaced). */
  revokeAllExcept(businessId: string, currentAssignmentId: string): Promise<void> {
    return this.challenges.revokePendingExcept(businessId, currentAssignmentId);
  }

  /**
   * Checks a code and spends it. Succeeds at most once per code, even with two simultaneous correct requests:
   * the tries are counted and the code is consumed with conditional writes that only one caller can win.
   * Every failure is the same `InvalidAccessCodeError`.
   */
  async verify(input: VerifyInput): Promise<void> {
    await this.enforce(
      [
        [`verify:ip:${input.ip}`, this.policy.ipAttemptLimit],
        [`verify:ctx:${input.businessId}:${input.email}`, this.policy.contextAttemptLimit],
      ],
      this.policy.attemptWindowMs,
    );

    const now = this.clock.now();
    const challenge = await this.challenges.reserveAttempt({
      businessId: input.businessId,
      email: input.email,
      assignmentId: input.assignmentId,
      now,
    });
    if (!challenge) throw new InvalidAccessCodeError();

    const expected = hmacCode(this.policy.secret, this.bindingOf(challenge), input.code);
    if (!sameHmac(expected, challenge.codeHmac)) {
      if (challenge.attempts >= challenge.maxAttempts) await this.challenges.lock(challenge.id);
      throw new InvalidAccessCodeError();
    }
    if (!(await this.challenges.consume(challenge.id, now))) throw new InvalidAccessCodeError();
  }

  /** Counts the event under every rule (so none is skipped) and fails if any of them is over its limit. */
  private async enforce(rules: ReadonlyArray<readonly [string, number]>, windowMs: number): Promise<void> {
    const now = this.clock.now();
    let retryAfter = 0;
    for (const [key, limit] of rules) {
      const result = await this.limiter.hit(key, limit, windowMs, now);
      if (!result.allowed) retryAfter = Math.max(retryAfter, result.retryAfterSeconds);
    }
    if (retryAfter > 0) throw new TooManyRequestsError(retryAfter);
  }

  private bindingOf(challenge: AccessChallenge) {
    return {
      challengeId: challenge.id,
      businessId: challenge.businessId,
      assignmentId: challenge.assignmentId,
      email: challenge.email,
      purpose: challenge.purpose,
    };
  }
}
