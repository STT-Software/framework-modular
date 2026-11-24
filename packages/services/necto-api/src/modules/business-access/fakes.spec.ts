import { EventBus } from '../../platform/events/event-bus';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../platform/security/token.service';
import { FixedClock } from '../../platform/time/fixed-clock.spec';
import { MailSendError, MailTransport, type MailAcceptance, type MailFailureCode, type MailMessage } from '../../platform/mail/mail-transport';
import { BusinessDirectory, BusinessModuleAccess, type BusinessAccessView, type BusinessModuleId } from '../businesses/public';
import { isSessionActive, type AdminSession, type SessionEndReason } from './domain/admin-session';
import { AccessCodeService } from './application/access-code.service';
import { AccessGrantsService } from './application/access-grants.service';
import { MemberAccessRegistry } from './application/member-access.registry';
import { MemberAccessSource, type MemberAssignment } from './domain/member-access';
import { AccessMailer } from './application/access-mailer';
import { AdminLoginService } from './application/admin-login.service';
import { AdminSessionService } from './application/admin-session.service';
import { AdministeredBusinessesService } from './application/administered-businesses.service';
import { AccessPolicy } from './domain/access-policy';
import type { AccessChallenge, ChallengePurpose, Delivery, NewChallenge } from './domain/challenge';
import { ChallengeRepository } from './domain/challenge.repository';
import { RateLimiter } from './domain/rate-limiter';
import { SessionRepository } from './domain/session.repository';

/** The product's initial policy, with room to change any value for a test. */
export function testPolicy(overrides: Partial<AccessPolicy> = {}): AccessPolicy {
  return {
    secret: 's'.repeat(48),
    ttlMs: 10 * 60_000,
    maxAttempts: 5,
    resendCooldownMs: 60_000,
    attemptWindowMs: 15 * 60_000,
    contextAttemptLimit: 10,
    ipAttemptLimit: 30,
    sendWindowMs: 60 * 60_000,
    contextSendLimit: 5,
    ipSendLimit: 20,
    publicAppUrl: 'http://localhost:6020',
    accessTokenSeconds: 600,
    sessionIdleMs: 2 * 60 * 60_000,
    sessionMaxMs: 12 * 60 * 60_000,
    rememberIdleMs: 14 * 24 * 60 * 60_000,
    rememberMaxMs: 30 * 24 * 60 * 60_000,
    sensitiveReverifyMs: 10 * 60_000,
    secureCookies: false,
    ...overrides,
  };
}

/** In-memory codes with the same conditional rules as the MongoDB repository. */
export class InMemoryChallengeRepository extends ChallengeRepository {
  readonly items: AccessChallenge[] = [];

  async create(challenge: NewChallenge) {
    this.items.push({ ...challenge, attempts: 0, status: 'pending', consumedAt: null });
  }

  async supersedePending(email: string, purposes: readonly ChallengePurpose[], exceptId: string) {
    for (const item of this.items) {
      if (item.email === email && purposes.includes(item.purpose) && item.status === 'pending' && item.id !== exceptId) item.status = 'superseded';
    }
  }

  async findLatestPending(query: { email: string; purposes: readonly ChallengePurpose[]; now: Date }) {
    const found = this.items
      .filter(
        (item) =>
          item.email === query.email &&
          query.purposes.includes(item.purpose) &&
          item.status === 'pending' &&
          item.expiresAt.getTime() > query.now.getTime(),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return found ? { ...found } : null;
  }

  async revokePendingForBusiness(businessId: string, keepAssignmentId: string) {
    for (const item of this.items) {
      if (item.businessId === businessId && ['invitation', 'manual'].includes(item.purpose) && item.status === 'pending' && item.assignmentId !== keepAssignmentId) {
        item.status = 'revoked';
      }
    }
  }

  async reserveAttempt(query: { email: string; purposes: readonly ChallengePurpose[]; now: Date }) {
    const usable = this.items
      .filter(
        (item) =>
          item.email === query.email &&
          query.purposes.includes(item.purpose) &&
          item.status === 'pending' &&
          item.expiresAt.getTime() > query.now.getTime() &&
          item.attempts < item.maxAttempts,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!usable) return null;
    usable.attempts += 1;
    return { ...usable };
  }

  async lock(id: string) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (item?.status === 'pending') item.status = 'locked';
  }

