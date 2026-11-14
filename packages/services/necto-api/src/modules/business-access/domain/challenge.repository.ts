import type { AccessChallenge, Delivery, NewChallenge } from './challenge';

/** What the access module needs to persist its codes. Every state change is conditional, so races cannot double-spend a code. */
export abstract class ChallengeRepository {
  abstract create(challenge: NewChallenge): Promise<void>;

  /** Marks as superseded the pending codes of this person for this business, except the one that replaces them. */
  abstract supersedePending(businessId: string, email: string, exceptId: string): Promise<void>;

  /** Revokes every pending code of the business that does not belong to `keepAssignmentId`. */
  abstract revokePendingExcept(businessId: string, keepAssignmentId: string): Promise<void>;

  /**
   * Takes one try against the newest usable code of this person, business and assignment, and returns it with
   * the try already counted. Usable means pending, not expired and with tries left. Null if there is none.
   * Doing the count and the check in one operation is what stops parallel guesses from exceeding the limit.
   */
  abstract reserveAttempt(query: { businessId: string; email: string; assignmentId: string; now: Date }): Promise<AccessChallenge | null>;

  /** Locks a code after too many wrong tries. */
  abstract lock(id: string): Promise<void>;

  /** Spends the code: true only for the one caller that changed it from pending to consumed. */
  abstract consume(id: string, now: Date): Promise<boolean>;

  /** When the newest code (any purpose) for this person and business was issued. */
  abstract latestCreatedAt(businessId: string, email: string): Promise<Date | null>;

  /** The newest invitation code of the business. */
  abstract latestInvitation(businessId: string): Promise<AccessChallenge | null>;

  abstract recordDelivery(id: string, delivery: Delivery): Promise<void>;
}
