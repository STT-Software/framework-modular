import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConcurrentTurnosChangeError,
  OnlyQueueWithOperatorsError,
  OperatorNotFoundError,
  QueueNotFoundError,
  ReassignmentRequiredError,
  TurnosBusinessNotFoundError,
  TurnosIncompleteError,
  TurnosInvalidError,
  TurnosNotEnabledError,
} from '../domain/errors';
import { aBusiness, BUSINESS_ID, names, operatorInput, OTHER_BUSINESS_ID, queueInput, setupTurnos } from '../fakes.spec';
import { TurnosConfigurationService } from './turnos-configuration.service';

const rules = { prefixMode: 'initial', dailyReset: true, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 };

/** The fixture has two businesses; this gives the second one Turnos too, so both can be configured. */
function twoBusinesses() {
  const setup = setupTurnos();
  setup.directory.set(
    aBusiness({ id: OTHER_BUSINESS_ID, name: 'Clínica Norte', category: 'health-wellness', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } }),
  );
  return setup;
}

describe('opening the configuration', () => {
  it('generates the suggested queues of the profile the category suggests, once, and stores them', async () => {
    const { service, repository } = setupTurnos();
    const first = await service.get(BUSINESS_ID);
    assert.deepEqual(names(first), ['Pedidos en caja', 'Recogida de pedidos'], 'gastronomy suggests the restaurant profile');
    assert.equal(first.suggestedProfile, 'restaurant');
    assert.equal(first.configuration.profile, 'restaurant');
    const again = await service.get(BUSINESS_ID);
    assert.deepEqual(again.configuration.queues.map((queue) => queue.id), first.configuration.queues.map((queue) => queue.id), 'same ids: nothing was generated again');
    assert.equal(repository.items.get(BUSINESS_ID)!.version, 2, 'one write for the seeding, none for reading');
  });

  it('starts a business of another category with the queues of its own profile', async () => {
    const { service } = twoBusinesses();
    const state = await service.get(OTHER_BUSINESS_ID);
    assert.equal(state.suggestedProfile, 'clinic');
    assert.ok(names(state).length > 0, 'every category starts with default queues');
  });

  it('answers not-found for a business that does not exist or is paused, and 403 module-not-enabled when it lacks Turnos', async () => {
    const { service, directory } = setupTurnos();
    await assert.rejects(service.get('f'.repeat(24)), TurnosBusinessNotFoundError);
    directory.set(aBusiness({ status: 'paused' }));
    await assert.rejects(service.get(BUSINESS_ID), TurnosBusinessNotFoundError);
    directory.set(aBusiness({ modules: ['reservas'] }));
    const error = await service.get(BUSINESS_ID).catch((e) => e);
    assert.ok(error instanceof TurnosNotEnabledError);
    assert.equal(error.code, 'module-not-enabled');
  });

  it('creates nothing for a business that cannot be configured', async () => {
    const { service, directory, repository } = setupTurnos();
    directory.set(aBusiness({ modules: ['reservas'] }));
    await service.get(BUSINESS_ID).catch(() => undefined);
    assert.equal(repository.items.size, 0);
  });
});

