import type { PendingRegistration } from './pending-registration';

/** Persistence of the registrations waiting for their code. Implemented in `infrastructure/`. */
export abstract class PendingRegistrationRepository {
  /** A fresh id, needed before saving because the code HMAC is bound to it. */
  abstract newId(): string;

  /** Saves a pending registration and removes any other pending one with the same email or username. */
  abstract replace(pending: PendingRegistration): Promise<void>;

  abstract findById(id: string): Promise<PendingRegistration | null>;

  /** The pending registration of this email, if any (its sending window carries over to a new one). */
  abstract findByEmail(email: string): Promise<PendingRegistration | null>;

  /**
   * Reserves one try atomically, only while fewer than `maxAttempts` were used, and returns the new count. Null when
   * the record is gone or already locked. Reserving before comparing keeps parallel requests within the limit.
   */
  abstract reserveAttempt(id: string, maxAttempts: number): Promise<number | null>;

  /** Puts a new code in place: new HMAC, attempts back to zero, new expiry, cooldown and purge time; one more send. */
  abstract renewCode(
    id: string,
    change: Pick<PendingRegistration, 'codeHmac' | 'expiresAt' | 'resendAvailableAt' | 'purgeAt'>,
  ): Promise<void>;

  abstract delete(id: string): Promise<void>;
}
