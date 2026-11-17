import { Injectable } from '@nestjs/common';
import { TokenService } from '../../../platform/security/token.service';
import { Clock } from '../../../platform/time/clock';
import {
  hashSessionSecret,
  isSessionActive,
  newSessionSecret,
  parseSessionCookie,
  sameSecret,
  type AdminSession,
  type SessionEndReason,
} from '../domain/admin-session';
import { AccessPolicy } from '../domain/access-policy';
import { REVERIFY_PURPOSES } from '../domain/challenge';
import { ReverificationRequiredError, SessionExpiredError, TooManyRequestsError } from '../domain/errors';
import { SessionRepository } from '../domain/session.repository';
import { AccessCodeService } from './access-code.service';
import { AccessMailer } from './access-mailer';
import { AdministeredBusinessesService, type AdministeredBusiness } from './administered-businesses.service';

/** A session that was just started: the cookie to give the browser and how long it should keep it. */
export interface StartedSession {
  session: AdminSession;
  cookieValue: string;
  /** Null: a browser-session cookie that disappears when the browser closes. */
  cookieMaxAgeMs: number | null;
}

/** What the browser receives to work with a session. */
export interface SessionGrant {
  accessToken: string;
  expiresInSeconds: number;
  email: string;
  remember: boolean;
  businesses: AdministeredBusiness[];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The life of an administrator's session: start it, tell whether it is still valid, renew it, end it, and ask for a
 * fresh email check before a sensitive action. The browser keeps a secret cookie; this service keeps only its hash.
 */
@Injectable()
export class AdminSessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
    private readonly codes: AccessCodeService,
    private readonly mailer: AccessMailer,
    private readonly businesses: AdministeredBusinessesService,
    private readonly policy: AccessPolicy,
    private readonly clock: Clock,
  ) {}

  /** Opens a session for an email that has just proven it. `remember` is the person's explicit choice. */
  async start(input: { email: string; remember: boolean }): Promise<StartedSession> {
    const now = this.clock.now();
    const { id, secret, cookieValue } = newSessionSecret();
    const maxMs = input.remember ? Math.min(this.policy.rememberMaxMs, THIRTY_DAYS_MS) : this.policy.sessionMaxMs;
    const idleMs = input.remember ? this.policy.rememberIdleMs : this.policy.sessionIdleMs;
    const absoluteExpiresAt = new Date(now.getTime() + maxMs);
    const session: AdminSession = {
      id,
      email: input.email,
      secretHash: hashSessionSecret(secret),
      remember: input.remember,
      createdAt: now,
      verifiedAt: now,
      lastSeenAt: now,
      idleExpiresAt: this.idleDeadline(now, idleMs, absoluteExpiresAt),
      absoluteExpiresAt,
      revokedAt: null,
      revokedReason: null,
    };
    await this.sessions.create(session);
    return { session, cookieValue, cookieMaxAgeMs: input.remember ? maxMs : null };
  }

  /** The short-lived token the browser sends on each request. The session itself is checked on every request. */
  issueAccessToken(session: AdminSession): Promise<string> {
    return this.tokens.issue(
      { userId: session.email, role: 'business-admin', sessionId: session.id },
      { expiresInSeconds: this.policy.accessTokenSeconds },
    );
  }

  /** The active session behind this cookie, or null (missing, forged, expired or ended). Never throws. */
  async resolveCookie(cookieValue: string | undefined): Promise<AdminSession | null> {
    const parsed = parseSessionCookie(cookieValue);
    if (!parsed) return null;
    const session = await this.sessions.findById(parsed.id);
    if (!session || !sameSecret(parsed.secret, session.secretHash)) return null;
    return isSessionActive(session, this.clock.now()) ? session : null;
  }

  /** Same as `resolveCookie`, for callers that need a session or a "start over" answer. */
  async requireCookie(cookieValue: string | undefined): Promise<AdminSession> {
    const session = await this.resolveCookie(cookieValue);
    if (!session) throw new SessionExpiredError();
    return session;
  }

  /**
   * Gives the browser a new access token and moves the idle expiry forward (never past the absolute one).
   * If the person no longer administers any active business, the session is ended instead.
   */
  async refresh(cookieValue: string | undefined): Promise<SessionGrant> {
    const session = await this.requireCookie(cookieValue);
    const businesses = await this.businesses.list(session.email);
    const now = this.clock.now();
    if (businesses.length === 0) {
      await this.sessions.revoke(session.id, 'no-access', now);
      throw new SessionExpiredError();
    }
    const idleMs = session.remember ? this.policy.rememberIdleMs : this.policy.sessionIdleMs;
    const renewed = await this.sessions.renew(session.id, now, this.idleDeadline(now, idleMs, session.absoluteExpiresAt));
    if (!renewed) throw new SessionExpiredError();
    return this.grant(renewed, businesses);
  }

  async grant(session: AdminSession, businesses: AdministeredBusiness[]): Promise<SessionGrant> {
    return {
      accessToken: await this.issueAccessToken(session),
      expiresInSeconds: this.policy.accessTokenSeconds,
      email: session.email,
      remember: session.remember,
      businesses,
    };
  }

  /** For the guard: the session a valid token points to must still be active and belong to the same email. */
  async requireActive(sessionId: string, email: string): Promise<AdminSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.email !== email || !isSessionActive(session, this.clock.now())) throw new SessionExpiredError();
    return session;
  }

  /**
   * Ends the session behind a cookie, even one that already expired (a stale cookie is still cleaned up).
   * Safe to call with nothing or with garbage: it then does nothing.
   */
  async endByCookie(cookieValue: string | undefined, reason: SessionEndReason): Promise<void> {
    const parsed = parseSessionCookie(cookieValue);
    if (!parsed) return;
    const session = await this.sessions.findById(parsed.id);
    if (session && sameSecret(parsed.secret, session.secretHash)) await this.sessions.revoke(session.id, reason, this.clock.now());
  }

  async endById(sessionId: string, reason: SessionEndReason): Promise<void> {
    await this.sessions.revoke(sessionId, reason, this.clock.now());
  }

  /** Emails a code to confirm a sensitive action. Limited like any other code request. */
  async requestReverification(session: AdminSession, ip: string): Promise<void> {
    await this.codes.assertCanRequest({ email: session.email, ip });
    const last = await this.codes.latestIssuedAt(session.email, 'reverify');
    const now = this.clock.now();
    if (last) {
      const waitMs = last.getTime() + this.policy.resendCooldownMs - now.getTime();
      if (waitMs > 0) throw new TooManyRequestsError(Math.ceil(waitMs / 1000));
    }
    const person = await this.businesses.person(session.email);
    const { challenge, code } = await this.codes.issue({ email: session.email, purpose: 'reverify' });
    this.mailer.dispatch({
      challengeId: challenge.id,
      purpose: 'reverify',
      businessName: null,
      recipientName: person?.name ?? session.email,
      email: session.email,
      code,
    });
  }

  /** Confirms the code and stamps the session as freshly verified. */
  async reverify(session: AdminSession, code: string, ip: string): Promise<{ verifiedAt: Date }> {
    await this.codes.verify({ email: session.email, code, ip, purposes: REVERIFY_PURPOSES });
    const now = this.clock.now();
    const updated = await this.sessions.markVerified(session.id, now);
    if (!updated) throw new SessionExpiredError();
    return { verifiedAt: now };
  }

  /** Throws unless the person confirmed their email recently (see `ADMIN_SENSITIVE_REVERIFY_MINUTES`). */
  requireRecentVerification(session: AdminSession): void {
    if (this.clock.now().getTime() - session.verifiedAt.getTime() > this.policy.sensitiveReverifyMs) throw new ReverificationRequiredError();
  }

  /** "Sign out everywhere else": ends every other session of this email. A sensitive action. */
  revokeOthers(session: AdminSession): Promise<number> {
    return this.sessions.revokeAllOfEmail(session.email, session.id, 'revoked-by-user', this.clock.now());
  }

  private idleDeadline(now: Date, idleMs: number, absoluteExpiresAt: Date): Date {
    return new Date(Math.min(now.getTime() + idleMs, absoluteExpiresAt.getTime()));
  }
}