describe('isolation between businesses', () => {
  it('keeps the queues, rules and operators of each business apart', async () => {
    const { service } = twoBusinesses();
    await service.get(BUSINESS_ID);
    await service.createQueue(BUSINESS_ID, queueInput('Solo de A'));
    await service.saveRules(BUSINESS_ID, { ...rules, urgentMinutes: 30 });
    const b = await service.get(OTHER_BUSINESS_ID);
    assert.ok(!names(b).includes('Solo de A'));
    assert.equal(b.configuration.rules.urgentMinutes, 10);
    assert.equal(b.configuration.businessId, OTHER_BUSINESS_ID);
  });

  it('never accepts a queue of another business for an operator, nor a reassignment to it', async () => {
    const { service } = twoBusinesses();
    const a = await service.get(BUSINESS_ID);
    const b = await service.createQueue(OTHER_BUSINESS_ID, queueInput('De B'));
    const foreignQueue = b.created!.id;
    await assert.rejects(service.createOperator(BUSINESS_ID, operatorInput('Laura', 'laura@x.co', [foreignQueue])), TurnosInvalidError);
    const own = a.configuration.queues[0].id;
    const withOperator = await service.createOperator(BUSINESS_ID, operatorInput('Laura', 'laura@x.co', [own]));
    await assert.rejects(
      service.deleteQueue(BUSINESS_ID, own, [{ operatorId: withOperator.created!.id, queueId: foreignQueue }]),
      TurnosInvalidError,
    );
    assert.equal((await service.get(BUSINESS_ID)).configuration.operators[0].queueIds[0], own, 'nothing changed');
  });

  it('cannot reach a queue or an operator of another business by its id', async () => {
    const { service } = twoBusinesses();
    const b = await service.createQueue(OTHER_BUSINESS_ID, queueInput('De B'));
    const op = await service.createOperator(OTHER_BUSINESS_ID, operatorInput('Mateo', 'mateo@x.co', [b.created!.id]));
    await service.get(BUSINESS_ID);
    await assert.rejects(service.updateQueue(BUSINESS_ID, b.created!.id, queueInput('Robada')), QueueNotFoundError);
    await assert.rejects(service.deleteQueue(BUSINESS_ID, b.created!.id, []), QueueNotFoundError);
    await assert.rejects(service.updateOperator(BUSINESS_ID, op.created!.id, operatorInput('X', 'x@x.co', [b.created!.id])), OperatorNotFoundError);
    await assert.rejects(service.deleteOperator(BUSINESS_ID, op.created!.id), OperatorNotFoundError);
    assert.equal((await service.get(OTHER_BUSINESS_ID)).configuration.operators.length, 1, 'the other business is intact');
  });

  it('allows the same operator email in two businesses (one identity, two assignments), normalized like the sign-in', async () => {
    const { service } = twoBusinesses();
    const a = await service.get(BUSINESS_ID);
    const b = await service.createQueue(OTHER_BUSINESS_ID, queueInput('De B'));
    await service.createOperator(BUSINESS_ID, operatorInput('Laura', 'laura@x.co', [a.configuration.queues[0].id]));
    await service.createOperator(OTHER_BUSINESS_ID, operatorInput('Laura G', ' LAURA@x.co ', [b.created!.id]));
    assert.equal((await service.get(OTHER_BUSINESS_ID)).configuration.operators[0].email, 'laura@x.co');
  });

  it('refuses an operator email that repeats inside the business, whatever its case', async () => {
    const { service } = setupTurnos();
    const state = await service.get(BUSINESS_ID);
    const queue = state.configuration.queues[0].id;
    await service.createOperator(BUSINESS_ID, operatorInput('Laura', 'laura@x.co', [queue]));
    await assert.rejects(service.createOperator(BUSINESS_ID, operatorInput('Otra Laura', 'LAURA@X.CO', [queue])), TurnosInvalidError);
  });
});

