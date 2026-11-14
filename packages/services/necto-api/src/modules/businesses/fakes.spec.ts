import { randomUUID } from 'node:crypto';
import type { Business, BusinessStatus } from './domain/business';
import {
  BusinessRepository,
  type BusinessChange,
  type IdempotencyMark,
  type ListQuery,
  type NewBusiness,
} from './domain/business.repository';
import { IdempotencyKeyReusedError } from './domain/errors';

interface Stored extends Business {
  idempotencyKey: string;
  fingerprint: string;
  bossHistory: Array<{ assignmentId: string; email: string }>;
}

/** In-memory repository with the same rules as the MongoDB one: owner scoping, idempotency and version checks. */
export class InMemoryBusinessRepository extends BusinessRepository {
  readonly items = new Map<string, Stored>();
  /** When true, the next update finds the business already changed by someone else. */
  raceOnce = false;

  async insert(business: NewBusiness, mark: IdempotencyMark) {
    const existing = [...this.items.values()].find((item) => item.ownerId === business.ownerId && item.idempotencyKey === mark.key);
    if (existing) {
      if (existing.fingerprint !== mark.fingerprint) throw new IdempotencyKeyReusedError();
      return { business: this.copy(existing), created: false };
    }
    const now = new Date();
    const stored: Stored = {
      id: randomUUID().replace(/-/g, '').slice(0, 24),
      ownerId: business.ownerId,
      ...business.profile,
      status: 'active',
      boss: business.boss,
      version: 1,
      createdAt: now,
      updatedAt: now,
      idempotencyKey: mark.key,
      fingerprint: mark.fingerprint,
      bossHistory: [],
    };
    this.items.set(stored.id, stored);
    return { business: this.copy(stored), created: true };
  }

  async findOwned(ownerId: string, id: string) {
    const item = this.items.get(id);
    return item && item.ownerId === ownerId ? this.copy(item) : null;
  }

  async findById(id: string) {
    const item = this.items.get(id);
    return item ? this.copy(item) : null;
  }

  async list(ownerId: string, query: ListQuery) {
    const text = query.q?.toLowerCase();
    const matching = [...this.items.values()]
      .filter((item) => item.ownerId === ownerId)
      .filter((item) => !query.category || item.category === query.category)
      .filter((item) => !query.status || item.status === query.status)
      .filter((item) => !text || [item.name, item.boss.name, item.boss.email, item.address ?? ''].some((field) => field.toLowerCase().includes(text)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (query.page - 1) * query.pageSize;
    return { items: matching.slice(start, start + query.pageSize).map((item) => this.copy(item)), total: matching.length };
  }

  async updateOwned(ownerId: string, id: string, expectedVersion: number, change: BusinessChange) {
    const item = this.items.get(id);
    if (!item || item.ownerId !== ownerId) return null;
    if (this.raceOnce) {
      this.raceOnce = false;
      item.version += 1;
    }
    if (item.version !== expectedVersion) return null;
    Object.assign(item, change.profile, { boss: change.boss, version: item.version + 1, updatedAt: new Date() });
    if (change.revokedBoss) item.bossHistory.push({ assignmentId: change.revokedBoss.assignmentId, email: change.revokedBoss.email });
    return this.copy(item);
  }

  async setStatus(ownerId: string, id: string, status: BusinessStatus) {
    const item = this.items.get(id);
    if (!item || item.ownerId !== ownerId) return null;
    item.status = status;
    item.version += 1;
    return this.copy(item);
  }

  private copy(item: Stored): Business {
    const { idempotencyKey: _key, fingerprint: _fingerprint, bossHistory: _history, ...business } = item;
    return { ...business, modules: [...business.modules], boss: { ...business.boss } };
  }
}
