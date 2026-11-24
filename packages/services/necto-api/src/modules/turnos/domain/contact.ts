import { LIMITS } from './catalog';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = new RegExp(`^\\+?[0-9]{${LIMITS.phoneDigits.min},${LIMITS.phoneDigits.max}}$`);
/** Digits with an optional leading +, without spaces, dots, dashes or parentheses. Null when it is not a phone number. */
export function normalizePhone(raw: string): string | null {
  const phone = raw.replace(/[\s().-]/g, '');
  return PHONE.test(phone) ? phone : null;
}
/** Lowercase and trimmed email, or null when it is not an email address. */
export function normalizeContactEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) && email.length <= LIMITS.operatorEmail.max ? email : null;
}
export function isEmail(value: string): boolean {
  return EMAIL.test(value);
}
