import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { MailTransport, type MailAcceptance, type MailMessage } from '../../../platform/mail/mail-transport';
import { TokenService } from '../../../platform/security/token.service';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import {
  DuplicateSuperAdminError,
  InvalidCredentialsError,
  InvalidRegistrationCodeError,
  RegistrationCodeExpiredError,
  RegistrationResendTooSoonError,
  SuperAdminNotFoundError,
  TooManyRegistrationAttemptsError,
  TooManyRegistrationCodesError,
  type DuplicateField,
} from '../domain/errors';
import type { PendingRegistration } from '../domain/pending-registration';
import { PendingRegistrationRepository } from '../domain/pending-registration.repository';
import type { RegistrationPolicy } from '../domain/registration-policy';
import type { NewSuperAdmin, SuperAdmin } from '../domain/super-admin';
import { SuperAdminRepository } from '../domain/super-admin.repository';
import { AuthService } from './auth.service';
import { RegistrationMailer } from './registration-mailer';

/** In-memory repository that keeps the same uniqueness rules as the MongoDB one. */
class InMemorySuperAdminRepository extends SuperAdminRepository {
  readonly items: SuperAdmin[] = [];

  async create(data: NewSuperAdmin): Promise<SuperAdmin> {
    const taken = await this.findTakenField(data);
    if (taken) throw new DuplicateSuperAdminError(taken);
    const created = { ...data, id: `id-${this.items.length + 1}` };
    this.items.push(created);
    return created;
  }

  async findById(id: string) {
    return this.items.find((a) => a.id === id) ?? null;
  }

  async findByIdentifier(identifier: string) {
    const key = identifier.includes('@') ? 'email' : 'username';
    return this.items.find((a) => a[key] === identifier) ?? null;
  }

  async findTakenField(data: Pick<NewSuperAdmin, 'username' | 'email' | 'identityDocumentType' | 'identityDocument'>) {
    let field: DuplicateField | null = null;
    if (this.items.some((a) => a.username === data.username)) field = 'username';
    else if (this.items.some((a) => a.email === data.email)) field = 'email';
    else if (
      this.items.some(
        (a) => a.identityDocumentType === data.identityDocumentType && a.identityDocument === data.identityDocument,
      )
    ) {
      field = 'identity document';
    }
    return field;
  }
}

class InMemoryPendingRepository extends PendingRegistrationRepository {
  readonly items = new Map<string, PendingRegistration>();
  private next = 0;

  newId(): string {
    this.next += 1;
    return this.next.toString(16).padStart(24, '0');
  }

  async replace(pending: PendingRegistration) {
    for (const [id, item] of this.items) {
      if (item.email === pending.email || item.username === pending.username) this.items.delete(id);
    }
    this.items.set(pending.id, { ...pending });
  }

