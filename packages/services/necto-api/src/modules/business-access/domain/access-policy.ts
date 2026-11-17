/**
 * Every number that decides how strict the access codes and sessions are, plus the secret that protects the codes.
 * They come from the environment (see `.env.example`), so they can be tuned without touching code.
 */
export abstract class AccessPolicy {
  /** Server-only key for the HMAC that protects the stored codes. */
  abstract readonly secret: string;
  /** How long a code is valid. */
  abstract readonly ttlMs: number;
  /** Tries allowed against ONE code before it is locked. */
  abstract readonly maxAttempts: number;
  /** Minimum time between two codes for the same email. */
  abstract readonly resendCooldownMs: number;
  /** Tries allowed in total, over any number of codes, for one email within the window. */
  abstract readonly attemptWindowMs: number;
  abstract readonly contextAttemptLimit: number;
  /** Tries allowed from one IP within the window, over any email. */
  abstract readonly ipAttemptLimit: number;
  /** Codes that may be requested within the window, per email and per IP. */
  abstract readonly sendWindowMs: number;
  abstract readonly contextSendLimit: number;
  abstract readonly ipSendLimit: number;
  /** Public address of the web app, where the email link points. */
  abstract readonly publicAppUrl: string;

  /** Lifetime of the short access token the browser sends with each request. */
  abstract readonly accessTokenSeconds: number;
  /** A normal session: ends after this long without being renewed... */
  abstract readonly sessionIdleMs: number;
  /** ...and in any case this long after it started. */
  abstract readonly sessionMaxMs: number;
  /** A remembered device: the same two limits, never more than thirty days in total. */
  abstract readonly rememberIdleMs: number;
  abstract readonly rememberMaxMs: number;
  /** How recent the last code must be to allow a sensitive action. */
  abstract readonly sensitiveReverifyMs: number;
  /** True when the web app is served over https: the session cookie is then marked Secure. */
  abstract readonly secureCookies: boolean;
}
