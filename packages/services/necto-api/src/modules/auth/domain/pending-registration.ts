import type { IdentityDocumentType } from './super-admin';

/** What the registration code is bound to (see `platform/otp/code-hmac`). */
export const REGISTRATION_CODE_PURPOSE = 'super-admin-registration';

/**
 * A super admin registration waiting for the code emailed to its address. The account does not exist until the
 * code is confirmed. The code itself is never stored: only its HMAC, bound to this record, the email and the purpose.
 */
export interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  /** bcrypt hash of the password, computed when the form was sent. */
  passwordHash: string;
  identityDocumentType: IdentityDocumentType;
  identityDocument: string;
  termsAcceptedAt: Date;
  codeHmac: string;
  /** Wrong codes tried against the current code. */
  attempts: number;
  /** When the current code stops working (MongoDB also removes the record then). */
  expiresAt: Date;
  /** Earliest moment a new code may be requested. */
  resendAvailableAt: Date;
  /**
   * Codes emailed to this address in the current window (registrations and resends). It survives a new registration
   * with the same email, so restarting the form does not reset the limit.
   */
  sends: number;
  /** Start of the current sending window. */
  windowStartedAt: Date;
  /** When MongoDB removes the record: the end of the code or of the window, whichever is later. */
  purgeAt: Date;
}