  async findById(id: string) {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  async findByEmail(email: string) {
    const item = [...this.items.values()].find((candidate) => candidate.email === email);
    return item ? { ...item } : null;
  }

  async reserveAttempt(id: string, maxAttempts: number) {
    const item = this.items.get(id);
    if (!item || item.attempts >= maxAttempts) return null;
    item.attempts += 1;
    return item.attempts;
  }

  async renewCode(
    id: string,
    change: Pick<PendingRegistration, 'codeHmac' | 'expiresAt' | 'resendAvailableAt' | 'purgeAt'>,
  ) {
    const item = this.items.get(id);
    if (item) Object.assign(item, change, { attempts: 0, sends: item.sends + 1 });
  }

  async delete(id: string) {
    this.items.delete(id);
  }
}

class RecordingTransport extends MailTransport {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<MailAcceptance> {
    this.sent.push(message);
    return { messageId: 'm1' };
  }
}

const SECRET = 'a'.repeat(32);
const policy: RegistrationPolicy = {
  secret: 'o'.repeat(40),
  ttlMs: 10 * 60_000,
  maxAttempts: 5,
  resendCooldownMs: 60_000,
  maxSendsPerWindow: 5,
  sendWindowMs: 30 * 60_000,
  publicAppUrl: 'http://localhost:6020',
};
const registration = {
  username: 'admin.root',
  email: 'admin@company.com',
  password: 'correct-horse',
  identityDocumentType: 'CC' as const,
  identityDocument: '1032556778',
};

function setup() {
  const repository = new InMemorySuperAdminRepository();
  const pending = new InMemoryPendingRepository();
  const transport = new RecordingTransport();
  const mailer = new RegistrationMailer(transport, policy);
  const clock = new FixedClock();
  const tokens = new TokenService(new JwtService({ secret: SECRET, signOptions: { expiresIn: '1h' } }));
  const service = new AuthService(repository, tokens, pending, policy, mailer, clock);

  /** The code of the last email sent. */
  async function lastCode(): Promise<string> {
    await mailer.drain();
    const text = transport.sent.at(-1)?.text ?? '';
    return /Tu código: (\d{6})/.exec(text)?.[1] ?? '';
  }

  /** Registers and confirms an account, returning the session. */
  async function createAccount(data = registration) {
    const { registrationId } = await service.register(data);
    return service.verifyRegistration({ registrationId, code: await lastCode() });
  }

  return { repository, pending, transport, mailer, clock, tokens, service, lastCode, createAccount };
}

function wrong(code: string): string {
  return code === '000000' ? '111111' : '000000';
}

describe('AuthService registration', () => {
  it('does not create the account: keeps a pending registration and emails a code', async () => {
    const { repository, pending, transport, service, lastCode, clock } = setup();
    const result = await service.register(registration);

    assert.equal(repository.items.length, 0);
    assert.deepEqual(Object.keys(result).sort(), ['email', 'expiresAt', 'registrationId', 'resendAvailableAt']);
    assert.equal(result.email, registration.email);
    assert.equal(result.expiresAt.getTime(), clock.now().getTime() + policy.ttlMs);
    assert.equal(result.resendAvailableAt.getTime(), clock.now().getTime() + policy.resendCooldownMs);

    const code = await lastCode();
    assert.match(code, /^\d{6}$/);
    assert.equal(transport.sent[0].to, registration.email);
    assert.equal(transport.sent[0].subject, 'Tu código para crear tu cuenta en Necto');

    const stored = pending.items.get(result.registrationId)!;
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
    assert.match(stored.codeHmac, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(stored).includes(code), 'the code is never stored in plain text');
    assert.ok(!JSON.stringify(stored).includes(registration.password));
    assert.equal(stored.attempts, 0);
  });

  it('a new registration with the same email or username replaces the pending one', async () => {
    const { pending, service } = setup();
    await service.register(registration);
    await service.register({ ...registration, email: 'other@company.com' });
    assert.equal(pending.items.size, 1);
    await service.register({ ...registration, username: 'someone.else', email: 'other@company.com' });
    assert.equal(pending.items.size, 1);
  });

  it('a valid code creates the account, deletes the pending one and signs in like login', async () => {
    const { repository, pending, tokens, createAccount } = setup();
    const session = await createAccount();

    assert.equal(repository.items.length, 1);
    assert.equal(pending.items.size, 0);
    const stored = repository.items[0];
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
    assert.ok(stored.termsAcceptedAt instanceof Date);
    assert.deepEqual(session.superAdmin, { id: stored.id, username: 'admin.root', email: 'admin@company.com' });
    assert.deepEqual(await tokens.verify(session.accessToken), { userId: stored.id, role: 'superadmin' });
  });

  it('a wrong code counts a try and the account is not created', async () => {
    const { repository, pending, service, lastCode } = setup();
    const { registrationId } = await service.register(registration);
    const code = await lastCode();

    await assert.rejects(service.verifyRegistration({ registrationId, code: wrong(code) }), InvalidRegistrationCodeError);
    assert.equal(pending.items.get(registrationId)!.attempts, 1);
    assert.equal(repository.items.length, 0);
    await service.verifyRegistration({ registrationId, code });
    assert.equal(repository.items.length, 1);
  });

  it('locks the code after the maximum number of wrong tries, even for the right code', async () => {
    const { service, lastCode } = setup();
    const { registrationId } = await service.register(registration);
    const code = await lastCode();

    for (let i = 1; i < policy.maxAttempts; i++) {
      await assert.rejects(service.verifyRegistration({ registrationId, code: wrong(code) }), InvalidRegistrationCodeError);
    }
    await assert.rejects(service.verifyRegistration({ registrationId, code: wrong(code) }), TooManyRegistrationAttemptsError);
    await assert.rejects(service.verifyRegistration({ registrationId, code }), TooManyRegistrationAttemptsError);
  });

  it('parallel wrong codes cannot go past the limit of tries', async () => {
    const { pending, service, lastCode } = setup();
    const { registrationId } = await service.register(registration);
    const code = await lastCode();

    const results = await Promise.allSettled(
      Array.from({ length: policy.maxAttempts * 3 }, () => service.verifyRegistration({ registrationId, code: wrong(code) })),
    );
    assert.ok(results.every((r) => r.status === 'rejected'));
    assert.equal(pending.items.get(registrationId)!.attempts, policy.maxAttempts);
    await assert.rejects(service.verifyRegistration({ registrationId, code }), TooManyRegistrationAttemptsError);
  });

  it('limits the codes per email in a window, also across new registrations and after a code expires', async () => {
    const { service, clock, transport, mailer } = setup();
    const first = await service.register(registration);
    clock.advance(policy.resendCooldownMs);
    await service.resendRegistrationCode(first.registrationId);
    clock.advance(policy.ttlMs); // the code expires: the window must survive
    await service.register(registration);
    await service.register({ ...registration, username: 'other.name' });
    const fifth = await service.register(registration);
    await mailer.drain();
    assert.equal(transport.sent.length, policy.maxSendsPerWindow);

    const blocked = await service.register(registration).catch((e) => e);
    assert.ok(blocked instanceof TooManyRegistrationCodesError);
    assert.equal(blocked.code, 'too-many-codes');
    assert.ok(blocked.retryAfterSeconds > 0);
    clock.advance(policy.resendCooldownMs);
    await assert.rejects(service.resendRegistrationCode(fifth.registrationId), TooManyRegistrationCodesError);

    clock.advance(policy.sendWindowMs);
    await service.register(registration);
    await mailer.drain();
    assert.equal(transport.sent.length, policy.maxSendsPerWindow + 1);
  });

  it('an expired code or an unknown registration answers code-expired', async () => {
    const { service, lastCode, clock } = setup();
    const { registrationId } = await service.register(registration);
    const code = await lastCode();
    clock.advance(policy.ttlMs);

    const expired = await service.verifyRegistration({ registrationId, code }).catch((e) => e);
    assert.ok(expired instanceof RegistrationCodeExpiredError);
    assert.equal(expired.code, 'code-expired');
    await assert.rejects(
      service.verifyRegistration({ registrationId: 'f'.repeat(24), code }),
      RegistrationCodeExpiredError,
    );
    await assert.rejects(service.resendRegistrationCode(registrationId), RegistrationCodeExpiredError);
  });

  it('resend waits for the cooldown, then sends a new code, resets the tries and invalidates the old one', async () => {
    const { pending, service, lastCode, clock, transport } = setup();
    const { registrationId } = await service.register(registration);
    const oldCode = await lastCode();

    const tooSoon = await service.resendRegistrationCode(registrationId).catch((e) => e);
    assert.ok(tooSoon instanceof RegistrationResendTooSoonError);
    assert.equal(tooSoon.code, 'resend-too-soon');
    assert.equal(tooSoon.retryAfterSeconds, 60);

    await assert.rejects(service.verifyRegistration({ registrationId, code: wrong(oldCode) }));
    clock.advance(policy.resendCooldownMs);
    const renewed = await service.resendRegistrationCode(registrationId);
    assert.equal(renewed.registrationId, registrationId);
    assert.equal(renewed.expiresAt.getTime(), clock.now().getTime() + policy.ttlMs);
    assert.equal(pending.items.get(registrationId)!.attempts, 0);

    const newCode = await lastCode();
    assert.equal(transport.sent.length, 2);
    if (newCode !== oldCode) {
      await assert.rejects(service.verifyRegistration({ registrationId, code: oldCode }), InvalidRegistrationCodeError);
    }
    await service.verifyRegistration({ registrationId, code: newCode });
  });

  it('rejects a username, email or identity document that already has an account, without sending anything', async () => {
    const { service, transport, mailer, createAccount } = setup();
    await createAccount();
    const sentBefore = transport.sent.length;

    const cases: Array<[Partial<typeof registration>, DuplicateField]> = [
      [{ email: 'other@company.com', identityDocument: '999999' }, 'username'],
      [{ username: 'other.admin', identityDocument: '999999' }, 'email'],
      [{ username: 'other.admin', email: 'other@company.com' }, 'identity document'],
    ];
    for (const [change, field] of cases) {
      await assert.rejects(
        service.register({ ...registration, ...change }),
        (error: DuplicateSuperAdminError) => error instanceof DuplicateSuperAdminError && error.field === field,
      );
    }
    await mailer.drain();
    assert.equal(transport.sent.length, sentBefore);
  });

  it('answers conflict on verify if someone took the email meanwhile, and drops the pending registration', async () => {
    const { repository, service, lastCode, pending } = setup();
    const { registrationId } = await service.register(registration);
    const code = await lastCode();
    // Someone else gets an account with the same email between the two steps.
    await repository.create({
      ...registration,
      username: 'faster',
      identityDocument: '555555',
      passwordHash: 'x',
      termsAcceptedAt: new Date(),
    });

    await assert.rejects(
      service.verifyRegistration({ registrationId, code }),
      (error: DuplicateSuperAdminError) => error instanceof DuplicateSuperAdminError && error.field === 'email',
    );
    assert.equal(pending.items.has(registrationId), false);
  });
});

describe('AuthService login and profile', () => {
  it('logs in by username or by email and issues a super admin token', async () => {
    const { service, tokens, createAccount } = setup();
    const { superAdmin } = await createAccount();

    for (const identifier of ['admin.root', 'admin@company.com']) {
      const result = await service.login({ identifier, password: registration.password });
      assert.equal(result.superAdmin.id, superAdmin.id);
      assert.deepEqual(await tokens.verify(result.accessToken), { userId: superAdmin.id, role: 'superadmin' });
    }
  });

  it('answers the same way for an unknown user and a wrong password', async () => {
    const { service, createAccount } = setup();
    await createAccount();

    const wrongPassword = await service.login({ identifier: 'admin.root', password: 'nope' }).catch((e) => e);
    const unknownUser = await service.login({ identifier: 'ghost', password: 'nope' }).catch((e) => e);

    assert.ok(wrongPassword instanceof InvalidCredentialsError);
    assert.ok(unknownUser instanceof InvalidCredentialsError);
    assert.equal(wrongPassword.message, unknownUser.message);
  });

  it('returns the profile of an existing super admin and fails for an unknown one', async () => {
    const { service, createAccount } = setup();
    const { superAdmin } = await createAccount();
    const { id } = superAdmin;

    assert.deepEqual(await service.getProfile(id), { id, username: 'admin.root', email: 'admin@company.com' });
    await assert.rejects(service.getProfile('missing'), SuperAdminNotFoundError);
  });
});
