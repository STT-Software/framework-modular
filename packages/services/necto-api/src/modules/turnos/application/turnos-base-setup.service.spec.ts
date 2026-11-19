import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TurnosBusinessNotFoundError, TurnosNotEnabledError } from '../domain/errors';
import { aBusiness, BOSS, BUSINESS_ID, names, OTHER_BOSS, queueInput, setupTurnos } from '../fakes.spec';

describe('the attention profile chosen in the base setup', () => {
  it('shows the profile the category suggests until one is chosen, and creates nothing by looking', async () => {
    const { baseSetup, repository } = setupTurnos();
    assert.equal(await baseSetup.current(BUSINESS_ID, 'gastronomy'), 'restaurant');
    assert.equal(await baseSetup.current(BUSINESS_ID, 'retail'), 'bank');
    assert.equal(baseSetup.suggestedFor('gastronomy'), 'restaurant');
    assert.equal(repository.items.size, 0);
    assert.deepEqual(await baseSetup.statusOf(BUSINESS_ID), { ready: false, queueCount: 0, operatorCount: 0 });
  });

  it('lists the five profiles with the queues each one suggests', () => {
    const { baseSetup } = setupTurnos();
    assert.deepEqual(baseSetup.options().map((option) => [option.id, option.suggestedQueues.length]), [['clinic', 2], ['restaurant', 2], ['bank', 2], ['salon', 3], ['custom', 1]]);
  });

  it('stores the choice before Turnos was ever opened, and the first opening generates the queues of THAT profile', async () => {
    const { baseSetup, service } = setupTurnos();
    assert.equal(await baseSetup.choose(BOSS, BUSINESS_ID, 'clinic'), 'clinic');
    assert.equal(await baseSetup.current(BUSINESS_ID, 'gastronomy'), 'clinic');
    const state = await service.get(BUSINESS_ID);
    assert.deepEqual(names(state), ['Consulta general', 'Laboratorio'], 'not the restaurant ones the category would suggest');
    assert.equal(state.configuration.profile, 'clinic');
  });

  it('is the same field the first step of Turnos edits, in both directions', async () => {
    const { baseSetup, service } = setupTurnos();
    await service.get(BUSINESS_ID);
    await service.changeProfile(BUSINESS_ID, 'bank', false);
    assert.equal(await baseSetup.current(BUSINESS_ID, 'gastronomy'), 'bank');
    await baseSetup.choose(BOSS, BUSINESS_ID, 'salon');
    assert.equal((await service.get(BUSINESS_ID)).configuration.profile, 'salon');
  });

  it('choosing another profile keeps what was configured and duplicates nothing', async () => {
    const { baseSetup, service } = setupTurnos();
    await service.get(BUSINESS_ID);
    const created = await service.createQueue(BUSINESS_ID, queueInput('Mi fila propia'));
    await service.createOperator(BUSINESS_ID, { name: 'Laura', email: 'laura@x.co', queueIds: [created.created!.id] });
    const before = (await service.get(BUSINESS_ID)).configuration;
    await baseSetup.choose(BOSS, BUSINESS_ID, 'salon');
    const after = (await service.get(BUSINESS_ID)).configuration;
    assert.deepEqual(after.queues, before.queues, 'queues are exactly as they were: the suggestions of the new profile are not added from here');
    assert.deepEqual(after.operators, before.operators);
    assert.deepEqual(after.rules, before.rules);
    assert.equal(after.profile, 'salon');
  });

  it('replaces suggestions nobody touched, like changing the profile inside Turnos does', async () => {
    const { baseSetup, service } = setupTurnos();
    await service.get(BUSINESS_ID);
    await baseSetup.choose(BOSS, BUSINESS_ID, 'bank');
    assert.deepEqual(names(await service.get(BUSINESS_ID)), ['Caja', 'Asesoría']);
  });

  it('clears "ready" when the profile changes the queues, and reports the status of the module', async () => {
    const { baseSetup, service } = setupTurnos();
    await service.complete(BUSINESS_ID);
    assert.deepEqual(await baseSetup.statusOf(BUSINESS_ID), { ready: true, queueCount: 2, operatorCount: 0 });
    await baseSetup.choose(BOSS, BUSINESS_ID, 'salon');
    assert.deepEqual(await baseSetup.statusOf(BUSINESS_ID), { ready: false, queueCount: 3, operatorCount: 0 });
  });

  it('only the current boss of an active business with Turnos may choose, and a refused attempt writes nothing', async () => {
    const { baseSetup, directory, repository } = setupTurnos();
    await assert.rejects(baseSetup.choose(OTHER_BOSS, BUSINESS_ID, 'bank'), TurnosBusinessNotFoundError, 'the boss of another business');
    await assert.rejects(baseSetup.choose('nobody@x.co', BUSINESS_ID, 'bank'), TurnosBusinessNotFoundError);
    await assert.rejects(baseSetup.choose(BOSS, 'f'.repeat(24), 'bank'), TurnosBusinessNotFoundError);
    directory.set(aBusiness({ status: 'paused' }));
    await assert.rejects(baseSetup.choose(BOSS, BUSINESS_ID, 'bank'), TurnosBusinessNotFoundError);
    directory.set(aBusiness({ modules: ['reservas'] }));
    await assert.rejects(baseSetup.choose(BOSS, BUSINESS_ID, 'bank'), TurnosNotEnabledError);
    directory.set(aBusiness({ boss: { assignmentId: 'a-9', name: 'Nuevo', email: 'nuevo@cafecentral.co' } }));
    await assert.rejects(baseSetup.choose(BOSS, BUSINESS_ID, 'bank'), TurnosBusinessNotFoundError, 'the boss was replaced');
    assert.equal(repository.items.size, 0);
  });
});