describe('persistence: save progress and recover it', () => {
  it('recovers everything from the stored document with a brand new service, as after signing out and back in', async () => {
    const { service, store, directory, repository, ticketService, hub, clock } = setupTurnos();
    await service.changeProfile(BUSINESS_ID, 'bank', false);
    const created = await service.createQueue(BUSINESS_ID, queueInput('Ventanilla', { color: 'green', overrides: { prefix: 'v', busyLimit: 2 } }));
    await service.saveRules(BUSINESS_ID, { ...rules, prefixMode: 'fixed', fixedPrefix: 't' });
    await service.createOperator(BUSINESS_ID, operatorInput('Laura', 'laura@x.co', [created.created!.id], { phone: '+57 300 123 4567' }));
    await service.saveProgress(BUSINESS_ID, 'operators');
    const { configuration: config } = await new TurnosConfigurationService(store, directory, ticketService, hub, clock).get(BUSINESS_ID);
    assert.equal(config.profile, 'bank');
    assert.deepEqual(config.queues.map((queue) => queue.name), ['Caja', 'Asesoría', 'Ventanilla']);
    assert.deepEqual(config.queues[2].overrides, { prefix: 'V', urgentMinutes: null, busyLimit: 2, fullLimit: null });
    assert.deepEqual([config.rules.prefixMode, config.rules.fixedPrefix], ['fixed', 'T']);
    assert.deepEqual([config.operators[0].email, config.operators[0].phone, config.operators[0].queueIds], ['laura@x.co', '+573001234567', [created.created!.id]]);
    assert.equal(config.currentStep, 'operators');
    assert.equal(config.readyAt, null, 'saving progress never marks it as ready');
    assert.equal(repository.items.size, 1);
  });

  it('marks it as ready with one queue and valid rules and without operators, and any later change clears it', async () => {
    const { service } = setupTurnos();
    const ready = await service.complete(BUSINESS_ID);
    assert.ok(ready.configuration.readyAt);
    assert.equal(ready.configuration.operators.length, 0);
    assert.ok((await service.saveProgress(BUSINESS_ID, 'queues')).configuration.readyAt, 'moving between steps keeps it ready');
    const changed = await service.updateQueue(BUSINESS_ID, ready.configuration.queues[0].id, queueInput('Pedidos rápidos'));
    assert.equal(changed.configuration.readyAt, null);
  });

  it('refuses to mark it as ready without a queue, saying so', async () => {
    const { service } = setupTurnos();
    const state = await service.get(BUSINESS_ID);
    for (const queue of state.configuration.queues) await service.deleteQueue(BUSINESS_ID, queue.id, []);
    const error = await service.complete(BUSINESS_ID).catch((e) => e);
    assert.ok(error instanceof TurnosIncompleteError);
    assert.ok(error.fields.queues);
    assert.equal(error.code, 'turnos-incomplete');
  });

  it('keeps the original ready date when saved again', async () => {
    const { service, clock } = setupTurnos();
    const first = await service.complete(BUSINESS_ID);
    clock.advance(3_600_000);
    assert.deepEqual((await service.complete(BUSINESS_ID)).configuration.readyAt, first.configuration.readyAt);
  });
});

describe('changing the profile', () => {
  it('replaces untouched suggestions, and afterwards keeps the person\'s work without duplicating or deleting anything', async () => {
    const { service } = setupTurnos();
    const swapped = await service.changeProfile(BUSINESS_ID, 'salon', false);
    assert.deepEqual(names(swapped), ['Corte', 'Color', 'Uñas']);
    await service.updateQueue(BUSINESS_ID, swapped.configuration.queues[0].id, queueInput('Corte de cabello'));
    const kept = await service.changeProfile(BUSINESS_ID, 'bank', false);
    assert.deepEqual(names(kept), ['Corte de cabello', 'Color', 'Uñas']);
    const added = await service.changeProfile(BUSINESS_ID, 'bank', true);
    assert.deepEqual(names(added), ['Corte de cabello', 'Color', 'Uñas', 'Caja', 'Asesoría']);
    assert.deepEqual(names(await service.changeProfile(BUSINESS_ID, 'bank', true)), names(added), 'asking again duplicates nothing');
  });

  it('rejects an unknown profile and changes nothing', async () => {
    const { service } = setupTurnos();
    const before = await service.get(BUSINESS_ID);
    await assert.rejects(service.changeProfile(BUSINESS_ID, 'spaceship', false), TurnosInvalidError);
    assert.deepEqual(names(await service.get(BUSINESS_ID)), names(before));
  });
});

