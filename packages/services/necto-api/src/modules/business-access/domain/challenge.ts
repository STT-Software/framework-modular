/** Why a code was issued: the first invitation sent when a boss is assigned, or a later sign-in. */
export type ChallengePurpose = 'invitation' | 'login';

/**
 * - pending: can still be used.
 * - consumed: used once; it can never work again.
 * - revoked: cancelled because the boss was replaced.
 * - superseded: replaced by a newer code for the same person and business.
 * - locked: too many wrong attempts.
 */
export type ChallengeStatus = 'pending' | 'consumed' | 'revoked' | 'superseded' | 'locked';

/**
 * What happened when we tried to send the code by email. "accepted" means the mail provider took the message;
 * it does NOT mean the person received it, and nothing here claims delivery: there is no "delivered" state
 * because we have no evidence of one.
 */
export type DeliveryStatus = 'sending' | 'accepted' | 'failed';

export type DeliveryFailureCode = 'not-configured' | 'rejected' | 'timeout' | 'connection' | 'unknown';

export interface Delivery {
  status: DeliveryStatus;
  attemptedAt: Date;
  acceptedAt: Date | null;
  failedAt: Date | null;
  failureCode: DeliveryFailureCode | null;
}

/**
 * A one-time code issued to the boss of one business. It is bound to the email, the business and the
 * assignment (this person as boss of this business), so it cannot be used for another business or after
 * the boss was replaced. Only a protected form of the code is stored (`codeHmac`), never the code.
 */
export interface AccessChallenge {
  id: string;
  businessId: string;
  assignmentId: string;
  /** Normalized email the code was sent to. */
  email: string;
  purpose: ChallengePurpose;
  codeHmac: string;
  expiresAt: Date;
  /** Wrong or right tries made against this code so far. */
  attempts: number;
  maxAttempts: number;
  status: ChallengeStatus;
  createdAt: Date;
  consumedAt: Date | null;
  delivery: Delivery;
}

export type NewChallenge = Omit<AccessChallenge, 'attempts' | 'status' | 'consumedAt'>;