  async consume(id: string, now: Date) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item || item.status !== 'pending' || item.expiresAt.getTime() <= now.getTime()) return false;
    item.status = 'consumed';
    item.consumedAt = now;
    return true;
  }

  async latestCreatedAt(email: string, purposes: readonly ChallengePurpose[]) {
    const times = this.items.filter((i) => i.email === email && purposes.includes(i.purpose)).map((i) => i.createdAt.getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  }

  async latestInvitation(businessId: string) {
    const found = this.items
      .filter((i) => i.businessId === businessId && i.purpose === 'invitation')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return found ? { ...found } : null;
  }

  async recordDelivery(id: string, delivery: Delivery) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (item) item.delivery = delivery;
  }

  byStatus(status: AccessChallenge['status']) {
    return this.items.filter((item) => item.status === status);
  }
}

/** A fixed-window counter like the MongoDB one. */
export class InMemoryRateLimiter extends RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  async hit(key: string, limit: number, windowMs: number, now: Date) {
    const current = this.windows.get(key);
    const entry = current && current.start > now.getTime() - windowMs ? current : { start: now.getTime(), count: 0 };
    entry.count += 1;
    this.windows.set(key, entry);
    return { allowed: entry.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((entry.start + windowMs - now.getTime()) / 1000)) };
  }
}

/** In-memory sessions with the same conditional rules as the MongoDB repository. */
export class InMemorySessionRepository extends SessionRepository {
  readonly items = new Map<string, AdminSession>();

  async create(session: AdminSession) {
    this.items.set(session.id, { ...session });
  }

  async findById(id: string) {
    const found = this.items.get(id);
    return found ? { ...found } : null;
  }

  async renew(id: string, now: Date, idleExpiresAt: Date) {
    const found = this.items.get(id);
    if (!found || !isSessionActive(found, now)) return null;
    found.lastSeenAt = now;
    found.idleExpiresAt = idleExpiresAt;
    return { ...found };
  }

  async markVerified(id: string, now: Date) {
    const found = this.items.get(id);
    if (!found || !isSessionActive(found, now)) return null;
    found.verifiedAt = now;
    return { ...found };
  }

  async revoke(id: string, reason: SessionEndReason, now: Date) {
    const found = this.items.get(id);
    if (!found || found.revokedAt) return false;
    found.revokedAt = now;
    found.revokedReason = reason;
    return true;
  }

  async revokeAllOfEmail(email: string, exceptId: string | null, reason: SessionEndReason, now: Date) {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.email === email && item.id !== exceptId && isSessionActive(item, now)) {
        item.revokedAt = now;
        item.revokedReason = reason;
        count += 1;
      }
    }
    return count;
  }

  activeOf(email: string, now: Date) {
    return [...this.items.values()].filter((item) => item.email === email && isSessionActive(item, now));
  }
}

/** The businesses module as seen from here, with businesses the test sets by hand. */
export class FakeBusinessDirectory extends BusinessDirectory {
  readonly businesses = new Map<string, BusinessAccessView>();

  set(business: BusinessAccessView) {
    this.businesses.set(business.id, business);
  }

  async find(businessId: string) {
    return this.businesses.get(businessId) ?? null;
  }

  async findOwned(ownerId: string, businessId: string) {
    const business = this.businesses.get(businessId);
    return business && business.ownerId === ownerId ? business : null;
  }

  async findActiveByBossEmail(email: string) {
    return [...this.businesses.values()].filter((business) => business.status === 'active' && business.boss.email === email);
  }
}

/** Mirrors the real contract: enabled only if the business exists, is active and has the module. */
export class FakeModuleAccess extends BusinessModuleAccess {
  constructor(private readonly directory: FakeBusinessDirectory) {
    super();
  }

  async isEnabled(businessId: string, moduleId: BusinessModuleId) {
    const business = this.directory.businesses.get(businessId);
    return business !== undefined && business.status === 'active' && business.modules.includes(moduleId);
  }
}

