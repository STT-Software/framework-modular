import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import { generateCode, hmacCode, sameHmac } from '../domain/code-hmac';
import { InvalidAccessCodeError, TooManyRequestsError } from '../domain/errors';
import { InMemoryChallengeRepository, InMemoryRateLimiter, testPolicy } from '../fakes.spec';
import { AccessCodeService } from './access-code.service';

const BUSINESS = 'b'.repeat(24);
const EMAIL = 'ana@cafecentral.co';
const ASSIGNMENT = 'assignment-1';
const IP = '203.0.113.7';

function setup(policyOverrides = {}) {
  const challenges = new InMemoryChallengeRepository();
  const clock = new FixedClock();
  const policy = testPolicy(policyOverrides);
  const codes = new AccessCodeService(challenges, new InMemoryRateLimiter(), policy, clock);
  const issue = (overrides = {}) => codes.issue({ businessId: BUSINESS, assignmentId: ASSIGNMENT, email: EMAIL, purpose: 'login', ...overrides });
  const verify = (code: string, overrides = {}) =>
    codes.verify({ businessId: BUSINESS, assignmentId: ASSIGNMENT, email: EMAIL, code, ip: IP, ...overrides });
  return { challenges, clock, policy, codes, issue, verify };
}

/** A six-digit string that is not `code`. */
const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe('one-time code generation and protection', () => {
  it('generates six digits, always, including the ones that start with zero', () => {
    for (let i = 0; i < 500; i++) assert.match(generateCode(), /^\d{6}$/);
  });

  it('stores a protected form of the code, never the code', async () => {
    const { challenges, issue } = setup();
    const { code } = await issue();
    const stored = JSON.stringify(challenges.items);
    assert.ok(!stored.includes(code), 'the code must not appear anywhere in what is stored');
    assert.match(challenges.items[0].codeHmac, /^[0-9a-f]{64}$/);
  });

  it('ties the protected value to the challenge, business, assignment, email, purpose and server key', () => {
    const binding = { challengeId: 'c1', businessId: 'b1', assignmentId: 'a1', email: 'x@y.co', purpose: 'login' };
    const base = hmacCode('k'.repeat(40), binding, '123456');
    assert.ok(sameHmac(base, hmacCode('k'.repeat(40), binding, '123456')));
    for (const changed of [
      hmacCode('K'.repeat(40), binding, '123456'),
      hmacCode('k'.repeat(40), { ...binding, challengeId: 'c2' }, '123456'),
      hmacCode('k'.repeat(40), { ...binding, businessId: 'b2' }, '123456'),
      hmacCode('k'.repeat(40), { ...binding, assignmentId: 'a2' }, '123456'),
      hmacCode('k'.repeat(40), { ...binding, email: 'z@y.co' }, '123456'),
      hmacCode('k'.repeat(40), { ...binding, purpose: 'invitation' }, '123456'),
      hmacCode('k'.repeat(40), binding, '123457'),
    ]) {
      assert.ok(!sameHmac(base, changed));
    }
  });
});

describe('verifying a code', () => {
  it('accepts the right code once, and never again', async () => {
    const { issue, verify } = setup();
    const { code } = await issue();

    await verify(code);
    await assert.rejects(verify(code), InvalidAccessCodeError, 'a used code does not work a second time');
  });

  it('rejects a wrong code, and locks the code after the allowed tries even if the right one comes next', async () => {
    const { issue, verify, challenges } = setup();
    const { code } = await issue();

    for (let i = 0; i < 5; i++) await assert.rejects(verify(wrongCodeFor(code)), InvalidAccessCodeError);
    await assert.rejects(verify(code), InvalidAccessCodeError);
    assert.equal(challenges.byStatus('locked').length, 1);
  });

  it('lets the right code through on the last allowed try', async () => {
    const { issue, verify } = setup();
    const { code } = await issue();
    for (let i = 0; i < 4; i++) await assert.rejects(verify(wrongCodeFor(code)), InvalidAccessCodeError);
    await verify(code);
  });

  it('rejects an expired code, checking the time itself instead of trusting the database to have deleted it', async () => {
    const { issue, verify, clock } = setup();
    const { code } = await issue();
    clock.advance(10 * 60_000 + 1);
    await assert.rejects(verify(code), InvalidAccessCodeError);
  });

  it('accepts the code until the very last moment of its life', async () => {
    const { issue, verify, clock } = setup();
    const { code } = await issue();
    clock.advance(10 * 60_000 - 1000);
    await verify(code);
  });

  it('does not accept a code for another business, another email or another assignment', async () => {
    const { issue, verify } = setup();
    const { code } = await issue();

    await assert.rejects(verify(code, { businessId: 'c'.repeat(24) }), InvalidAccessCodeError);
    await assert.rejects(verify(code, { email: 'otra@persona.co' }), InvalidAccessCodeError);
    await assert.rejects(verify(code, { assignmentId: 'assignment-2' }), InvalidAccessCodeError);
    await verify(code);
  });

  it('does not accept a revoked code (the boss was replaced)', async () => {
    const { issue, verify, codes } = setup();
    const { code } = await issue();
    await codes.revokeAllExcept(BUSINESS, 'assignment-2');
    await assert.rejects(verify(code), InvalidAccessCodeError);
  });

  it('keeps the codes of the current assignment when revoking the others', async () => {
    const { issue, verify, codes } = setup();
    const { code } = await issue();
    await codes.revokeAllExcept(BUSINESS, ASSIGNMENT);
    await verify(code);
  });

  it('answers the same for every kind of failure', async () => {
    const { issue, verify, clock } = setup();
    const { code } = await issue();
    const failures: Error[] = [];
    for (const attempt of [
      () => verify(wrongCodeFor(code)),
      () => verify(code, { businessId: 'c'.repeat(24) }),
      () => verify(code, { email: 'otra@persona.co' }),
    ]) {
      failures.push(await attempt().then(() => new Error('should have failed'), (e: Error) => e));
    }
    clock.advance(11 * 60_000);
    failures.push(await verify(code).then(() => new Error('should have failed'), (e: Error) => e));
    assert.ok(failures.every((e) => e instanceof InvalidAccessCodeError));
    assert.equal(new Set(failures.map((e) => e.message)).size, 1);
  });
});

