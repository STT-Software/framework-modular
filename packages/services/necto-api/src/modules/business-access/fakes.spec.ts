import { MailSendError, MailTransport, type MailAcceptance, type MailFailureCode, type MailMessage } from '../../platform/mail/mail-transport';
import { BusinessDirectory, type BusinessAccessView } from '../businesses/public';
import { AccessPolicy } from './domain/access-policy';
import type { AccessChallenge, Delivery, NewChallenge } from './domain/challenge';
import { ChallengeRepository } from './domain/challenge.repository';
import { RateLimiter } from './domain/rate-limiter';

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
    ...overrides,
  };
}

/** In-memory codes with the same conditional rules as the MongoDB repository. */
export class InMemoryChallengeRepository extends ChallengeRepository {
  readonly items: AccessChallenge[] = [];

  async create(challenge: NewChallenge) {
    this.items.push({ ...challenge, attempts: 0, status: 'pending', consumedAt: null });
  }

  async supersedePending(businessId: string, email: string, exceptId: string) {
    for (const item of this.items) {
      if (item.businessId === businessId && item.email === email && item.status === 'pending' && item.id !== exceptId) item.status = 'superseded';
    }
  }

  async revokePendingExcept(businessId: string, keepAssignmentId: string) {
    for (const item of this.items) {
      if (item.businessId === businessId && item.status === 'pending' && item.assignmentId !== keepAssignmentId) item.status = 'revoked';
    }
  }

  async reserveAttempt(query: { businessId: string; email: string; assignmentId: string; now: Date }) {
    const usable = this.items
      .filter(
        (item) =>
          item.businessId === query.businessId &&
          item.email === query.email &&
          item.assignmentId === query.assignmentId &&
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

  async latestCreatedAt(businessId: string, email: string) {
    const times = this.items.filter((i) => i.businessId === businessId && i.email === email).map((i) => i.createdAt.getTime());
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
}

export function aBusiness(overrides: Partial<BusinessAccessView> = {}): BusinessAccessView {
  return {
    id: 'a'.repeat(24),
    ownerId: 'owner-1',
    name: 'Café Central',
    status: 'active',
    modules: ['reservas'],
    boss: { assignmentId: 'assignment-1', name: 'Ana Gómez', email: 'ana@cafecentral.co' },
    ...overrides,
  };
}

/** Records what would be sent and can be told to fail like a real provider would. */
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
