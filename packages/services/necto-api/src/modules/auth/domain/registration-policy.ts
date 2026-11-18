/**
 * How strict the registration codes are. It reuses the `OTP_*` settings of the whole backend (see `.env.example`):
 * the same secret, validity, tries per code and time between codes as the business access codes.
 */
export abstract class RegistrationPolicy {
  /** Server-only key for the HMAC that protects the stored codes (`OTP_SECRET`). */
  abstract readonly secret: string;
  abstract readonly ttlMs: number;
  /** Wrong tries allowed against one code; then it is locked until a new one is requested. */
  abstract readonly maxAttempts: number;
  abstract readonly resendCooldownMs: number;
  /** Codes that may be emailed to one address per window, counting registrations and resends. */
  abstract readonly maxSendsPerWindow: number;
  abstract readonly sendWindowMs: number;
  /** Public address of the web app, where the email link points. */
  abstract readonly publicAppUrl: string;
}