describe('requesting another code', () => {
  it('invalidates the previous code of the same person and business', async () => {
    const { issue, verify, challenges } = setup();
    const first = await issue();
    const second = await issue();

    await assert.rejects(verify(first.code), InvalidAccessCodeError);
    assert.equal(challenges.byStatus('superseded').length, 1);
    await verify(second.code);
  });

  it('does not let a locked new code bring an older one back to life', async () => {
    const { issue, verify } = setup();
    const first = await issue();
    const second = await issue();
    for (let i = 0; i < 5; i++) await assert.rejects(verify(wrongCodeFor(second.code)), InvalidAccessCodeError);
    await assert.rejects(verify(first.code), InvalidAccessCodeError);
  });

  it('does not let asking for new codes reset the tries: the total per person and business has its own limit', async () => {
    const { issue, verify, codes, clock } = setup();
    let lastCode = '';
    // Ten wrong tries spread over several codes use up the limit for this person and business.
    for (let round = 0; round < 3; round++) {
      lastCode = (await issue()).code;
      const tries = round < 2 ? 4 : 2;
      for (let i = 0; i < tries; i++) await assert.rejects(verify(wrongCodeFor(lastCode)), InvalidAccessCodeError);
      clock.advance(1000);
    }
    await assert.rejects(verify(lastCode), TooManyRequestsError, 'even the right code is refused once the limit is spent');
    await assert.rejects(codes.verify({ businessId: BUSINESS, assignmentId: ASSIGNMENT, email: EMAIL, code: lastCode, ip: IP }), TooManyRequestsError);
  });

  it('limits the tries from one IP over any number of businesses', async () => {
    const { issue, verify } = setup({ ipAttemptLimit: 3, contextAttemptLimit: 100 });
    await issue();
    for (let i = 0; i < 3; i++) await assert.rejects(verify('000000', { businessId: `${i}`.repeat(24) }), InvalidAccessCodeError);
    await assert.rejects(verify('000000', { businessId: '9'.repeat(24) }), TooManyRequestsError);
  });

  it('lets the limits start over once their window passes', async () => {
    // The code must outlive the 15-minute window, or this would fail for expiry instead of for the limit.
    const { issue, verify, clock } = setup({ contextAttemptLimit: 2, ttlMs: 60 * 60_000 });
    const { code } = await issue();
    await assert.rejects(verify(wrongCodeFor(code)), InvalidAccessCodeError);
    await assert.rejects(verify(wrongCodeFor(code)), InvalidAccessCodeError);
    await assert.rejects(verify(code), TooManyRequestsError);
    clock.advance(15 * 60_000 + 1000);
    await verify(code);
  });

  it('limits how many codes can be requested per person and business, and per IP', async () => {
    // A refused request still counts for the IP: nobody gets free tries after being told no.
    const { codes } = setup({ contextSendLimit: 2, ipSendLimit: 4 });
    const request = (overrides = {}) => codes.assertCanRequest({ businessId: BUSINESS, email: EMAIL, ip: IP, ...overrides });

    await request();
    await request();
    await assert.rejects(request(), TooManyRequestsError);
    await request({ email: 'otra@persona.co' });
    await assert.rejects(request({ email: 'otra3@persona.co' }), TooManyRequestsError, 'the IP limit applies across people');
  });

  it('tells how long to wait when a limit is hit', async () => {
    const { codes } = setup({ contextSendLimit: 1 });
    await codes.assertCanRequest({ businessId: BUSINESS, email: EMAIL, ip: IP });
    const error = await codes.assertCanRequest({ businessId: BUSINESS, email: EMAIL, ip: IP }).then(() => null, (e: unknown) => e);
    assert.ok(error instanceof TooManyRequestsError);
    assert.ok(error.retryAfterSeconds > 0 && error.retryAfterSeconds <= 3600);
  });
});

describe('simultaneous verifications', () => {
  it('lets at most one of several parallel correct requests spend the code', async () => {
    const { issue, verify } = setup();
    const { code } = await issue();

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => verify(code)));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => (r as PromiseRejectedResult).reason instanceof InvalidAccessCodeError));
  });

  it('counts parallel wrong guesses so they cannot exceed the tries of one code', async () => {
    const { issue, verify, challenges } = setup();
    const { code } = await issue();

    await Promise.allSettled(Array.from({ length: 20 }, () => verify(wrongCodeFor(code))));
    assert.equal(challenges.items[0].attempts, 5);
    assert.equal(challenges.items[0].status, 'locked');
  });
});
