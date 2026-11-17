import type { Request, Response } from 'express';
import { AccessPolicy } from '../domain/access-policy';

/** The cookie that holds the session secret. HttpOnly: the page's scripts can never read it. */
export const SESSION_COOKIE = 'necto_admin_session';

/** Reads one cookie from the request without a cookie-parsing dependency. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function cookieOptions(policy: AccessPolicy) {
  return {
    httpOnly: true,
    // Strict: the browser never attaches it to a request that starts on another site.
    sameSite: 'strict' as const,
    secure: policy.secureCookies,
    path: '/',
  };
}

/** `maxAgeMs` null makes a browser-session cookie (gone when the browser closes); a number is the remembered device. */
export function setSessionCookie(response: Response, policy: AccessPolicy, value: string, maxAgeMs: number | null): void {
  response.cookie(SESSION_COOKIE, value, { ...cookieOptions(policy), ...(maxAgeMs !== null ? { maxAge: maxAgeMs } : {}) });
}

export function clearSessionCookie(response: Response, policy: AccessPolicy): void {
  response.clearCookie(SESSION_COOKIE, cookieOptions(policy));
}
