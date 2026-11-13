import type { Business, BusinessProfile, BusinessStatus, BossAssignment, RevokedBossAssignment } from './business';
import type { BusinessCategoryId } from './catalog';

export interface NewBusiness {
  ownerId: string;
  profile: BusinessProfile;
  boss: BossAssignment;
}

/** Makes creating a business safe to repeat: same owner + same key = same business. */
export interface IdempotencyMark {
  key: string;
  /** Hash of the request. The same key with a different request is an error, not a replay. */
  fingerprint: string;
}

export interface ListQuery {
  page: number;
  pageSize: number;
  /** Matches the business name, the boss name or email, or the address. */
  q?: string;
  category?: BusinessCategoryId;
  status?: BusinessStatus;
}

export interface BusinessChange {
  profile: BusinessProfile;
  boss: BossAssignment;
  /** Set when the boss was replaced: the previous one, to keep in the history. */
  revokedBoss: RevokedBossAssignment | null;
}

/** What the businesses module needs to persist businesses. Every read and write is scoped to the owner. */
export abstract class BusinessRepository {
  /**
   * Creates the business with its boss in one write. If the owner already created one with the same key,
   * returns that one with `created: false`.
   * @throws IdempotencyKeyReusedError if the key was used with a different request.
   */
  abstract insert(business: NewBusiness, mark: IdempotencyMark): Promise<{ business: Business; created: boolean }>;

  abstract findOwned(ownerId: string, id: string): Promise<Business | null>;

  /** Any owner. Only for the public directory contract used by other modules. */
  abstract findById(id: string): Promise<Business | null>;

  abstract list(ownerId: string, query: ListQuery): Promise<{ items: Business[]; total: number }>;

  /** Saves the change only if the business still has `expectedVersion`. Returns null if it does not match. */
  abstract updateOwned(ownerId: string, id: string, expectedVersion: number, change: BusinessChange): Promise<Business | null>;

  abstract setStatus(ownerId: string, id: string, status: BusinessStatus): Promise<Business | null>;
}