describe('deleting a queue with operators', () => {
  async function withTeam() {
    const setup = setupTurnos();
    const state = await setup.service.get(BUSINESS_ID);
    const [pedidos, recogida] = state.configuration.queues.map((queue) => queue.id);
    const a = await setup.service.createOperator(BUSINESS_ID, operatorInput('Solo recogida', 'a@x.co', [recogida]));
    const b = await setup.service.createOperator(BUSINESS_ID, operatorInput('Ambas', 'b@x.co', [pedidos, recogida]));
    return { ...setup, pedidos, recogida, solo: a.created!.id, ambas: b.created!.id };
  }

  it('requires choosing the new queue, then deletes and reassigns in one consistent result', async () => {
    const { service, pedidos, recogida, solo, ambas } = await withTeam();
    const error = await service.deleteQueue(BUSINESS_ID, recogida, []).catch((e) => e);
    assert.ok(error instanceof ReassignmentRequiredError);
    assert.deepEqual(Object.keys(error.fields), [`reassignments.${solo}`]);
    assert.equal((await service.get(BUSINESS_ID)).configuration.queues.length, 2, 'nothing was deleted by the failed attempt');
    const done = await service.deleteQueue(BUSINESS_ID, recogida, [{ operatorId: solo, queueId: pedidos }]);
    const { operators, queues } = done.configuration;
    assert.deepEqual(queues.map((queue) => queue.id), [pedidos]);
    assert.deepEqual(operators.find((item) => item.id === solo)!.queueIds, [pedidos]);
    assert.deepEqual(operators.find((item) => item.id === ambas)!.queueIds, [pedidos]);
    assert.ok(operators.every((item) => item.queueIds.length > 0));
  });

  it('refuses to delete the only queue while it has operators, and allows it once nobody depends on it', async () => {
    const { service, pedidos, recogida, solo, ambas } = await withTeam();
    await service.deleteQueue(BUSINESS_ID, recogida, [{ operatorId: solo, queueId: pedidos }]);
    await assert.rejects(service.deleteQueue(BUSINESS_ID, pedidos, []), OnlyQueueWithOperatorsError);
    await service.deleteOperator(BUSINESS_ID, solo);
    await service.deleteOperator(BUSINESS_ID, ambas);
    assert.deepEqual((await service.deleteQueue(BUSINESS_ID, pedidos, [])).configuration.queues, []);
  });
});

describe('concurrent changes', () => {
  it('recalculates the change over what the other write left, instead of overwriting it', async () => {
    const { service, repository } = setupTurnos();
    await service.get(BUSINESS_ID);
    repository.raceTimes = 1;
    const before = repository.replaceCalls;
    const state = await service.createQueue(BUSINESS_ID, queueInput('Nueva'));
    assert.equal(repository.replaceCalls - before, 2, 'the first write lost the race and was retried');
    assert.ok(names(state).includes('Nueva'));
    assert.equal(names(await service.get(BUSINESS_ID)).filter((name) => name === 'Nueva').length, 1, 'created exactly once');
  });

  it('gives up with a conflict (and writes nothing) when the race never ends', async () => {
    const { service, repository } = setupTurnos();
    await service.get(BUSINESS_ID);
    repository.raceTimes = 99;
    await assert.rejects(service.createQueue(BUSINESS_ID, queueInput('Nueva')), ConcurrentTurnosChangeError);
    repository.raceTimes = 0;
    assert.ok(!names(await service.get(BUSINESS_ID)).includes('Nueva'));
  });

  it('two requests that open the configuration at the same time end with one document and one set of suggestions', async () => {
    const { service, repository } = setupTurnos();
    const [a, b] = await Promise.all([service.get(BUSINESS_ID), service.get(BUSINESS_ID)]);
    assert.equal(repository.items.size, 1);
    assert.equal(repository.items.get(BUSINESS_ID)!.queues.length, 2);
    assert.equal(a.configuration.businessId, b.configuration.businessId);
  });
});
