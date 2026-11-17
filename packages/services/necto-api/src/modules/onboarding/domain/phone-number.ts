import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

/** A "+" followed by digits, spaces, dashes, dots and parentheses. */
const ALLOWED = /^\+[\d\s().-]+$/;

/**
 * Turns what a client sends as a phone into its canonical E.164 form (`+573001234567`), or null when it is not a valid
 * mobile number of its country. The number must carry its country code (`+57...`): there is no default country, so the
 * same input always means the same number.
 *
 * Uses the `mobile` metadata of libphonenumber-js, so landlines are rejected. Spaces, dashes, dots and parentheses are
 * accepted and dropped ("+57 300 123-4567" becomes "+573001234567"). The DTO, the service and the phone migration
 * script all use this one function, so "the same number" means exactly the same thing everywhere, and the unique index
 * on `phone` compares canonical forms.
 */
export function normalizePhoneNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  // Without a "+" the library would need a default country; the API never guesses one. Only digits and the usual
  // separators are allowed: on its own the library would also accept "+573001234567x" or a number inside a sentence.
  if (text.length > 32 || !ALLOWED.test(text)) return null;
  const parsed = parsePhoneNumberFromString(text);
  return parsed?.isValid() ? parsed.number : null;
}
