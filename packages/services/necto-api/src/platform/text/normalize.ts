/**
 * Emails are compared trimmed and in lowercase. No provider-specific tricks (dots, plus suffixes) are applied.
 * It lives in the platform because two modules must agree on it exactly: the email a business is created with
 * and the email its boss types to sign in are compared after this same normalization.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Trimmed text; empty becomes null. */
export function optionalText(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}
