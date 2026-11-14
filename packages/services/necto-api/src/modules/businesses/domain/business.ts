import type { BusinessCategoryId, BusinessModuleId } from './catalog';

/** Paused blocks the boss's operational access; the owner can still see, edit and resume the business. */
export type BusinessStatus = 'active' | 'paused';

/**
 * The boss of a business: exactly one is current at any time. It lives INSIDE the business document, so
 * creating or replacing a boss is a single write: a business can never exist without a boss, and a replaced
 * boss stops being valid at the same instant the new one starts.
 *
 * `assignmentId` identifies this person as boss of this business. A new one is created when the boss is
 * replaced; sessions and emailed codes are tied to it, which is how replacing the boss cuts the old access.
 */
export interface BossAssignment {
  assignmentId: string;
  name: string;
  /** Normalized for comparison: trimmed and lowercase, nothing provider-specific. */
  email: string;
  assignedAt: Date;
}

/** A boss that was replaced. Kept for audit. */
export interface RevokedBossAssignment extends BossAssignment {
  revokedAt: Date;
}

/** What describes a business, already validated and normalized. */
export interface BusinessProfile {
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  supportEmail: string | null;
  website: string | null;
  category: BusinessCategoryId;
  /** Only when the category is "other"; null otherwise. */
  categoryOther: string | null;
  currency: string;
  timezone: string;
  modules: BusinessModuleId[];
}

export interface BossInput {
  name: string;
  email: string;
}

/** What the owner sends to create or edit a business: its profile and its boss. */
export interface BusinessDraft {
  profile: BusinessProfile;
  boss: BossInput;
}

export interface Business extends BusinessProfile {
  id: string;
  /** The super admin who owns it. It comes from the session, never from the request. */
  ownerId: string;
  status: BusinessStatus;
  boss: BossAssignment;
  /** Increases with every change; a write only succeeds if nobody changed the business since it was read. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
