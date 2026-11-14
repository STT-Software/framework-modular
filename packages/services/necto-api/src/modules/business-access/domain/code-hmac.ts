import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Six digits from a cryptographically secure generator, uniformly distributed (leading zeros kept). */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** What a stored code is tied to: changing any of these makes the code useless. */
export interface CodeBinding {
  challengeId: string;
  businessId: string;
  assignmentId: string;
  email: string;
  purpose: string;
}

/**
 * HMAC-SHA-256 of the code, keyed with a server-only secret and bound to its challenge. A six-digit code has
 * only a million possibilities, so a plain hash could be reversed in an instant by anyone who read the
 * database; without the server key, the stored value is useless.
 */
export function hmacCode(secret: string, binding: CodeBinding, code: string): string {
  const message = [binding.challengeId, binding.businessId, binding.assignmentId, binding.email, binding.purpose, code].join('|');
  return createHmac('sha256', secret).update(message).digest('hex');
}

/** Constant-time comparison, so the time taken does not reveal how much of a code was right. */
export function sameHmac(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}
