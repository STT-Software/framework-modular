import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessAccessChecks } from '../../business-access/public';
import { SessionExpiredError } from '../../business-access/domain/errors';
import { BOSS, BUSINESS_ID, LAURA, MATEO, OTHER_BUSINESS_ID, SOFIA, operationWorld, operatorInput } from '../fakes.spec';
import { TurnosStreamService, visibleItem, type StreamItem } from './turnos-stream.service';

/** The answers business-access gives while a connection stays open: the test flips them to simulate what happens to the person. */
class FakeChecks extends BusinessAccessChecks {
  session = true;
  administrator = true;
  operator = true;
  async requireSession() {
    if (!this.session) throw new SessionExpiredError();
  }
  async requireAdministrator() {
    if (!this.administrator) throw new Error('not the boss any more');
  }
  async requireOperator() {
    if (!this.operator) throw new Error('not an operator any more');
  }
}
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(world: Awaited<ReturnType<typeof operationWorld>>, who: { role: 'admin' | 'operator'; email: string }, businessId = BUSINESS_ID) {
  const checks = new FakeChecks();
  const stream = new TurnosStreamService(world.hub, world.access, checks);
  stream.revalidateMs = 0;
  stream.heartbeatMs = 1_000_000;
  const items: StreamItem[] = [];
  let completed = false;
  const subscription = stream.open({ ...who, businessId, sessionId: 'session-1' }).subscribe({ next: (item) => items.push(item), complete: () => (completed = true) });
  await tick();
  return { checks, stream, items, subscription, names: () => items.map((item) => item.name), isCompleted: () => completed };
}

describe('the live stream', () => {
  it('starts with what the person may see: their queues, their views, where to start', async () => {
    const world = await operationWorld();
    const mateo = await connect(world, { role: 'operator', email: MATEO });
    assert.deepEqual(mateo.items[0], { name: 'ready', scope: { role: 'operator', queueIds: [world.recogida.id], views: ['home', 'my-turns', 'create-turn'], firstView: 'home' } });
    const admin = await connect(world, { role: 'admin', email: BOSS });
    assert.deepEqual([admin.items[0].scope?.role, admin.items[0].scope?.queueIds], ['admin', null]);
    for (const connection of [mateo, admin]) connection.subscription.unsubscribe();
  });
  it('delivers each event only to those who may see its queue, with the customer only for those who attend', async () => {
    const world = await operationWorld();
    const [laura, mateo, sofia, admin] = await Promise.all([
      connect(world, { role: 'operator', email: LAURA }),
      connect(world, { role: 'operator', email: MATEO }),
      connect(world, { role: 'operator', email: SOFIA }),
      connect(world, { role: 'admin', email: BOSS }),
    ]);
    await world.issue(world.caja.id, { customerName: 'Ana' });
    await world.issue(world.recogida.id, { customerName: 'Rosa' });
    await tick();
    const created = (connection: { items: StreamItem[] }) => connection.items.filter((item) => item.name === 'ticket.created').map((item) => item.event?.ticket?.queueName);
    assert.deepEqual(created(laura), ['Pedidos en caja', 'Recogida de pedidos']);
    assert.deepEqual(created(mateo), ['Recogida de pedidos'], 'Mateo does not work in the automatic queue');
    assert.deepEqual(created(admin), ['Pedidos en caja', 'Recogida de pedidos']);
    assert.deepEqual(created(sofia), [], 'Sofía has the surveys view only: no turns at all');
    assert.ok(laura.items.filter((item) => item.name === 'ticket.created').every((item) => item.withTicket === true));
    for (const connection of [laura, mateo, sofia, admin]) connection.subscription.unsubscribe();
  });
  it('an operator with only the home view hears that something happened in the queue, but gets no customer data', async () => {
    const world = await operationWorld();
    const record = (await world.service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await world.service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, MATEO, record.queueIds, { views: ['home'] }));
    const mateo = await connect(world, { role: 'operator', email: MATEO });
    await world.issue(world.recogida.id, { customerName: 'Rosa' });
    await tick();
    const event = mateo.items.find((item) => item.name === 'ticket.created')!;
    assert.equal(event.withTicket, false);
    mateo.subscription.unsubscribe();
  });
  it('survey answers go to the surveys view of that queue, and the room screen settings only to the administrator', async () => {
    const world = await operationWorld();
    const sofia = await world.operator(SOFIA);
    const mateo = await world.operator(MATEO);
    const admin = await world.admin();
    const answered = { type: 'survey.answered' as const, businessId: BUSINESS_ID, at: new Date(), queueId: world.caja.id };
    assert.ok(visibleItem(sofia, answered));
    assert.equal(visibleItem(mateo, answered), null, 'no surveys view');
    assert.ok(visibleItem(admin, answered));
    const room = { type: 'room-screen.updated' as const, businessId: BUSINESS_ID, at: new Date(), queueId: null };
    assert.deepEqual([visibleItem(admin, room) !== null, visibleItem(mateo, room)], [true, null]);
  });
  it('never delivers what happens in another business', async () => {
    const world = await operationWorld();
    const admin = await connect(world, { role: 'admin', email: BOSS });
    world.hub.publish({ type: 'ticket.created', businessId: OTHER_BUSINESS_ID, at: new Date(), queueId: world.caja.id });
    await tick();
    assert.deepEqual(admin.names(), ['ready']);
    admin.subscription.unsubscribe();
  });
  it('stops listening when the connection closes', async () => {
    const world = await operationWorld();
    const laura = await connect(world, { role: 'operator', email: LAURA });
    assert.equal(world.hub.count(BUSINESS_ID), 1);
    laura.subscription.unsubscribe();
    assert.equal(world.hub.count(BUSINESS_ID), 0);
  });
});

