import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemberSignedIn } from '../../business-access/public';
import { EventBus } from '../../../platform/events/event-bus';
import {
  OperatorNotFoundError,
  OperatorNotOperableError,
  TurnosBusinessNotFoundError,
  TurnosInvalidError,
  TurnosNotEnabledError,
  ViewNotAllowedError,
} from '../domain/errors';
import { BOSS, BUSINESS_ID, LAURA, MATEO, OTHER_BUSINESS_ID, SOFIA, operationWorld, operatorInput, setupTurnos } from '../fakes.spec';
import { TurnosOperatorActivation } from './turnos-operator-activation';

const recordOf = async (world: Awaited<ReturnType<typeof operationWorld>>, email: string) => (await world.service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === email)!;
const change = async (world: Awaited<ReturnType<typeof operationWorld>>, email: string, extra: Record<string, unknown>) => {
  const record = await recordOf(world, email);
  return world.service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, email, (extra.queueIds as string[]) ?? record.queueIds, { views: record.views, status: record.status, ...extra }));
};

describe('who is an operator right now', () => {
  it('finds the assignment by the email of the session and gives only their queues and views', async () => {
    const world = await operationWorld();
    const laura = await world.operator(LAURA);
    assert.deepEqual([laura.role, laura.queueIds, laura.operator?.name, laura.views.length], ['operator', [world.caja.id, world.recogida.id], 'Laura Gómez', 5]);
    const mateo = await world.operator(MATEO);
    assert.deepEqual([mateo.queueIds, mateo.views], [[world.recogida.id], ['home', 'my-turns', 'create-turn']]);
  });
  it('the administrator gets every queue and every view, and nothing is created by looking at a business that never opened Turnos', async () => {
    const { access, repository } = setupTurnos();
    const admin = await access.forAdmin(BOSS, BUSINESS_ID);
    assert.deepEqual([admin.role, admin.queueIds, admin.views.length, admin.configuration.queues], ['admin', null, 5, []]);
    assert.equal(repository.items.size, 0);
  });
  it('is not an operator: someone else, the boss, or an operator of another business', async () => {
    const world = await operationWorld();
    await assert.rejects(world.access.forOperator('nobody@x.co', BUSINESS_ID), OperatorNotFoundError);
    await assert.rejects(world.access.forOperator(BOSS, BUSINESS_ID), OperatorNotFoundError, 'being the boss does not make you an operator');
    await assert.rejects(world.access.forOperator(LAURA, OTHER_BUSINESS_ID), OperatorNotFoundError, 'in the other business she is nobody');
    await assert.rejects(world.access.forOperator(LAURA, 'f'.repeat(24)), TurnosBusinessNotFoundError, 'and a business that does not exist answers like a closed one');
  });
  it('a pending, switched-off or view-less operator cannot operate, and a paused business or a disabled module closes everything', async () => {
    const world = await operationWorld();
    await change(world, MATEO, { status: 'inactive' });
    await assert.rejects(world.operator(MATEO), OperatorNotOperableError);
    await change(world, MATEO, { status: 'active', views: [] });
    await assert.rejects(world.operator(MATEO), OperatorNotOperableError);
    await world.service.createOperator(BUSINESS_ID, operatorInput('Nuevo', 'nuevo@x.co', [world.caja.id], { status: undefined }));
    await assert.rejects(world.operator('nuevo@x.co'), OperatorNotOperableError);
    world.directory.set({ ...world.directory.businesses.get(BUSINESS_ID)!, status: 'paused' });
    await assert.rejects(world.operator(LAURA), TurnosBusinessNotFoundError);
    world.directory.set({ ...world.directory.businesses.get(BUSINESS_ID)!, status: 'active', modules: ['reservas'] });
    await assert.rejects(world.operator(LAURA), TurnosNotEnabledError);
    await assert.rejects(world.admin(), TurnosNotEnabledError);
  });
  it('asks for a view: one of the list is enough, and a view not granted is refused', async () => {
    const world = await operationWorld();
    assert.ok(await world.operator(SOFIA, 'surveys'));
    assert.ok(await world.operator(SOFIA, ['my-turns', 'surveys']));
    await assert.rejects(world.operator(SOFIA, 'my-turns'), ViewNotAllowedError);
    await assert.rejects(world.operator(MATEO, 'surveys'), ViewNotAllowedError);
  });
  it('sees the change of permissions on the very next call', async () => {
    const world = await operationWorld();
    assert.ok(await world.operator(MATEO, 'create-turn'));
    await change(world, MATEO, { views: ['home'] });
    await assert.rejects(world.operator(MATEO, 'create-turn'), ViewNotAllowedError);
    await change(world, MATEO, { queueIds: [world.caja.id] });
    assert.deepEqual((await world.operator(MATEO)).queueIds, [world.caja.id]);
  });
});

