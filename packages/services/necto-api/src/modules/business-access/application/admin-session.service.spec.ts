import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSessionCookie } from '../domain/admin-session';
import { InvalidAccessCodeError, ReverificationRequiredError, SessionExpiredError, TooManyRequestsError } from '../domain/errors';
import { setupAdminAccess } from '../fakes.spec';

const IP = '203.0.113.1';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('how long a session lasts', () => {
  it('a normal session is a browser-session cookie that ends after two hours idle and twelve in total', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const { started } = await signIn();
    assert.equal(started.cookieMaxAgeMs, null, 'no Max-Age: the cookie dies when the browser closes');
    assert.equal(started.session.remember, false);
    assert.equal(started.session.absoluteExpiresAt.getTime() - started.session.createdAt.getTime(), 12 * HOUR);
    assert.equal(started.session.idleExpiresAt.getTime() - started.session.createdAt.getTime(), 2 * HOUR);
    clock.advance(2 * HOUR - MINUTE);
    assert.ok(await sessions.resolveCookie(started.cookieValue));
    clock.advance(2 * MINUTE);
    assert.equal(await sessions.resolveCookie(started.cookieValue), null, 'idle for too long');
  });

  it('a remembered device lasts thirty days at most, and only when the person asked for it', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const { started } = await signIn({ remember: true });
    assert.equal(started.session.remember, true);
    assert.equal(started.cookieMaxAgeMs, 30 * DAY);
    assert.equal(started.session.absoluteExpiresAt.getTime() - started.session.createdAt.getTime(), 30 * DAY);
    // Used every few days, it keeps going...
    for (let day = 0; day < 4; day++) {
      clock.advance(7 * DAY);
      await sessions.refresh(started.cookieValue);
    }
    // ...but never past thirty days from the code.
    clock.advance(3 * DAY);
    assert.equal(await sessions.resolveCookie(started.cookieValue), null);
  });

  it('never lasts more than thirty days even if the configuration asks for more', async () => {
    const { signIn } = setupAdminAccess({ rememberMaxMs: 90 * DAY });
    const { started } = await signIn({ remember: true });
    assert.equal(started.session.absoluteExpiresAt.getTime() - started.session.createdAt.getTime(), 30 * DAY);
  });

  it('is not remembered unless the person says so', async () => {
    const { signIn } = setupAdminAccess();
    assert.equal((await signIn()).started.session.remember, false);
  });
});

describe('the cookie secret', () => {
  it('is stored only as a hash, so reading the database gives nobody a session', async () => {
    const { signIn, sessionRepository } = setupAdminAccess();
    const { started } = await signIn();
    const secret = parseSessionCookie(started.cookieValue)!.secret;
    assert.ok(!JSON.stringify([...sessionRepository.items.values()]).includes(secret));
    assert.match([...sessionRepository.items.values()][0].secretHash, /^[0-9a-f]{64}$/);
  });

  it('is rejected when forged, truncated or from another session', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const first = await signIn();
    clock.advance(61_000);
    const second = await signIn();
    const { id } = parseSessionCookie(first.started.cookieValue)!;
    const { secret } = parseSessionCookie(second.started.cookieValue)!;
    for (const forged of [undefined, '', 'garbage', `${id}.${secret}`, first.started.cookieValue.slice(0, -2), `${id}.${'A'.repeat(43)}`]) {
      assert.equal(await sessions.resolveCookie(forged), null, String(forged));
    }
  });
});

describe('renewing a session', () => {
  it('gives a new access token and slides the idle expiry forward, never past the absolute limit', async () => {
    const { signIn, sessions, clock, sessionRepository } = setupAdminAccess();
    const { started } = await signIn();
    clock.advance(90 * MINUTE);
    const grant = await sessions.refresh(started.cookieValue);
    assert.ok(grant.accessToken.length > 20);
    const renewed = (await sessionRepository.findById(started.session.id))!;
    assert.equal(renewed.idleExpiresAt.getTime(), clock.now().getTime() + 2 * HOUR);
    // Used every ninety minutes, it keeps going; near the end of its twelve hours the idle window is cut at the limit.
    for (let step = 0; step < 6; step++) {
      clock.advance(90 * MINUTE);
      await sessions.refresh(started.cookieValue);
    }
    const last = (await sessionRepository.findById(started.session.id))!;
    assert.equal(last.idleExpiresAt.getTime(), last.absoluteExpiresAt.getTime());
    clock.advance(2 * HOUR);
    await assert.rejects(sessions.refresh(started.cookieValue), SessionExpiredError, 'twelve hours after the code, however active');
  });

  it('only returns the businesses authorized at that moment, and ends the session if there are none left', async () => {
    const { signIn, sessions, directory, business, sessionRepository } = setupAdminAccess();
    const { started } = await signIn();
    directory.set({ ...business, status: 'paused' });
    await assert.rejects(sessions.refresh(started.cookieValue), SessionExpiredError);
    assert.equal((await sessionRepository.findById(started.session.id))!.revokedReason, 'no-access');
    directory.set(business);
    await assert.rejects(sessions.refresh(started.cookieValue), SessionExpiredError, 'resuming the business does not revive an ended session');
  });

  it('does not bring an ended session back', async () => {
    const { signIn, sessions } = setupAdminAccess();
    const { started } = await signIn();
    await sessions.endByCookie(started.cookieValue, 'signed-out');
    await assert.rejects(sessions.refresh(started.cookieValue), SessionExpiredError);
  });
});