describe('the stream is authorized again while it stays open', () => {
  it('says the access is revoked and closes when the session ends, on the next event', async () => {
    const world = await operationWorld();
    const laura = await connect(world, { role: 'operator', email: LAURA });
    laura.checks.session = false;
    await world.issue(world.caja.id);
    await tick();
    assert.deepEqual(laura.names(), ['ready', 'access.revoked']);
    assert.equal(laura.isCompleted(), true);
    await world.issue(world.caja.id);
    await tick();
    assert.equal(laura.names().filter((name) => name === 'ticket.created').length, 0, 'nothing is delivered after the revocation');
  });
  it('the same when the operator is removed from the business, the module is switched off or the administrator is replaced', async () => {
    const world = await operationWorld();
    const operator = await connect(world, { role: 'operator', email: LAURA });
    operator.checks.operator = false;
    const admin = await connect(world, { role: 'admin', email: BOSS });
    admin.checks.administrator = false;
    await world.issue(world.caja.id);
    await tick();
    assert.deepEqual([operator.names().at(-1), admin.names().at(-1)], ['access.revoked', 'access.revoked']);
    assert.deepEqual([operator.isCompleted(), admin.isCompleted()], [true, true]);
  });
  it('closes by itself on the heartbeat when the person lost the access and nothing else happened', async () => {
    const world = await operationWorld();
    const checks = new FakeChecks();
    const stream = new TurnosStreamService(world.hub, world.access, checks);
    stream.heartbeatMs = 15;
    const names: string[] = [];
    const subscription = stream.open({ role: 'operator', email: LAURA, businessId: BUSINESS_ID, sessionId: 's' }).subscribe((item) => names.push(item.name));
    await tick(40);
    assert.ok(names.includes('ping'));
    checks.operator = false;
    await tick(40);
    assert.equal(names.at(-1), 'access.revoked');
    subscription.unsubscribe();
  });
  it('when the administrator changes the permissions of an open session, the stream is told at once and reads the new ones', async () => {
    const world = await operationWorld();
    const mateo = await connect(world, { role: 'operator', email: MATEO });
    const record = (await world.service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await world.service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, MATEO, [world.recogida.id, world.caja.id], { views: ['create-turn', 'surveys'] }));
    await tick();
    const updated = mateo.items.find((item) => item.name === 'access.updated')!;
    assert.deepEqual([updated.scope?.queueIds, updated.scope?.views, updated.scope?.firstView], [[world.caja.id, world.recogida.id], ['create-turn', 'surveys'], 'create-turn']);
    await world.issue(world.caja.id);
    await tick();
    assert.ok(mateo.items.some((item) => item.name === 'ticket.created'), 'and now he hears the queue he was given');
    mateo.subscription.unsubscribe();
  });
  it('other operators are not bothered by the change, and taking every view away revokes that stream', async () => {
    const world = await operationWorld();
    const [laura, mateo] = [await connect(world, { role: 'operator', email: LAURA }), await connect(world, { role: 'operator', email: MATEO })];
    const record = (await world.service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await world.service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, MATEO, record.queueIds, { views: [] }));
    await tick();
    assert.equal(laura.names().includes('access.updated'), false);
    assert.equal(mateo.names().at(-1), 'access.revoked');
    assert.equal(mateo.isCompleted(), true);
    laura.subscription.unsubscribe();
  });
  it('a stream opened for someone who cannot operate is revoked right away', async () => {
    const world = await operationWorld();
    const nobody = await connect(world, { role: 'operator', email: 'nobody@x.co' });
    assert.deepEqual(nobody.names(), ['access.revoked']);
    assert.equal(nobody.isCompleted(), true);
  });
});
