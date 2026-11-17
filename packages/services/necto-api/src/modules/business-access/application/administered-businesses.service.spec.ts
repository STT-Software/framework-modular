import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessNotAdministeredError, ModuleNotEnabledError } from '../domain/errors';
import { aBusiness, setupAdminAccess } from '../fakes.spec';

const EMAIL = 'ana@cafecentral.co';

describe('which businesses an administrator can enter', () => {
  it('lists only active businesses where the email is the current boss', async () => {
    const { administered, directory, business } = setupAdminAccess();
    directory.set(aBusiness({ id: 'b'.repeat(24), name: 'Segunda', boss: { ...business.boss, assignmentId: 'a2' } }));
    directory.set(aBusiness({ id: 'c'.repeat(24), name: 'Pausada', status: 'paused', boss: { ...business.boss, assignmentId: 'a3' } }));
    directory.set(aBusiness({ id: 'd'.repeat(24), name: 'Ajena', boss: { assignmentId: 'a4', name: 'Luis', email: 'luis@otro.co' } }));
    assert.deepEqual((await administered.list(EMAIL)).map((b) => b.name).sort(), ['Café Central', 'Segunda']);
  });

  it('shows the category and the enabled modules, and nothing about the owner or the boss history', async () => {
    const { administered, directory, business } = setupAdminAccess();
    directory.set({ ...business, category: 'other', categoryOther: 'Floristería', modules: ['reservas', 'pedidos'] });
    const [only] = await administered.list(EMAIL);
    assert.deepEqual(only, { id: business.id, name: 'Café Central', category: 'other', categoryOther: 'Floristería', modules: ['reservas', 'pedidos'] });
    assert.ok(!('ownerId' in only) && !('boss' in only));
  });

  it('answers the same for a business that is unknown, paused, or someone else\'s', async () => {
    const { administered, directory, business } = setupAdminAccess();
    directory.set(aBusiness({ id: 'd'.repeat(24), boss: { assignmentId: 'a4', name: 'Luis', email: 'luis@otro.co' } }));
    directory.set({ ...business, id: 'c'.repeat(24), status: 'paused' });
    const errors = await Promise.all(
      ['f'.repeat(24), 'd'.repeat(24), 'c'.repeat(24)].map((id) => administered.get(EMAIL, id).then(() => null, (e: Error) => e)),
    );
    assert.ok(errors.every((e) => e instanceof BusinessNotAdministeredError));
    assert.equal(new Set(errors.map((e) => e!.message)).size, 1);
  });

  it('enables a functionality only when the business is yours, active and has it', async () => {
    const { administered, directory, business } = setupAdminAccess();
    assert.equal((await administered.requireModule(EMAIL, business.id, 'reservas')).id, business.id);
    await assert.rejects(administered.requireModule(EMAIL, business.id, 'turnos'), ModuleNotEnabledError);
    await assert.rejects(administered.requireModule(EMAIL, business.id, 'not-a-module'), ModuleNotEnabledError);
    directory.set({ ...business, modules: ['turnos'] });
    await assert.rejects(administered.requireModule(EMAIL, business.id, 'reservas'), ModuleNotEnabledError, 'disabling it takes effect at once');
    await administered.requireModule(EMAIL, business.id, 'turnos');
  });

  it('knows the name of the person, or nothing when they administer no business', async () => {
    const { administered } = setupAdminAccess();
    assert.deepEqual(await administered.person(EMAIL), { name: 'Ana Gómez' });
    assert.equal(await administered.person('nadie@x.co'), null);
  });
});
