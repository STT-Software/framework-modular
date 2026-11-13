/**
 * Every number that decides how strict the access codes are, plus the secret that protects them.
 * They come from the environment (see `.env.example`), so they can be tuned without touching code.
 */
export abstract class AccessPolicy {
  /** Server-only key for the HMAC that protects the stored codes. */
  abstract readonly secret: string;
  /** How long a code is valid. */
  abstract readonly ttlMs: number;
  /** Tries allowed against ONE code before it is locked. */
  abstract readonly maxAttempts: number;
  /** Minimum time between two codes for the same person and business. */
  abstract readonly resendCooldownMs: number;
  /** Tries allowed in total, over any number of codes, for one person and business within the window. */
  abstract readonly attemptWindowMs: number;
  abstract readonly contextAttemptLimit: number;
  /** Tries allowed from one IP within the window, over any business. */
  abstract readonly ipAttemptLimit: number;
  /** Codes that may be requested within the window, per person and business and per IP. */
  abstract readonly sendWindowMs: number;
  abstract readonly contextSendLimit: number;
  abstract readonly ipSendLimit: number;
  /** Public address of the web app, where the email link points. */
  abstract readonly publicAppUrl: string;
}
