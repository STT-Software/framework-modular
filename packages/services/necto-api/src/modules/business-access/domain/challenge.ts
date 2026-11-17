/**
 * Why a code was issued:
 * - invitation: the first code, emailed when a person is assigned as boss of a business. It is a sign-in code like
 *   any other (it works for the email, not only for that business), and it also records the invitation's delivery.
 * - login: a code the person asked for on the access page.
 * - manual: a temporary code the OWNER of the business generated and copied to hand over by other means (it is never
 *   emailed). It is a sign-in code like any other, and `issuedBy` records who made it.
 * - reverify: a code asked for while signed in, to confirm a sensitive action.
 */
export type ChallengePurpose = 'invitation' | 'login' | 'manual' | 'reverify';

/** Codes that can open a session. */
export const SIGN_IN_PURPOSES: readonly ChallengePurpose[] = ['invitation', 'login', 'manual'];
/** Codes that can re-confirm an open session. */
export const REVERIFY_PURPOSES: readonly ChallengePurpose[] = ['reverify'];

/** Issuing a new code of a family cancels the pending ones of the same family, so only the newest works. */
export function purposeFamily(purpose: ChallengePurpose): readonly ChallengePurpose[] {
  return purpose === 'reverify' ? REVERIFY_PURPOSES : SIGN_IN_PURPOSES;
}

/**
 * - pending: can still be used.
 * - consumed: used once; it can never work again.
 * - revoked: cancelled because the boss was replaced (invitations only).
 * - superseded: replaced by a newer code for the same person.
 * - locked: too many wrong attempts.
 */
export type ChallengeStatus = 'pending' | 'consumed' | 'revoked' | 'superseded' | 'locked';

/**
 * What happened when we tried to send the code by email. "accepted" means the mail provider took the message;
 * it does NOT mean the person received it, and nothing here claims delivery: there is no "delivered" state
 * because we have no evidence of one. "not-sent" is a code that was never meant to be emailed (a manual one).
 */
export type DeliveryStatus = 'sending' | 'accepted' | 'failed' | 'not-sent';

export type DeliveryFailureCode = 'not-configured' | 'rejected' | 'timeout' | 'connection' | 'unknown';

export interface Delivery {
  status: DeliveryStatus;
  attemptedAt: Date;
  acceptedAt: Date | null;
  failedAt: Date | null;
  failureCode: DeliveryFailureCode | null;
}

/**
 * A one-time code issued to one email address. It is bound to the email and the purpose, so it cannot be used for
 * another person; WHICH businesses the person may enter is decided when the code is used, from the assignments that
 * are current at that moment (never from what was true when the code was sent). Only a protected form of the code is
 * stored (`codeHmac`), never the code.
 */
export interface AccessChallenge {
  id: string;
  /** Normalized email the code was sent to. */
  email: string;
  purpose: ChallengePurpose;
  /** Invitations and manual codes: the business and assignment that triggered the code. */
  businessId: string | null;
  assignmentId: string | null;
  /** Manual codes only: the super admin who generated it. */
  issuedBy: string | null;
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
