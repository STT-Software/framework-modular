import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedRequest, AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { TokenService } from '../../../platform/security/token.service';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import { BusinessBossGuard } from '../api/business-boss.guard';
import { InvalidAccessCodeError, TooManyRequestsError } from '../domain/errors';
import { aBusiness, FakeBusinessDirectory, InMemoryChallengeRepository, InMemoryRateLimiter, RecordingMailTransport, testPolicy } from '../fakes.spec';
import { AccessCodeService } from './access-code.service';
import { AccessMailer } from './access-mailer';
import { BossSessionService } from './boss-session.service';

const IP = '203.0.113.9';

function setup(policyOverrides = {}) {
  const directory = new FakeBusinessDirectory();
  const business = aBusiness();
  directory.set(business);
  const challenges = new InMemoryChallengeRepository();
  const clock = new FixedClock();
  const policy = testPolicy(policyOverrides);
  const transport = new RecordingMailTransport();
  const codes = new AccessCodeService(challenges, new InMemoryRateLimiter(), policy, clock);
  const mailer = new AccessMailer(transport, challenges, policy, clock);
  const tokens = new TokenService(new JwtService({ secret: 'k'.repeat(32), signOptions: { expiresIn: '1h' } }));
  const sessions = new BossSessionService(directory, codes, challenges, mailer, tokens, policy, clock);
  return { directory, business, challenges, clock, transport, mailer, tokens, sessions };
}

describe('asking for a login code', () => {
  it('emails a code to the current boss of an active business', async () => {
    const { sessions, mailer, transport, business } = setup();
    await sessions.requestLoginCode({ businessId: business.id, email: 'ana@cafecentral.co', ip: IP });
    await mailer.drain();
    assert.equal(transport.sent.length, 1);
    assert.equal(transport.sent[0].to, 'ana@cafecentral.co');
  });

  it('answers the same and sends nothing for an unassigned email, a paused or an unknown business', async () => {
    const { sessions, mailer, transport, business, directory } = setup();
    await sessions.requestLoginCode({ businessId: business.id, email: 'other@x.co', ip: IP });
    await sessions.requestLoginCode({ businessId: 'f'.repeat(24), email: 'ana@cafecentral.co', ip: IP });
    directory.set({ ...business, status: 'paused' });
    await sessions.requestLoginCode({ businessId: business.id, email: 'ana@cafecentral.co', ip: IP });
    await mailer.drain();
    assert.equal(transport.sent.length, 0);
  });

  it('does not send a second code within the cooldown, and does again after it', async () => {
    const { sessions, mailer, transport, business, clock } = setup();
    const ask = () => sessions.requestLoginCode({ businessId: business.id, email: 'ana@cafecentral.co', ip: IP });
    await ask();
    await ask();
    await mailer.drain();
    assert.equal(transport.sent.length, 1);
    clock.advance(61_000);
    await ask();
    await mailer.drain();
    assert.equal(transport.sent.length, 2);
  });

  it('refuses with a rate limit once the hourly cap is exceeded', async () => {
    const { sessions, business } = setup({ contextSendLimit: 2 });
    const ask = () => sessions.requestLoginCode({ businessId: business.id, email: 'ana@cafecentral.co', ip: IP });
    await ask();
    await ask();
    await assert.rejects(ask(), TooManyRequestsError);
  });
});

