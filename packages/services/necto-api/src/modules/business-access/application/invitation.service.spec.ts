import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import { BossAssigned } from '../../businesses/public';
import { InvalidAccessCodeError, InvitationBusinessNotFoundError, InvitationNotAvailableError, InvitationTooSoonError, TooManyRequestsError } from '../domain/errors';
import { aBusiness, FakeBusinessDirectory, InMemoryChallengeRepository, InMemoryRateLimiter, RecordingMailTransport, testPolicy } from '../fakes.spec';
import { AccessCodeService } from './access-code.service';
import { AccessMailer } from './access-mailer';
import { InvitationService } from './invitation.service';

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
  const invitations = new InvitationService(directory, codes, challenges, mailer, new InMemoryRateLimiter(), policy, clock);
  const assigned = (overrides: Partial<{ assignmentId: string; name: string; email: string; replaces: string | null; name2: string }> = {}) =>
    new BossAssigned(
      business.id,
      overrides.name2 ?? business.name,
      business.ownerId,
      overrides.assignmentId ?? business.boss.assignmentId,
      overrides.name ?? business.boss.name,
      overrides.email ?? business.boss.email,
      overrides.replaces ?? null,
    );
  return { directory, business, challenges, clock, policy, transport, codes, mailer, invitations, assigned };
}

