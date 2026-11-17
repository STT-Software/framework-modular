import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { testPolicy } from '../fakes.spec';
import { clearSessionCookie, readCookie, SESSION_COOKIE, setSessionCookie } from './session-cookie';

const request = (cookie?: string) => ({ headers: { cookie } }) as unknown as Request;

function recordingResponse() {
  const calls: { name: string; value?: string; options: Record<string, unknown>; cleared: boolean }[] = [];
  const response = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => calls.push({ name, value, options, cleared: false }),
    clearCookie: (name: string, options: Record<string, unknown>) => calls.push({ name, options, cleared: true }),
  } as unknown as Response;
  return { response, calls };
}

describe('reading the session cookie', () => {
  it('finds it among other cookies', () => {
    assert.equal(readCookie(request(`a=1; ${SESSION_COOKIE}=abc.def; b=2`), SESSION_COOKIE), 'abc.def');
  });

  it('ignores cookies that only look similar, and a missing or broken header', () => {
    assert.equal(readCookie(request(`x${SESSION_COOKIE}=nope; ${SESSION_COOKIE}x=nope`), SESSION_COOKIE), undefined);
    assert.equal(readCookie(request(undefined), SESSION_COOKIE), undefined);
    assert.equal(readCookie(request(`${SESSION_COOKIE}=%E0%A4%A`), SESSION_COOKIE), undefined);
  });
});

describe('writing the session cookie', () => {
  it('is HttpOnly and SameSite=Strict, so scripts cannot read it and other sites cannot send it', () => {
    const { response, calls } = recordingResponse();
    setSessionCookie(response, testPolicy(), 'value', null);
    assert.equal(calls[0].options.httpOnly, true);
    assert.equal(calls[0].options.sameSite, 'strict');
  });

  it('has no Max-Age for a normal session (it ends when the browser closes) and one for a remembered device', () => {
    const normal = recordingResponse();
    setSessionCookie(normal.response, testPolicy(), 'value', null);
    assert.ok(!('maxAge' in normal.calls[0].options));
    const remembered = recordingResponse();
    setSessionCookie(remembered.response, testPolicy(), 'value', 30 * 24 * 60 * 60_000);
    assert.equal(remembered.calls[0].options.maxAge, 30 * 24 * 60 * 60_000);
  });

  it('is marked Secure when the web app is served over https', () => {
    const secure = recordingResponse();
    setSessionCookie(secure.response, testPolicy({ secureCookies: true }), 'value', null);
    assert.equal(secure.calls[0].options.secure, true);
  });

  it('is cleared with the same attributes it was set with', () => {
    const { response, calls } = recordingResponse();
    clearSessionCookie(response, testPolicy());
    assert.equal(calls[0].cleared, true);
    assert.equal(calls[0].options.httpOnly, true);
    assert.equal(calls[0].options.path, '/');
  });
});
