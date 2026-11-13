import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../../../platform/security/token.service';
import { DuplicateSuperAdminError, InvalidCredentialsError, SuperAdminNotFoundError } from '../domain/errors';
import type { NewSuperAdmin, SuperAdmin } from '../domain/super-admin';
import { SuperAdminRepository } from '../domain/super-admin.repository';
import { AuthService } from './auth.service';

/** In-memory repository that keeps the same uniqueness rules as the MongoDB one. */
class InMemorySuperAdminRepository extends SuperAdminRepository {
  readonly items: SuperAdmin[] = [];

  async create(data: NewSuperAdmin): Promise<SuperAdmin> {
    if (this.items.some((a) => a.username === data.username)) throw new DuplicateSuperAdminError('username');
    if (this.items.some((a) => a.email === data.email)) throw new DuplicateSuperAdminError('email');
    if (
      this.items.some(
        (a) => a.identityDocumentType === data.identityDocumentType && a.identityDocument === data.identityDocument,
      )
    ) {
      throw new DuplicateSuperAdminError('identity document');
    }
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
}

const SECRET = 'a'.repeat(32);
const registration = {
  username: 'admin.root',
  email: 'admin@company.com',
  password: 'correct-horse',
  identityDocumentType: 'CC' as const,
  identityDocument: '1032556778',
};

function setup() {
  const repository = new InMemorySuperAdminRepository();
  const tokens = new TokenService(new JwtService({ secret: SECRET, signOptions: { expiresIn: '1h' } }));
  return { repository, tokens, service: new AuthService(repository, tokens) };
}

describe('AuthService', () => {
  it('registers a super admin without exposing or storing the plain password', async () => {
    const { repository, service } = setup();
    const summary = await service.register(registration);

    assert.deepEqual(Object.keys(summary).sort(), ['email', 'id', 'username']);
    const stored = repository.items[0];
    assert.notEqual(stored.passwordHash, registration.password);
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
    assert.ok(stored.termsAcceptedAt instanceof Date);
  });

  it('rejects a duplicate username, email or identity document', async () => {
    const { service } = setup();
    await service.register(registration);

    await assert.rejects(
      service.register({ ...registration, email: 'other@company.com', identityDocument: '999999' }),
      (error: DuplicateSuperAdminError) => error instanceof DuplicateSuperAdminError && error.field === 'username',
    );
    await assert.rejects(
      service.register({ ...registration, username: 'other.admin', identityDocument: '999999' }),
      (error: DuplicateSuperAdminError) => error instanceof DuplicateSuperAdminError && error.field === 'email',
    );
    await assert.rejects(
      service.register({ ...registration, username: 'other.admin', email: 'other@company.com' }),
      (error: DuplicateSuperAdminError) =>
        error instanceof DuplicateSuperAdminError && error.field === 'identity document',
    );
  });

  it('logs in by username or by email and issues a super admin token', async () => {
    const { service, tokens } = setup();
    const { id } = await service.register(registration);

    for (const identifier of ['admin.root', 'admin@company.com']) {
      const result = await service.login({ identifier, password: registration.password });
      assert.equal(result.superAdmin.id, id);
      assert.deepEqual(await tokens.verify(result.accessToken), { userId: id, role: 'superadmin' });
    }
  });

  it('answers the same way for an unknown user and a wrong password', async () => {
    const { service } = setup();
    await service.register(registration);

    const wrongPassword = await service.login({ identifier: 'admin.root', password: 'nope' }).catch((e) => e);
    const unknownUser = await service.login({ identifier: 'ghost', password: 'nope' }).catch((e) => e);

    assert.ok(wrongPassword instanceof InvalidCredentialsError);
    assert.ok(unknownUser instanceof InvalidCredentialsError);
    assert.equal(wrongPassword.message, unknownUser.message);
  });

  it('returns the profile of an existing super admin and fails for an unknown one', async () => {
    const { service } = setup();
    const { id } = await service.register(registration);

    assert.deepEqual(await service.getProfile(id), { id, username: 'admin.root', email: 'admin@company.com' });
    await assert.rejects(service.getProfile('missing'), SuperAdminNotFoundError);
  });
});
