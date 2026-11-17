import type { AdminSession, SessionEndReason } from './admin-session';

/** What the access module needs to persist sessions. Changes are conditional, so a revoked session can never be revived. */
export abstract class SessionRepository {
  abstract create(session: AdminSession): Promise<void>;
  abstract findById(id: string): Promise<AdminSession | null>;
  /**
   * Moves the idle expiry forward and records the visit, only if the session is still active.
   * Returns the updated session, or null if it was ended or expired in the meantime.
   */
  abstract renew(id: string, now: Date, idleExpiresAt: Date): Promise<AdminSession | null>;
  /** Records that the person proved the email again, only if the session is still active. */
  abstract markVerified(id: string, now: Date): Promise<AdminSession | null>;
  /** Ends the session. True only for the call that ended it. */
  abstract revoke(id: string, reason: SessionEndReason, now: Date): Promise<boolean>;
  /** Ends every active session of the email except `exceptId`. Returns how many were ended. */
  abstract revokeAllOfEmail(email: string, exceptId: string | null, reason: SessionEndReason, now: Date): Promise<number>;
}
