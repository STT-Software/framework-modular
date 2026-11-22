import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessNotAdministeredError, EmailNotAssignedError, InvalidAccessCodeError, SessionExpiredError } from '../domain/errors';
import { aBusiness, setupAdminAccess } from '../fakes.spec';

const LAURA = 'laura@cafecentral.co';
const turnosOperator = (businessId: string, personName = 'Laura Gómez') => ({ businessId, moduleId: 'turnos', role: 'operator' as const, personName });

/** A business of Ana where Laura works as an operator of Turnos. */
function setup() {
  const access = setupAdminAccess();
  access.directory.set({ ...access.business, modules: ['reservas', 'turnos'] });
  access.memberSource.assign(LAURA, turnosOperator(access.business.id));
  return access;
}

describe('what a person may enter (administrator and operator in one identity)', () => {
  it('lists the administrator access of a boss, with the modules enabled for the business', async () => {
    const { grants, business } = setup();
    const [grant, ...rest] = await grants.list(business.boss.email);
    assert.equal(rest.length, 0);
    assert.deepEqual(
      { key: grant.key, role: grant.role, name: grant.businessName, modules: grant.modules, person: grant.personName },
      { key: `${business.id}:admin`, role: 'admin', name: 'Café Central', modules: ['reservas', 'turnos'], person: 'Ana Gómez' },
    );
  });

  it('lists an operator only for the module they are assigned to, not for the others of the business', async () => {
    const { grants, business } = setup();
    const [grant] = await grants.list(LAURA);
    assert.deepEqual(
      { key: grant.key, role: grant.role, modules: grant.modules, person: grant.personName },
      { key: `${business.id}:operator:turnos`, role: 'operator', modules: ['turnos'], person: 'Laura Gómez' },
    );
  });

  it('gives one email several accesses: boss of one business, operator of another, and both in the same one', async () => {
    const { grants, directory, memberSource, business } = setup();
    const second = aBusiness({ id: 'b'.repeat(24), name: 'Librería Sur', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@libreriasur.co' } });
    directory.set(second);
    memberSource.assign(business.boss.email, turnosOperator(second.id, 'Ana Gómez'));
    memberSource.assign(business.boss.email, turnosOperator(business.id, 'Ana Gómez'));
    const keys = (await grants.list(business.boss.email)).map((grant) => grant.key);
    assert.deepEqual(keys, [`${business.id}:admin`, `${business.id}:operator:turnos`, `${second.id}:operator:turnos`]);
  });

  it('emits one distinct AccessGrant per (businessId, moduleId) when an operator works in both turnos and pedidos in the same business, and deduplicates duplicates', async () => {
    const { grants, directory, memberSource, business } = setup();
    directory.set({ ...business, modules: ['reservas', 'turnos', 'pedidos'] });
    memberSource.assign(LAURA, { businessId: business.id, moduleId: 'pedidos', role: 'operator', personName: 'Laura Pedidos' });
    // Duplicate emission for the same (businessId, moduleId) must be ignored.
    memberSource.assign(LAURA, { businessId: business.id, moduleId: 'pedidos', role: 'operator', personName: 'Duplicate Ignored' });

    const list = await grants.list(LAURA);
    assert.deepEqual(
      list.map((grant) => ({ key: grant.key, role: grant.role, modules: grant.modules, personName: grant.personName })),
      [
        { key: `${business.id}:operator:pedidos`, role: 'operator', modules: ['pedidos'], personName: 'Laura Pedidos' },
        { key: `${business.id}:operator:turnos`, role: 'operator', modules: ['turnos'], personName: 'Laura Gómez' },
      ],
    );
    assert.equal((await grants.requireOperator(LAURA, business.id, 'pedidos')).key, `${business.id}:operator:pedidos`);
    assert.equal((await grants.requireOperator(LAURA, business.id, 'turnos')).key, `${business.id}:operator:turnos`);
  });

  it('does not let an operator assignment turn into an administrator access, or the other way around', async () => {
    const { grants, business } = setup();
    assert.ok((await grants.list(LAURA)).every((grant) => grant.role === 'operator'));
    assert.ok((await grants.list(business.boss.email)).every((grant) => grant.role === 'admin'));
  });

  it('ignores assignments of a paused business, of a business that no longer has the module, and of an unknown business', async () => {
    const { grants, directory, business, memberSource } = setup();
    directory.set({ ...business, modules: ['reservas'] });
    assert.deepEqual(await grants.list(LAURA), [], 'the module was disabled');
    directory.set({ ...business, modules: ['turnos'], status: 'paused' });
    assert.deepEqual(await grants.list(LAURA), [], 'the business is paused');
    directory.set({ ...business, modules: ['turnos'] });
    assert.equal((await grants.list(LAURA)).length, 1, 'resuming gives it back');
    memberSource.assign('ghost@x.co', turnosOperator('f'.repeat(24)));
    assert.deepEqual(await grants.list('ghost@x.co'), []);
  });

  it('stops listing the operator as soon as the module removes the assignment', async () => {
    const { grants, memberSource, business } = setup();
    assert.equal((await grants.list(LAURA)).length, 1);
    memberSource.remove(LAURA, business.id);
    assert.deepEqual(await grants.list(LAURA), []);
  });

  it('greets a person by the name of their first role', async () => {
    const { grants, business } = setup();
    assert.deepEqual(await grants.person(business.boss.email), { name: 'Ana Gómez' });
    assert.deepEqual(await grants.person(LAURA), { name: 'Laura Gómez' });
    assert.equal(await grants.person('nobody@x.co'), null);
  });

  it('requireOperator answers the same not-found for a business that is not theirs, a module they do not have and an administrator', async () => {
    const { grants, business } = setup();
    assert.equal((await grants.requireOperator(LAURA, business.id, 'turnos')).role, 'operator');
    await assert.rejects(grants.requireOperator(LAURA, business.id, 'reservas'), BusinessNotAdministeredError);
    await assert.rejects(grants.requireOperator(LAURA, 'c'.repeat(24), 'turnos'), BusinessNotAdministeredError);
    await assert.rejects(grants.requireOperator(business.boss.email, business.id, 'turnos'), BusinessNotAdministeredError, 'the boss is not an operator');
    await assert.rejects(grants.requireOperator('nobody@x.co', business.id, 'turnos'), BusinessNotAdministeredError);
  });
});

describe('the shared sign-in (same code flow for administrators and operators)', () => {
  it('lets an operator ask for a code, verify it and receive only their operator access', async () => {
    const { signIn, business } = setup();
    const { grant } = await signIn({ email: LAURA });
    assert.deepEqual(grant.accesses.map((access) => [access.businessId, access.role]), [[business.id, 'operator']]);
    assert.deepEqual(grant.businesses, [], 'no administered business');
  });

  it('returns every access of a person with several roles, and keeps `businesses` for the administered ones', async () => {
    const { signIn, memberSource, directory, business } = setup();
    const other = aBusiness({ id: 'b'.repeat(24), name: 'Librería Sur', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@libreriasur.co' } });
    directory.set(other);
    memberSource.assign(business.boss.email, turnosOperator(other.id, 'Ana Gómez'));
    const { grant } = await signIn();
    assert.deepEqual(grant.accesses.map((access) => `${access.businessName}:${access.role}`), ['Café Central:admin', 'Librería Sur:operator']);
    assert.deepEqual(grant.businesses.map((item) => item.id), [business.id]);
  });

  it('answers email-not-assigned to an email with no access and sends it nothing', async () => {
    const { login, transport } = setup();
    await assert.rejects(login.requestCode({ email: 'nobody@x.co', ip: '203.0.113.9' }), EmailNotAssignedError);
    assert.equal(transport.sent.length, 0);
  });

  it('emails the code of an operator greeting them by their own name', async () => {
    const { requestCode, transport } = setup();
    assert.ok(await requestCode(LAURA));
    assert.equal(transport.sent.at(-1)?.to, LAURA);
    assert.match(transport.sent.at(-1)?.text ?? '', /Laura/);
  });

  it('refuses the code of an operator whose assignment was removed after asking for it', async () => {
    const { requestCode, login, memberSource, business } = setup();
    const code = await requestCode(LAURA);
    assert.ok(code);
    memberSource.remove(LAURA, business.id);
    await assert.rejects(login.verifyCode({ email: LAURA, code, ip: '203.0.113.1', remember: false }), InvalidAccessCodeError);
  });

  it('ends the session on refresh when the person has lost every access, and keeps it while one remains', async () => {
    const { signIn, sessions, memberSource, directory, business } = setup();
    memberSource.assign(business.boss.email, turnosOperator(business.id, 'Ana Gómez'));
    const { started } = await signIn();
    directory.set({ ...business, boss: { assignmentId: 'a-9', name: 'Luis', email: 'luis@cafecentral.co' }, modules: ['turnos'] });
    const refreshed = await sessions.refresh(started.cookieValue);
    assert.deepEqual(refreshed.accesses.map((access) => access.role), ['operator'], 'no longer the boss, still an operator');
    memberSource.remove(business.boss.email, business.id);
    await assert.rejects(sessions.refresh(started.cookieValue), SessionExpiredError);
  });

  it('keeps the operator session valid for other businesses when one assignment is removed (the identity is not deleted)', async () => {
    const { signIn, sessions, memberSource, directory, business } = setup();
    const other = aBusiness({ id: 'b'.repeat(24), name: 'Librería Sur', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@libreriasur.co' } });
    directory.set(other);
    memberSource.assign(LAURA, turnosOperator(other.id));
    const { started } = await signIn({ email: LAURA });
    memberSource.remove(LAURA, business.id);
    const refreshed = await sessions.refresh(started.cookieValue);
    assert.deepEqual(refreshed.accesses.map((access) => access.businessId), [other.id]);
  });
});