export function aBusiness(overrides: Partial<BusinessAccessView> = {}): BusinessAccessView {
  return {
    id: 'a'.repeat(24),
    ownerId: 'owner-1',
    name: 'Café Central',
    status: 'active',
    category: 'gastronomy',
    categoryOther: null,
    modules: ['reservas'],
    boss: { assignmentId: 'assignment-1', name: 'Ana Gómez', email: 'ana@cafecentral.co' },
    ...overrides,
  };
}

/** A module that assigns operators, with the assignments the test sets. */
export class FakeMemberSource extends MemberAccessSource {
  private items: Array<MemberAssignment & { email: string }> = [];
  async assignmentsOf(email: string) {
    return this.items.filter((item) => item.email === email).map(({ email: _email, ...assignment }) => assignment);
  }
  assign(email: string, assignment: MemberAssignment) {
    this.items.push({ ...assignment, email });
  }
  remove(email: string, businessId: string) {
    this.items = this.items.filter((item) => !(item.email === email && item.businessId === businessId));
  }
}

/** Records the emails instead of sending them. `failWith` makes the next sends fail like a broken provider. */
export class RecordingMailTransport extends MailTransport {
  readonly sent: MailMessage[] = [];
  failWith: MailFailureCode | null = null;

  async send(message: MailMessage): Promise<MailAcceptance> {
    if (this.failWith) throw new MailSendError(this.failWith);
    this.sent.push(message);
    return { messageId: `<test-${this.sent.length}@necto.test>` };
  }

  /** The six-digit code written in the last email, as the person would read it. */
  lastCode(): string {
    const match = /Tu código: (\d{6})/.exec(this.sent.at(-1)?.text ?? '');
    if (!match) throw new Error('No email with a code was sent');
    return match[1];
  }
}

/** Everything the sign-in and session flow needs, wired with in-memory pieces and a clock the test controls. */
export function setupAdminAccess(policyOverrides: Partial<AccessPolicy> = {}) {
  const directory = new FakeBusinessDirectory();
  const business = aBusiness();
  directory.set(business);
  const challenges = new InMemoryChallengeRepository();
  const clock = new FixedClock();
  const policy = testPolicy(policyOverrides);
  const transport = new RecordingMailTransport();
  const codes = new AccessCodeService(challenges, new InMemoryRateLimiter(), policy, clock);
  const mailer = new AccessMailer(transport, challenges, policy, clock);
  const tokens = new TokenService(new JwtService({ secret: 'k'.repeat(32), signOptions: { expiresIn: '1h' } }));
  const sessionRepository = new InMemorySessionRepository();
  const administered = new AdministeredBusinessesService(directory, new FakeModuleAccess(directory));
  const events = new EventBus();
  const registry = new MemberAccessRegistry();
  const memberSource = new FakeMemberSource();
  registry.register(memberSource);
  const grants = new AccessGrantsService(directory, new FakeModuleAccess(directory), registry);
  const sessions = new AdminSessionService(sessionRepository, tokens, codes, mailer, grants, policy, clock);
  const login = new AdminLoginService(codes, mailer, sessions, grants, policy, clock, events);

  /** Asks for a code and returns it as the person would read it in the email. */
  async function requestCode(email = business.boss.email, ip = '203.0.113.1') {
    const before = transport.sent.length;
    await login.requestCode({ email, ip });
    await mailer.drain();
    return transport.sent.length > before ? transport.lastCode() : null;
  }

  /** Signs in end to end with a fresh code. */
  async function signIn(options: { email?: string; remember?: boolean; ip?: string; previousCookie?: string } = {}) {
    const email = options.email ?? business.boss.email;
    const code = await requestCode(email, options.ip);
    if (!code) throw new Error('No code was sent');
    return login.verifyCode({ email, code, ip: options.ip ?? '203.0.113.1', remember: options.remember ?? false, previousCookie: options.previousCookie });
  }

  return {
    directory, business, challenges, clock, policy, transport, codes, mailer, tokens,
    sessionRepository, administered, registry, events, memberSource, grants, sessions, login, requestCode, signIn,
  };
}