describe('signing in with a code', () => {
  async function codeFor(ctx: ReturnType<typeof setup>, email = 'ana@cafecentral.co') {
    await ctx.sessions.requestLoginCode({ businessId: ctx.business.id, email, ip: IP });
    await ctx.mailer.drain();
    return ctx.transport.lastCode();
  }

  it('opens a session whose token carries the boss, the business and the assignment', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const session = await ctx.sessions.verify({ businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP });
    assert.deepEqual(await ctx.tokens.verify(session.accessToken), {
      userId: 'ana@cafecentral.co',
      role: 'business-boss',
      businessId: ctx.business.id,
      assignmentId: 'assignment-1',
    });
    assert.equal(session.business.name, 'Café Central');
  });

  it('accepts the email in any letter case', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const session = await ctx.sessions.verify({ businessId: ctx.business.id, email: '  ANA@CafeCentral.co ', code, ip: IP });
    assert.equal(session.boss.email, 'ana@cafecentral.co');
  });

  it('does not accept the same code twice', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const input = { businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP };
    await ctx.sessions.verify(input);
    await assert.rejects(ctx.sessions.verify(input), InvalidAccessCodeError);
  });

  it('gives the same generic error for a wrong code and for an email that is not the boss', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const wrong = code === '000000' ? '111111' : '000000';
    await assert.rejects(ctx.sessions.verify({ businessId: ctx.business.id, email: 'ana@cafecentral.co', code: wrong, ip: IP }), InvalidAccessCodeError);
    await assert.rejects(ctx.sessions.verify({ businessId: ctx.business.id, email: 'other@x.co', code, ip: IP }), InvalidAccessCodeError);
  });

  it('does not accept the code of another business', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const otherId = 'b'.repeat(24);
    ctx.directory.set(aBusiness({ id: otherId, boss: { assignmentId: 'assignment-9', name: 'Ana', email: 'ana@cafecentral.co' } }));
    await assert.rejects(ctx.sessions.verify({ businessId: otherId, email: 'ana@cafecentral.co', code, ip: IP }), InvalidAccessCodeError);
  });

  it('rejects an expired code', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    ctx.clock.advance(10 * 60_000 + 1);
    await assert.rejects(ctx.sessions.verify({ businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP }), InvalidAccessCodeError);
  });

  it('blocks a paused business, and resuming does not revive an expired code', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const input = { businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP };
    ctx.directory.set({ ...ctx.business, status: 'paused' });
    await assert.rejects(ctx.sessions.verify(input), InvalidAccessCodeError);
    ctx.clock.advance(11 * 60_000);
    ctx.directory.set(ctx.business);
    await assert.rejects(ctx.sessions.verify(input), InvalidAccessCodeError);
  });

  it('kills the old boss\'s code when the boss is replaced', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    ctx.directory.set({ ...ctx.business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    await assert.rejects(ctx.sessions.verify({ businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP }), InvalidAccessCodeError);
  });

  it('lets only one of two simultaneous correct verifications win', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const input = { businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP };
    const results = await Promise.allSettled([ctx.sessions.verify(input), ctx.sessions.verify(input)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  });

  it('locks the code after too many wrong tries, even if the right one comes later', async () => {
    const ctx = setup();
    const code = await codeFor(ctx);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await ctx.sessions.verify({ businessId: ctx.business.id, email: 'ana@cafecentral.co', code: wrong, ip: IP }).catch(() => undefined);
    }
    await assert.rejects(ctx.sessions.verify({ businessId: ctx.business.id, email: 'ana@cafecentral.co', code, ip: IP }), InvalidAccessCodeError);
  });
});

describe('BusinessBossGuard', () => {
  function contextFor(user: AuthenticatedUser | undefined): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => ({ user }) as Partial<AuthenticatedRequest> }) } as unknown as ExecutionContext;
  }
  const boss = (businessId: string, assignmentId = 'assignment-1'): AuthenticatedUser => ({ userId: 'ana@cafecentral.co', role: 'business-boss', businessId, assignmentId });

  it('lets the current boss of an active business through', async () => {
    const { directory, business } = setup();
    assert.equal(await new BusinessBossGuard(directory).canActivate(contextFor(boss(business.id))), true);
  });

  it('answers 401 without a user, and 403 for a super admin', async () => {
    const { directory } = setup();
    const guard = new BusinessBossGuard(directory);
    await assert.rejects(guard.canActivate(contextFor(undefined)), UnauthorizedException);
    await assert.rejects(guard.canActivate(contextFor({ userId: 'u', role: 'superadmin' })), ForbiddenException);
  });

  it('answers 401 for a replaced assignment or a business that no longer exists', async () => {
    const { directory, business } = setup();
    const guard = new BusinessBossGuard(directory);
    directory.set({ ...business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    await assert.rejects(guard.canActivate(contextFor(boss(business.id))), UnauthorizedException);
    await assert.rejects(guard.canActivate(contextFor(boss('f'.repeat(24)))), UnauthorizedException);
  });

  it('answers 403 for a paused business', async () => {
    const { directory, business } = setup();
    directory.set({ ...business, status: 'paused' });
    await assert.rejects(new BusinessBossGuard(directory).canActivate(contextFor(boss(business.id))), ForbiddenException);
  });

  it('keeps working for the same email as boss of a different business', async () => {
    const { directory, business } = setup();
    const otherId = 'c'.repeat(24);
    directory.set(aBusiness({ id: otherId, boss: { assignmentId: 'assignment-7', name: 'Ana', email: 'ana@cafecentral.co' } }));
    directory.set({ ...business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    const guard = new BusinessBossGuard(directory);
    assert.equal(await guard.canActivate(contextFor(boss(otherId, 'assignment-7'))), true);
    await assert.rejects(guard.canActivate(contextFor(boss(business.id))), UnauthorizedException);
  });
});
