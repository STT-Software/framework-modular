import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/** Why a session was ended. Kept for audit; it never reaches the person. */
export type SessionEndReason = 'signed-out' | 'replaced' | 'revoked-by-user' | 'no-access';

/**
 * A server-side session of an administrator of businesses, identified by email. The browser holds a random secret
 * (an HttpOnly cookie); the server keeps only its hash, so reading the database does not give anyone a session.
 *
 * - `idleExpiresAt` moves forward each time the session is renewed, but never past `absoluteExpiresAt`.
 * - `absoluteExpiresAt` is fixed when the session starts: 30 days at most for a remembered device, hours otherwise.
 * - `verifiedAt` is the last time the person proved the email with a code; sensitive actions ask for a recent one.
 * - Ending a session (`revokedAt`) takes effect immediately: every request checks it.
 */
export interface AdminSession {
  id: string;
  email: string;
  secretHash: string;
  remember: boolean;
  createdAt: Date;
  verifiedAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionEndReason | null;
}

export function isSessionActive(session: AdminSession, now: Date): boolean {
  return session.revokedAt === null && session.idleExpiresAt.getTime() > now.getTime() && session.absoluteExpiresAt.getTime() > now.getTime();
}

/** A fresh session id and secret, and the cookie value that carries both (`<id>.<secret>`). */
export function newSessionSecret(): { id: string; secret: string; cookieValue: string } {
  const id = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  return { id, secret, cookieValue: `${id}.${secret}` };
}

/** SHA-256 is enough here: the secret has 256 bits of randomness, so there is nothing to brute-force. */
export function hashSessionSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

const COOKIE_VALUE = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/;

/** Splits a cookie value. Null for anything that is not exactly what we issued. */
export function parseSessionCookie(value: string | undefined): { id: string; secret: string } | null {
  const match = value ? COOKIE_VALUE.exec(value) : null;
  return match ? { id: match[1], secret: match[2] } : null;
}

export function sameSecret(secret: string, expectedHash: string): boolean {
  const left = Buffer.from(hashSessionSecret(secret), 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
