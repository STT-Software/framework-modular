import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { AccessPolicy } from '../domain/access-policy';
import { purposeFamily, SIGN_IN_PURPOSES, type AccessChallenge, type ChallengePurpose, type NewChallenge } from '../domain/challenge';
import { ChallengeRepository } from '../domain/challenge.repository';
import { generateCode, hmacCode, sameHmac } from '../../../platform/otp/code-hmac';
import { InvalidAccessCodeError, TooManyRequestsError } from '../domain/errors';
import { RateLimiter } from '../domain/rate-limiter';

export interface IssueInput {
  /** Normalized. */
  email: string;
  purpose: ChallengePurpose;
  /** Invitations and manual codes: what triggered the code. */
  businessId?: string | null;
  assignmentId?: string | null;
  /** Manual codes only: the super admin who generated it. */
  issuedBy?: string | null;
}

/** A freshly issued code. `code` exists only here, in memory, long enough to be emailed: it is never stored or logged. */
export interface IssuedCode {
  challenge: NewChallenge;
  code: string;
}

export interface VerifyInput {
  email: string;
  code: string;
  ip: string;
  /** Which codes may satisfy this check: sign-in codes to open a session, reverify codes to confirm one. */
  purposes: readonly ChallengePurpose[];
}

/**
 * The one-time codes themselves: issuing, protecting, verifying and limiting them. It knows nothing about
 * businesses: a code belongs to an email address and a purpose.
 */
@Injectable()
export class AccessCodeService {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly limiter: RateLimiter,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  /** Counts a request for a new code against the per-IP and per-email limits. */
  async assertCanRequest(input: { email: string; ip: string }): Promise<void> {
    await this.enforce(
      [
        [`request:ip:${input.ip}`, this.policy.ipSendLimit],
        [`request:email:${input.email}`, this.policy.contextSendLimit],
      ],
      this.policy.sendWindowMs,
    );
  }

  /**
   * Issues a new code and invalidates the previous ones of the same person and purpose family.
   * The older codes are superseded AFTER the new one exists, so there is never a moment without a valid code,
   * and a locked newest code can never "reveal" an older pending one.
   */
  async issue(input: IssueInput): Promise<IssuedCode> {
    const now = this.clock.now();
    const id = randomUUID();
    const code = generateCode();
    const challenge: NewChallenge = {
      id,
      email: input.email,
      purpose: input.purpose,
      businessId: input.businessId ?? null,
      assignmentId: input.assignmentId ?? null,
      issuedBy: input.issuedBy ?? null,
      codeHmac: hmacCode(this.policy.secret, { challengeId: id, email: input.email, purpose: input.purpose }, code),
      expiresAt: new Date(now.getTime() + this.policy.ttlMs),
      maxAttempts: this.policy.maxAttempts,
      createdAt: now,
      // A manual code is handed over by the owner, never emailed: say so instead of pretending a send is in progress.
      delivery: { status: input.purpose === 'manual' ? 'not-sent' : 'sending', attemptedAt: now, acceptedAt: null, failedAt: null, failureCode: null },
    };
    await this.challenges.create(challenge);
    await this.challenges.supersedePending(input.email, purposeFamily(input.purpose), id);
    return { challenge, code };
  }

  /** Cancels the pending invitations and manual codes of the business that are not for the current boss (the boss was replaced). */
  revokeForBusinessExcept(businessId: string, currentAssignmentId: string): Promise<void> {
    return this.challenges.revokePendingForBusiness(businessId, currentAssignmentId);
  }

  /**
   * Is there a manual code waiting to be used for this email? While one is, a sign-in request must not replace it
   * (a new code would cancel the one the owner handed over).
   */
  async hasPendingManualCode(email: string): Promise<boolean> {
    const pending = await this.challenges.findLatestPending({ email, purposes: SIGN_IN_PURPOSES, now: this.clock.now() });
    return pending?.purpose === 'manual';
  }

  /** When the newest code of this email in the family of `purpose` was issued (to enforce the time between codes). */
  latestIssuedAt(email: string, purpose: ChallengePurpose): Promise<Date | null> {
    return this.challenges.latestCreatedAt(email, purposeFamily(purpose));
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
        [`verify:email:${input.email}`, this.policy.contextAttemptLimit],
      ],
      this.policy.attemptWindowMs,
    );

    const now = this.clock.now();
    const challenge = await this.challenges.reserveAttempt({ email: input.email, purposes: input.purposes, now });
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
    return { challengeId: challenge.id, email: challenge.email, purpose: challenge.purpose };
  }
}
