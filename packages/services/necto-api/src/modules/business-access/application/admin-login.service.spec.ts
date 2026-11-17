import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TokenService } from '../../../platform/security/token.service';
import { EmailNotAssignedError, InvalidAccessCodeError, TooManyRequestsError } from '../domain/errors';
import { aBusiness, InMemoryRateLimiter, setupAdminAccess } from '../fakes.spec';
import { InvitationService } from './invitation.service';

const IP = '203.0.113.1';
const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe('asking for a sign-in code', () => {
  it('emails a code to the current boss of an active business', async () => {
    const { requestCode, transport, business } = setupAdminAccess();
    assert.match((await requestCode())!, /^\d{6}$/);
    assert.equal(transport.sent.length, 1);
    assert.equal(transport.sent[0].to, business.boss.email);
    assert.ok(!transport.sent[0].text.includes(business.name), 'a sign-in email is not tied to one business');
  });

  it('refuses an email that is not the boss of any business, tells the owner must invite it first, and sends nothing', async () => {
    const { login, mailer, transport, challenges } = setupAdminAccess();
    const error = await login.requestCode({ email: 'otra@persona.co', ip: IP }).then(() => null, (e: unknown) => e);
    assert.ok(error instanceof EmailNotAssignedError);
    assert.equal(error.code, 'email-not-assigned');
    assert.match(error.message, /invite/);
    await mailer.drain();
    assert.equal(transport.sent.length, 0);
    assert.equal(challenges.items.length, 0, 'no code was created for it');
  });

  it('treats the boss of only a paused business, or of a replaced one, as not assigned', async () => {
    const { login, directory, business } = setupAdminAccess();
    directory.set({ ...business, status: 'paused' });
    await assert.rejects(login.requestCode({ email: business.boss.email, ip: IP }), EmailNotAssignedError);
    directory.set({ ...business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    await assert.rejects(login.requestCode({ email: business.boss.email, ip: IP }), EmailNotAssignedError);
  });

  it('still counts the refused requests: guessing which emails are assigned runs into the limits', async () => {
    const { login } = setupAdminAccess({ ipSendLimit: 3 });
    for (let i = 0; i < 3; i++) await assert.rejects(login.requestCode({ email: `nadie${i}@x.co`, ip: IP }), EmailNotAssignedError);
    await assert.rejects(login.requestCode({ email: 'nadie9@x.co', ip: IP }), TooManyRequestsError);
  });

  it('gives the page the same rules whatever the email: ten minutes, sixty seconds and five tries', async () => {
    const { login } = setupAdminAccess();
    assert.deepEqual(login.rules(), { expiresInMinutes: 10, resendAfterSeconds: 60, maxAttempts: 5 });
  });

  it('does not send a second code within the cooldown, and does again after it', async () => {
    const { login, mailer, transport, clock, business } = setupAdminAccess();
    const ask = () => login.requestCode({ email: business.boss.email, ip: IP });
    await ask();
    await ask();
    await mailer.drain();
    assert.equal(transport.sent.length, 1);
    clock.advance(61_000);
    await ask();
    await mailer.drain();
    assert.equal(transport.sent.length, 2);
  });

  it('refuses with a rate limit once the hourly cap for the email is exceeded', async () => {
    const { login, business } = setupAdminAccess({ contextSendLimit: 2 });
    const ask = () => login.requestCode({ email: business.boss.email, ip: IP });
    await ask();
    await ask();
    await assert.rejects(ask(), TooManyRequestsError);
  });

  it('does not say "delivered": a failed send is recorded as failed and nothing throws', async () => {
    const { login, mailer, transport, challenges, business } = setupAdminAccess();
    transport.failWith = 'not-configured';
    await login.requestCode({ email: business.boss.email, ip: IP });
    await mailer.drain();
    assert.equal(transport.sent.length, 0);
    assert.equal(challenges.items[0].delivery.status, 'failed');
    assert.equal(challenges.items[0].delivery.failureCode, 'not-configured');
  });
});

describe('signing in with a code', () => {
  it('opens a session and returns only the businesses this person administers', async () => {
    const { signIn, business } = setupAdminAccess();
    const { grant } = await signIn();
    assert.equal(grant.email, business.boss.email);
    assert.deepEqual(grant.businesses, [{ id: business.id, name: 'Café Central', category: 'gastronomy', categoryOther: null, modules: ['reservas'] }]);
    assert.ok(grant.accessToken.length > 20);
    assert.equal(grant.expiresInSeconds, 600);
  });

  it('puts the session id, not the businesses, in the access token', async () => {
    const { signIn, tokens } = setupAdminAccess();
    const { started, grant } = await signIn();
    const claims = await tokens.verify(grant.accessToken);
    assert.deepEqual(claims, { userId: 'ana@cafecentral.co', role: 'business-admin', sessionId: started.session.id });
  });

  it('lists several businesses when the same email is boss of several, and only the active ones', async () => {
    const { directory, business, signIn } = setupAdminAccess();
    directory.set(aBusiness({ id: 'b'.repeat(24), name: 'Casa Norte', boss: { ...business.boss, assignmentId: 'assignment-9' } }));
    directory.set(aBusiness({ id: 'c'.repeat(24), name: 'Casa Pausada', status: 'paused', boss: { ...business.boss, assignmentId: 'assignment-8' } }));
    const { grant } = await signIn();
    assert.deepEqual(grant.businesses.map((b) => b.name).sort(), ['Café Central', 'Casa Norte']);
  });

  it('never lists a business whose boss is someone else', async () => {
    const { directory, signIn } = setupAdminAccess();
    directory.set(aBusiness({ id: 'd'.repeat(24), name: 'Ajeno', boss: { assignmentId: 'assignment-5', name: 'Luis', email: 'luis@otro.co' } }));
    const { grant } = await signIn();
    assert.ok(!grant.businesses.some((b) => b.name === 'Ajeno'));
  });

  it('does not accept the same code twice, even for a fresh session', async () => {
    const { requestCode, login, business } = setupAdminAccess();
    const code = (await requestCode())!;
    const input = { email: business.boss.email, code, ip: IP, remember: false };
    await login.verifyCode(input);
    await assert.rejects(login.verifyCode(input), InvalidAccessCodeError);
  });

  it('answers the same for a wrong code, an email with no code and an email with no business', async () => {
    const { requestCode, login, business } = setupAdminAccess();
    const code = (await requestCode())!;
    const failures = await Promise.all([
      login.verifyCode({ email: business.boss.email, code: wrongCodeFor(code), ip: IP, remember: false }).catch((e: Error) => e),
      login.verifyCode({ email: 'otra@persona.co', code, ip: IP, remember: false }).catch((e: Error) => e),
    ]);
    assert.ok(failures.every((e) => e instanceof InvalidAccessCodeError));
    assert.equal(new Set(failures.map((e) => (e as Error).message)).size, 1);
  });

  it('rejects an expired code', async () => {
    const { requestCode, login, clock, business } = setupAdminAccess();
    const code = (await requestCode())!;
    clock.advance(10 * 60_000 + 1);
    await assert.rejects(login.verifyCode({ email: business.boss.email, code, ip: IP, remember: false }), InvalidAccessCodeError);
  });

  it('locks the code after five wrong tries, even if the right one comes later', async () => {
    const { requestCode, login, business } = setupAdminAccess();
    const code = (await requestCode())!;
    for (let i = 0; i < 5; i++) {
      await login.verifyCode({ email: business.boss.email, code: wrongCodeFor(code), ip: IP, remember: false }).catch(() => undefined);
    }
    await assert.rejects(login.verifyCode({ email: business.boss.email, code, ip: IP, remember: false }), InvalidAccessCodeError);
  });

  it('lets only one of two simultaneous correct verifications win', async () => {
    const { requestCode, login, business, sessionRepository } = setupAdminAccess();
    const code = (await requestCode())!;
    const input = { email: business.boss.email, code, ip: IP, remember: false };
    const results = await Promise.allSettled([login.verifyCode(input), login.verifyCode(input)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(sessionRepository.items.size, 1, 'one code, one session');
  });

  it('refuses a correct code if the person has no active business when it is used (replaced or paused in between)', async () => {
    const { requestCode, login, directory, business } = setupAdminAccess();
    const code = (await requestCode())!;
    directory.set({ ...business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    await assert.rejects(login.verifyCode({ email: business.boss.email, code, ip: IP, remember: false }), InvalidAccessCodeError);
  });

  it('accepts the invitation code as a sign-in code', async () => {
    const { codes, login, business } = setupAdminAccess();
    const { code } = await codes.issue({ email: business.boss.email, purpose: 'invitation', businessId: business.id, assignmentId: 'assignment-1' });
    await login.verifyCode({ email: business.boss.email, code, ip: IP, remember: false });
  });

  it('rejects a reverify code as a sign-in code', async () => {
    const { codes, login, business } = setupAdminAccess();
    const { code } = await codes.issue({ email: business.boss.email, purpose: 'reverify' });
    await assert.rejects(login.verifyCode({ email: business.boss.email, code, ip: IP, remember: false }), InvalidAccessCodeError);
  });

  it('knowing the email is never enough: without a code there is no session', async () => {
    const { login, sessionRepository, business } = setupAdminAccess();
    await login.requestCode({ email: business.boss.email, ip: IP });
    await assert.rejects(login.verifyCode({ email: business.boss.email, code: '123456', ip: IP, remember: true }), InvalidAccessCodeError);
    assert.equal(sessionRepository.items.size, 0);
  });

  it('ends the previous session of this browser when a new one starts', async () => {
    const { signIn, sessions, clock, business } = setupAdminAccess();
    const first = await signIn();
    clock.advance(61_000);
    const second = await signIn({ previousCookie: first.started.cookieValue });
    assert.equal(await sessions.resolveCookie(first.started.cookieValue), null);
    assert.ok(await sessions.resolveCookie(second.started.cookieValue));
    assert.equal(business.boss.email, second.grant.email);
  });
});

describe('a temporary code handed over by the owner', () => {
  async function ownerIssues(setup: ReturnType<typeof setupAdminAccess>) {
    const invitations = new InvitationService(
      setup.directory,
      setup.codes,
      setup.challenges,
      setup.mailer,
      new InMemoryRateLimiter(),
      setup.policy,
      setup.clock,
    );
    return invitations.issueTemporaryCode(setup.business.ownerId, setup.business.id);
  }

  it('signs the boss in like any other code', async () => {
    const setup = setupAdminAccess();
    const { code } = await ownerIssues(setup);
    const { grant } = await setup.login.verifyCode({ email: setup.business.boss.email, code, ip: IP, remember: false });
    assert.equal(grant.businesses.length, 1);
  });

  it('is not replaced when the boss asks for a code on the access page: the one the owner handed over keeps working', async () => {
    const setup = setupAdminAccess();
    const { code } = await ownerIssues(setup);
    setup.clock.advance(120_000);
    await setup.login.requestCode({ email: setup.business.boss.email, ip: IP });
    await setup.mailer.drain();
    assert.equal(setup.transport.sent.length, 0, 'no email: a manual code is waiting');
    await setup.login.verifyCode({ email: setup.business.boss.email, code, ip: IP, remember: false });
  });

  it('lets the boss ask for a normal code again once the manual one was used or expired', async () => {
    const setup = setupAdminAccess();
    const { code } = await ownerIssues(setup);
    await setup.login.verifyCode({ email: setup.business.boss.email, code, ip: IP, remember: false });
    setup.clock.advance(120_000);
    assert.match((await setup.requestCode())!, /^\d{6}$/);
  });
});

describe('the token service stays usable for superadmins', () => {
  it('still issues a plain superadmin token', async () => {
    const { tokens } = setupAdminAccess();
    assert.ok(tokens instanceof TokenService);
    const token = await tokens.issue({ userId: 'u1', role: 'superadmin' });
    assert.deepEqual(await tokens.verify(token), { userId: 'u1', role: 'superadmin' });
  });
});