describe('the invitation sent when a boss is assigned', () => {
  it('emails the boss a code with the business name and a link that does not contain the code', async () => {
    const { invitations, assigned, mailer, transport, business } = setup();
    await invitations.onBossAssigned(assigned());
    await mailer.drain();

    assert.equal(transport.sent.length, 1);
    const mail = transport.sent[0];
    assert.equal(mail.to, 'ana@cafecentral.co');
    assert.match(mail.subject, /Café Central/);
    assert.match(mail.text, /Tu código: \d{6}/);
    assert.match(mail.text, /10 minutos/);
    assert.match(mail.html, /Café Central/);
    const code = transport.lastCode();
    const link = /http:\/\/localhost:6020\/business\/access\?business=\w+/.exec(mail.text)?.[0] ?? '';
    assert.ok(link.includes(business.id));
    assert.ok(!link.includes(code), 'the code is never in the URL');
    assert.ok(!(mail.html.match(/href="[^"]*"/g) ?? []).some((href) => href.includes(code)));
  });

  it('records the attempt, then the provider\'s acceptance, and never claims delivery', async () => {
    const { invitations, assigned, mailer, business, transport } = setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const send = transport.send.bind(transport);
    transport.send = async (message) => {
      await gate;
      return send(message);
    };
    await invitations.onBossAssigned(assigned());
    const during = await invitations.status(business.ownerId, business.id);
    assert.equal(during.status, 'sending');
    release();
    await mailer.drain();
    const after = await invitations.status(business.ownerId, business.id);
    assert.equal(after.status, 'accepted');
    assert.ok(after.acceptedAt);
    assert.equal(after.deliveryConfirmed, false, 'acceptance by the provider is not delivery');
    assert.ok(!JSON.stringify(after).includes('delivered'));
  });

  it('escapes what people typed: a hostile name is text, and the subject stays on one line', async () => {
    const { invitations, assigned, mailer, transport } = setup();
    await invitations.onBossAssigned(assigned({ name2: 'Café <img src=x onerror=alert(1)>\r\nBcc: evil@x.co', name: '<script>alert(1)</script>' }));
    await mailer.drain();

    const mail = transport.sent[0];
    assert.ok(!mail.html.includes('<img'));
    assert.ok(!mail.html.includes('<script>'));
    assert.match(mail.html, /&lt;img/);
    assert.ok(!/[\r\n]/.test(mail.subject));
  });

  it('records a failed send with its reason, does not throw, and never pretends it was sent', async () => {
    const { invitations, assigned, mailer, transport, business, challenges } = setup();
    transport.failWith = 'not-configured';

    await invitations.onBossAssigned(assigned());
    await mailer.drain();

    const status = await invitations.status(business.ownerId, business.id);
    assert.equal(status.status, 'failed');
    assert.equal(status.failureCode, 'not-configured');
    assert.equal(status.acceptedAt, null);
    assert.equal(transport.sent.length, 0);
    assert.equal(challenges.items.length, 1, 'one invitation recorded, not duplicated');
  });

  it('reports each kind of provider failure', async () => {
    for (const code of ['rejected', 'timeout', 'connection', 'unknown'] as const) {
      const { invitations, assigned, mailer, transport, business } = setup();
      transport.failWith = code;
      await invitations.onBossAssigned(assigned());
      await mailer.drain();
      assert.equal((await invitations.status(business.ownerId, business.id)).failureCode, code);
    }
  });

  it('says there is no invitation when none was ever issued', async () => {
    const { invitations, business } = setup();
    const status = await invitations.status(business.ownerId, business.id);
    assert.equal(status.status, 'none');
    assert.equal(status.deliveryConfirmed, false);
  });
});

describe('sending the invitation again', () => {
  it('recovers from a failed first send with a new code, without anything else being created', async () => {
    const { invitations, assigned, mailer, transport, business, clock, challenges } = setup();
    transport.failWith = 'connection';
    await invitations.onBossAssigned(assigned());
    await mailer.drain();

    transport.failWith = null;
    clock.advance(61_000);
    const status = await invitations.resend(business.ownerId, business.id);
    await mailer.drain();

    assert.ok(['sending', 'accepted'].includes(status.status));
    assert.equal(transport.sent.length, 1);
    assert.equal((await invitations.status(business.ownerId, business.id)).status, 'accepted');
    assert.equal(challenges.byStatus('superseded').length, 1, 'the failed invitation stops being usable');
  });

  it('makes the previous code useless', async () => {
    const { invitations, assigned, mailer, transport, business, clock, codes } = setup();
    await invitations.onBossAssigned(assigned());
    await mailer.drain();
    const first = transport.lastCode();
    clock.advance(61_000);
    await invitations.resend(business.ownerId, business.id);
    await mailer.drain();
    const second = transport.lastCode();

    const verify = (code: string) =>
      codes.verify({ businessId: business.id, assignmentId: business.boss.assignmentId, email: business.boss.email, code, ip: '203.0.113.1' });
    await assert.rejects(verify(first), InvalidAccessCodeError);
    await verify(second);
  });

  it('refuses to resend right away, and tells when it will be possible', async () => {
    const { invitations, assigned, mailer, business, clock } = setup();
    await invitations.onBossAssigned(assigned());
    await mailer.drain();

    await assert.rejects(invitations.resend(business.ownerId, business.id), InvitationTooSoonError);
    const status = await invitations.status(business.ownerId, business.id);
    assert.ok(status.resendAvailableAt);
    clock.advance(61_000);
    assert.equal((await invitations.status(business.ownerId, business.id)).resendAvailableAt, null);
  });

  it('caps the resends per business within the hour', async () => {
    const { invitations, assigned, mailer, business, clock } = setup({ contextSendLimit: 2 });
    await invitations.onBossAssigned(assigned());
    for (let i = 0; i < 2; i++) {
      clock.advance(61_000);
      await invitations.resend(business.ownerId, business.id);
    }
    clock.advance(61_000);
    await assert.rejects(invitations.resend(business.ownerId, business.id), TooManyRequestsError);
    await mailer.drain();
  });

  it('only the owner can see or resend an invitation, and not for a paused business', async () => {
    const { invitations, assigned, directory, business, clock } = setup();
    await invitations.onBossAssigned(assigned());
    clock.advance(61_000);

    await assert.rejects(invitations.status('another-owner', business.id), InvitationBusinessNotFoundError);
    await assert.rejects(invitations.resend('another-owner', business.id), InvitationBusinessNotFoundError);
    await assert.rejects(invitations.status(business.ownerId, 'f'.repeat(24)), InvitationBusinessNotFoundError);

    directory.set({ ...business, status: 'paused' });
    await assert.rejects(invitations.resend(business.ownerId, business.id), InvitationNotAvailableError);
  });
});

describe('replacing the boss', () => {
  it('cancels the old boss\'s pending codes and invites the new boss', async () => {
    const { invitations, assigned, mailer, transport, directory, business, codes, challenges, clock } = setup();
    await invitations.onBossAssigned(assigned());
    await mailer.drain();
    const oldCode = transport.lastCode();
    clock.advance(1_000);

    directory.set({ ...business, boss: { assignmentId: 'assignment-2', name: 'Luis Pérez', email: 'luis@cafecentral.co' } });
    await invitations.onBossAssigned(assigned({ assignmentId: 'assignment-2', name: 'Luis Pérez', email: 'luis@cafecentral.co', replaces: 'assignment-1' }));
    await mailer.drain();

    assert.equal(transport.sent.length, 2);
    assert.equal(transport.sent[1].to, 'luis@cafecentral.co');
    assert.equal(challenges.byStatus('revoked').length, 1);
    await assert.rejects(
      codes.verify({ businessId: business.id, assignmentId: 'assignment-1', email: 'ana@cafecentral.co', code: oldCode, ip: '203.0.113.1' }),
      InvalidAccessCodeError,
    );
    const status = await invitations.status(business.ownerId, business.id);
    assert.equal(status.bossEmail, 'luis@cafecentral.co');
    assert.equal(status.status, 'accepted');
  });

  it('does not show the replaced boss\'s invitation as the current one if the new one was never issued', async () => {
    const { invitations, assigned, mailer, directory, business } = setup();
    await invitations.onBossAssigned(assigned());
    await mailer.drain();
    directory.set({ ...business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });

    assert.equal((await invitations.status(business.ownerId, business.id)).status, 'none');
  });
});
