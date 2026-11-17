import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { AccessPolicy } from '../domain/access-policy';
import { SIGN_IN_PURPOSES } from '../domain/challenge';
import { EmailNotAssignedError, InvalidAccessCodeError } from '../domain/errors';
import { AccessCodeService } from './access-code.service';
import { AccessMailer } from './access-mailer';
import { AdminSessionService, type SessionGrant, type StartedSession } from './admin-session.service';
import { AdministeredBusinessesService } from './administered-businesses.service';

/** What the public request-a-code endpoint can say: only the rules, never whether the email is assigned. */
export interface CodeRequestRules {
  expiresInMinutes: number;
  resendAfterSeconds: number;
  /** Tries allowed against one code before it is locked. */
  maxAttempts: number;
}

/**
 * Signing in as an administrator of businesses: the person types an email, receives a six-digit code and uses it.
 * Knowing an email is never enough: the session only starts with a valid code for that email, and only if the email
 * is the current boss of at least one active business.
 */
@Injectable()
export class AdminLoginService {
  constructor(
    private readonly codes: AccessCodeService,
    private readonly mailer: AccessMailer,
    private readonly sessions: AdminSessionService,
    private readonly businesses: AdministeredBusinessesService,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  /** The numbers the page shows next to the code box. They are the same for every email. */
  rules(): CodeRequestRules {
    return {
      expiresInMinutes: Math.round(this.policy.ttlMs / 60_000),
      resendAfterSeconds: Math.round(this.policy.resendCooldownMs / 1000),
      maxAttempts: this.policy.maxAttempts,
    };
  }

  /**
   * Emails a code to the current boss of an active business. An email that is not one is refused with
   * `EmailNotAssignedError`, so the page can say that the owner must invite them first (this reveals whether an email
   * is assigned; the limits below count every request alike, assigned or not). Asking again too soon, or while the
   * owner's manual code is waiting, answers the same as a send and does not issue another code.
   */
  async requestCode(input: { email: string; ip: string }): Promise<void> {
    await this.codes.assertCanRequest(input);
    const person = await this.businesses.person(input.email);
    if (!person) throw new EmailNotAssignedError();
    if (await this.codes.hasPendingManualCode(input.email)) return;
    const last = await this.codes.latestIssuedAt(input.email, 'login');
    if (last && this.clock.now().getTime() - last.getTime() < this.policy.resendCooldownMs) return;
    const { challenge, code } = await this.codes.issue({ email: input.email, purpose: 'login' });
    this.mailer.dispatch({
      challengeId: challenge.id,
      purpose: 'login',
      businessName: null,
      recipientName: person.name,
      email: input.email,
      code,
    });
  }

  /**
   * Checks the code, spends it and opens a session. A previous session on this browser is ended so it cannot be
   * left behind. Wrong, expired, used, locked and "no business" are all the same `InvalidAccessCodeError`.
   */
  async verifyCode(input: {
    email: string;
    code: string;
    ip: string;
    remember: boolean;
    previousCookie?: string;
  }): Promise<{ started: StartedSession; grant: SessionGrant }> {
    await this.codes.verify({ email: input.email, code: input.code, ip: input.ip, purposes: SIGN_IN_PURPOSES });
    const businesses = await this.businesses.list(input.email);
    if (businesses.length === 0) throw new InvalidAccessCodeError();
    if (input.previousCookie) await this.sessions.endByCookie(input.previousCookie, 'replaced');
    const started = await this.sessions.start({ email: input.email, remember: input.remember });
    return { started, grant: await this.sessions.grant(started.session, businesses) };
  }
}