describe('what the administrator can give an operator', () => {
  it('keeps the views in the order of the workspace whatever order they were sent, and refuses unknown ones', async () => {
    const world = await operationWorld();
    assert.deepEqual((await change(world, MATEO, { views: ['surveys', 'home', 'queues'] })).configuration.operators.find((item) => item.email === MATEO)!.views, ['home', 'queues', 'surveys']);
    await assert.rejects(change(world, MATEO, { views: ['home', 'billing'] }), (error: unknown) => error instanceof TurnosInvalidError && Boolean(error.fields.views));
  });
  it('a new operator has every view and waits as pending; leaving out views or status when editing keeps them', async () => {
    const world = await operationWorld();
    const created = await world.service.createOperator(BUSINESS_ID, operatorInput('Nuevo', 'nuevo@x.co', [world.caja.id], { status: undefined }));
    const record = created.configuration.operators.find((item) => item.email === 'nuevo@x.co')!;
    assert.deepEqual([record.status, record.views.length, record.activatedAt], ['pending', 5, null]);
    const edited = await world.service.updateOperator(BUSINESS_ID, record.id, { name: 'Nuevo Nombre', email: 'nuevo@x.co', queueIds: [world.caja.id] });
    const after = edited.configuration.operators.find((item) => item.id === record.id)!;
    assert.deepEqual([after.status, after.views.length], ['pending', 5]);
  });
  it('the statuses are pending, active and inactive; an operator who already signed in cannot go back to pending', async () => {
    const world = await operationWorld();
    await assert.rejects(change(world, MATEO, { status: 'pending' }), (error: unknown) => error instanceof TurnosInvalidError && Boolean(error.fields.status));
    await assert.rejects(change(world, MATEO, { status: 'banned' }), (error: unknown) => error instanceof TurnosInvalidError && Boolean(error.fields.status));
    const active = (await change(world, MATEO, { status: 'inactive' })).configuration.operators.find((item) => item.email === MATEO)!;
    assert.equal(active.status, 'inactive');
    assert.ok(active.activatedAt, 'the date of the first activation is kept');
  });
  it('changing what an operator may do counts as an edit of the configuration, so it has to be saved as ready again', async () => {
    const world = await operationWorld();
    await world.service.complete(BUSINESS_ID);
    assert.ok((await world.service.get(BUSINESS_ID)).configuration.readyAt);
    await change(world, MATEO, { views: ['home'] });
    assert.equal((await world.service.get(BUSINESS_ID)).configuration.readyAt, null);
  });
});

describe('the first sign-in activates pending operators', () => {
  function activation(world: Awaited<ReturnType<typeof operationWorld>>) {
    const events = new EventBus();
    new TurnosOperatorActivation(events, world.repository, world.store, world.hub, world.clock).onModuleInit();
    return events;
  }
  it('makes them active in every business where the email waits, and leaves the others as they are', async () => {
    const world = await operationWorld();
    const events = activation(world);
    await world.service.createOperator(BUSINESS_ID, operatorInput('Nueva', 'nueva@x.co', [world.caja.id], { status: undefined }));
    await change(world, SOFIA, { status: 'inactive' });
    const seen: string[] = [];
    world.hub.subscribe(BUSINESS_ID, (event) => seen.push(event.type));
    await events.publish(new MemberSignedIn('nueva@x.co'));
    await events.publish(new MemberSignedIn(SOFIA));
    assert.equal((await recordOf(world, 'nueva@x.co')).status, 'active');
    assert.equal((await recordOf(world, SOFIA)).status, 'inactive', 'switched off: signing in does not turn it back on');
    assert.deepEqual(seen, ['access.changed'], 'the open session of that operator is told, nobody else is bothered');
    await events.publish(new MemberSignedIn('nueva@x.co'));
    assert.deepEqual(seen, ['access.changed'], 'nothing to activate the second time');
  });
  it('does not mark the configuration as edited', async () => {
    const world = await operationWorld();
    const events = activation(world);
    await world.service.createOperator(BUSINESS_ID, operatorInput('Nueva', 'nueva@x.co', [world.caja.id], { status: undefined }));
    await world.service.complete(BUSINESS_ID);
    await events.publish(new MemberSignedIn('nueva@x.co'));
    assert.ok((await world.service.get(BUSINESS_ID)).configuration.readyAt);
  });
});

describe('what business-access learns about operators', () => {
  it('lists active and pending operators with their views, and not the switched-off or the view-less', async () => {
    const world = await operationWorld();
    await world.service.createOperator(BUSINESS_ID, operatorInput('Pendiente', 'pend@x.co', [world.caja.id], { status: undefined, views: ['surveys', 'home'] }));
    await world.service.createOperator(BUSINESS_ID, operatorInput('Apagado', 'off@x.co', [world.caja.id], { status: 'inactive' }));
    await world.service.createOperator(BUSINESS_ID, operatorInput('Sin vistas', 'none@x.co', [world.caja.id], { views: [] }));
    assert.deepEqual(await world.source.assignmentsOf('pend@x.co'), [
      { businessId: BUSINESS_ID, moduleId: 'turnos', role: 'operator', personName: 'Pendiente', views: ['home', 'surveys'], operable: false },
    ]);
    assert.deepEqual(await world.source.assignmentsOf('off@x.co'), []);
    assert.deepEqual(await world.source.assignmentsOf('none@x.co'), []);
    assert.deepEqual((await world.source.assignmentsOf(LAURA)).map((item) => [item.operable, item.views?.length]), [[true, 5]]);
  });
});
