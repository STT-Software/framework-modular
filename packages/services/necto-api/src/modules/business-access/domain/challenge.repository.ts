import type { AccessChallenge, ChallengePurpose, Delivery, NewChallenge } from './challenge';

/** What the access module needs to persist its codes. Every state change is conditional, so races cannot double-spend a code. */
export abstract class ChallengeRepository {
  abstract create(challenge: NewChallenge): Promise<void>;

  /** Marks as superseded the pending codes of this email whose purpose is in `purposes`, except the one that replaces them. */
  abstract supersedePending(email: string, purposes: readonly ChallengePurpose[], exceptId: string): Promise<void>;

  /** The newest code of this email that is still pending and not expired, whatever its tries. Null if there is none. */
  abstract findLatestPending(query: { email: string; purposes: readonly ChallengePurpose[]; now: Date }): Promise<AccessChallenge | null>;

  /** Revokes the pending invitations and manual codes of the business that do not belong to `keepAssignmentId` (the boss was replaced). */
  abstract revokePendingForBusiness(businessId: string, keepAssignmentId: string): Promise<void>;

  /**
   * Takes one try against the newest usable code of this email with one of these purposes, and returns it with
   * the try already counted. Usable means pending, not expired and with tries left. Null if there is none.
   * Doing the count and the check in one operation is what stops parallel guesses from exceeding the limit.
   */
  abstract reserveAttempt(query: { email: string; purposes: readonly ChallengePurpose[]; now: Date }): Promise<AccessChallenge | null>;

  /** Locks a code after too many wrong tries. */
  abstract lock(id: string): Promise<void>;

  /** Spends the code: true only for the one caller that changed it from pending to consumed. */
  abstract consume(id: string, now: Date): Promise<boolean>;

  /** When the newest code of this email with one of these purposes was issued. */
  abstract latestCreatedAt(email: string, purposes: readonly ChallengePurpose[]): Promise<Date | null>;

  /** The newest invitation code of the business. */
  abstract latestInvitation(businessId: string): Promise<AccessChallenge | null>;

  abstract recordDelivery(id: string, delivery: Delivery): Promise<void>;
}