describe('ending a session', () => {
  it('sign out ends it at once: the cookie and the access token stop working', async () => {
    const { signIn, sessions, tokens } = setupAdminAccess();
    const { started, grant } = await signIn();
    const claims = await tokens.verify(grant.accessToken);
    assert.ok(claims && claims.role === 'business-admin');
    await sessions.requireActive(started.session.id, started.session.email);
    await sessions.endByCookie(started.cookieValue, 'signed-out');
    assert.equal(await sessions.resolveCookie(started.cookieValue), null);
    await assert.rejects(sessions.requireActive(started.session.id, started.session.email), SessionExpiredError, 'a token still inside its ten minutes is useless');
  });

  it('forgetting a device whose session already expired still cleans it up, and ending twice is harmless', async () => {
    const { signIn, sessions, clock, sessionRepository } = setupAdminAccess();
    const { started } = await signIn();
    clock.advance(3 * HOUR);
    await sessions.endByCookie(started.cookieValue, 'signed-out');
    await sessions.endByCookie(started.cookieValue, 'signed-out');
    await sessions.endByCookie('garbage', 'signed-out');
    await sessions.endByCookie(undefined, 'signed-out');
    assert.ok((await sessionRepository.findById(started.session.id))!.revokedAt);
  });

  it('a token cannot be used with the session of another person', async () => {
    const { signIn, sessions } = setupAdminAccess();
    const { started } = await signIn();
    await assert.rejects(sessions.requireActive(started.session.id, 'otra@persona.co'), SessionExpiredError);
  });

  it('ending one device does not end the others', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const phone = await signIn({ remember: true });
    clock.advance(61_000);
    const laptop = await signIn();
    await sessions.endByCookie(phone.started.cookieValue, 'signed-out');
    assert.equal(await sessions.resolveCookie(phone.started.cookieValue), null);
    assert.ok(await sessions.resolveCookie(laptop.started.cookieValue));
  });
});

describe('sensitive actions ask for a recent verification', () => {
  it('lets a freshly signed-in session through, and asks again after ten minutes', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const { started } = await signIn();
    sessions.requireRecentVerification(started.session);
    clock.advance(10 * MINUTE + 1000);
    assert.throws(() => sessions.requireRecentVerification(started.session), ReverificationRequiredError);
  });

  it('a new code confirmed while signed in makes the session recently verified again', async () => {
    const { signIn, sessions, clock, transport, mailer, sessionRepository } = setupAdminAccess();
    const { started } = await signIn();
    clock.advance(30 * MINUTE);
    await sessions.requestReverification(started.session, IP);
    await mailer.drain();
    assert.match(transport.sent.at(-1)!.subject, /confirmar/i);
    await sessions.reverify(started.session, transport.lastCode(), IP);
    sessions.requireRecentVerification((await sessionRepository.findById(started.session.id))!);
  });

  it('a wrong or sign-in code does not count as a reverification', async () => {
    const { signIn, sessions, clock, requestCode, transport, mailer } = setupAdminAccess();
    const { started } = await signIn();
    clock.advance(61_000);
    const signInCode = (await requestCode())!;
    await assert.rejects(sessions.reverify(started.session, signInCode, IP), InvalidAccessCodeError);
    await sessions.requestReverification(started.session, IP);
    await mailer.drain();
    const code = transport.lastCode();
    await assert.rejects(sessions.reverify(started.session, code === '000000' ? '111111' : '000000', IP), InvalidAccessCodeError);
  });

  it('a reverification code cannot be used twice', async () => {
    const { signIn, sessions, transport, mailer } = setupAdminAccess();
    const { started } = await signIn();
    await sessions.requestReverification(started.session, IP);
    await mailer.drain();
    const code = transport.lastCode();
    await sessions.reverify(started.session, code, IP);
    await assert.rejects(sessions.reverify(started.session, code, IP), InvalidAccessCodeError);
  });

  it('limits how often a reverification code can be requested', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const { started } = await signIn();
    await sessions.requestReverification(started.session, IP);
    await assert.rejects(sessions.requestReverification(started.session, IP), TooManyRequestsError);
    clock.advance(61_000);
    await sessions.requestReverification(started.session, IP);
  });

  it('"sign out everywhere else" ends the other devices but keeps this one', async () => {
    const { signIn, sessions, clock, sessionRepository } = setupAdminAccess();
    const phone = await signIn({ remember: true });
    clock.advance(61_000);
    const laptop = await signIn();
    assert.equal(await sessions.revokeOthers(laptop.started.session), 1);
    assert.equal(await sessions.resolveCookie(phone.started.cookieValue), null);
    assert.ok(await sessions.resolveCookie(laptop.started.cookieValue));
    assert.equal(sessionRepository.activeOf(laptop.started.session.email, clock.now()).length, 1);
  });
});
