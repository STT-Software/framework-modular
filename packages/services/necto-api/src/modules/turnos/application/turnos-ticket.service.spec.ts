import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import {
  InvalidTicketStateError,
  NotNextInLineError,
  OperatorBusyError,
  QueueEmptyError,
  QueueHasOpenTurnsError,
  QueueNotFoundError,
  QueuePausedError,
  TicketAlreadyTakenError,
  TicketNotFoundError,
  TurnosInvalidError,
  ViewNotAllowedError,
} from '../domain/errors';
import { BOSS, BUSINESS_ID, LAURA, MATEO, SOFIA, operationWorld, operatorInput } from '../fakes.spec';

const fieldsOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof TurnosInvalidError, `expected an invalid error, got ${String(error)}`);
    return error.fields;
  }
  assert.fail('it should have been refused');
};

describe('creating a turn', () => {
  it('numbers each queue with its prefix and three digits, and each prefix counts on its own', async () => {
    const { issue, caja, recogida } = await operationWorld();
    assert.deepEqual([(await issue(caja.id)).code, (await issue(caja.id)).code, (await issue(recogida.id)).code, (await issue(caja.id)).code], ['P-001', 'P-002', 'R-001', 'P-003']);
  });
  it('keeps the queue name, who created it and the arrival time, and starts waiting', async () => {
    const { issue, caja, clock } = await operationWorld();
    const ticket = await issue(caja.id, { customerName: ' Ana Pérez ', customerPhone: '+57 300 123 4567', customerEmail: 'ANA@X.CO', note: 'Silla de ruedas' });
    assert.deepEqual([ticket.status, ticket.queueName, ticket.createdBy.name, ticket.createdAt.toISOString(), ticket.dayKey], ['waiting', 'Pedidos en caja', 'Laura Gómez', clock.now().toISOString(), '2026-03-04']);
    assert.deepEqual(ticket.customer, { name: 'Ana Pérez', phone: '+573001234567', email: 'ana@x.co' });
    assert.deepEqual(ticket.events.map((event) => event.type), ['created']);
  });
  it('shares one numbering between queues that share a prefix, so no code repeats in the day', async () => {
    const { issue, caja, recogida, service, operator } = await operationWorld();
    await service.saveRules(BUSINESS_ID, { prefixMode: 'fixed', fixedPrefix: 't', dailyReset: true, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 });
    const codes = [(await issue(caja.id)).code, (await issue(recogida.id)).code, (await issue(caja.id)).code];
    assert.deepEqual(codes, ['T-001', 'T-002', 'T-003']);
    assert.ok((await operator(LAURA)).queueIds!.length === 2);
  });
  it('restarts the numbering at midnight of the business, in its time zone, when the rules say so', async () => {
    const { issue, caja, clock } = await operationWorld();
    await issue(caja.id);
    await issue(caja.id);
    // 04:50 UTC is 23:50 of March 4 in Bogotá; ten minutes later it is already March 5 there (but still March 5 04:xx in UTC).
    clock.advance(13 * 3_600_000 + 50 * 60_000);
    assert.equal((await issue(caja.id)).code, 'P-003', '23:50 of the same business day');
    clock.advance(20 * 60_000);
    const next = await issue(caja.id);
    assert.deepEqual([next.code, next.dayKey], ['P-001', '2026-03-05']);
  });
  it('keeps counting across days when the numbering does not restart', async () => {
    const { issue, caja, clock, service } = await operationWorld();
    await service.saveRules(BUSINESS_ID, { prefixMode: 'initial', dailyReset: false, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 });
    await issue(caja.id);
    clock.advance(24 * 3_600_000);
    assert.deepEqual([(await issue(caja.id)).code, (await issue(caja.id)).dayKey], ['P-002', '2026-03-05']);
  });
  it('skips a code that already exists that day (the mode of the numbering changed) instead of repeating it', async () => {
    const { issue, caja, service, tickets } = await operationWorld();
    await issue(caja.id);
    await service.saveRules(BUSINESS_ID, { prefixMode: 'initial', dailyReset: false, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 });
    // The "all days" counter starts at 1, but P-001 is already taken today: the next free one is used.
    assert.equal((await issue(caja.id)).code, 'P-002');
    assert.equal(new Set([...tickets.items.values()].map((ticket) => ticket.code)).size, 2);
  });
  it('asks for the extra fields of the queue: required, typed, and from the list of options', async () => {
    const { issue, caja, service, operator, ticketService } = await operationWorld();
    await service.updateQueue(BUSINESS_ID, caja.id, {
      name: caja.name,
      mode: caja.mode,
      averageMinutes: caja.averageMinutes,
      fields: [
        { id: 'doc', label: 'Documento', type: 'text', required: true },
        { id: 'motivo', label: 'Motivo', type: 'select', options: ['Pago', 'Consulta'], required: true },
        { id: 'edad', label: 'Edad', type: 'number' },
      ],
    });
    const scope = await operator(LAURA);
    assert.deepEqual(Object.keys(await fieldsOf(ticketService.create(scope, caja.id, {}))).sort(), ['answers.doc', 'answers.motivo']);
    assert.deepEqual(Object.keys(await fieldsOf(ticketService.create(scope, caja.id, { answers: { doc: '1', motivo: 'Otro', edad: 'x', extra: 'y' } }))).sort(), ['answers.edad', 'answers.extra', 'answers.motivo']);
    const ticket = await issue(caja.id, { answers: { doc: ' 99 ', motivo: 'Pago', edad: '31' } });
    assert.deepEqual(ticket.answers.map((answer) => [answer.fieldId, answer.label, answer.value]), [['doc', 'Documento', '99'], ['motivo', 'Motivo', 'Pago'], ['edad', 'Edad', 31]]);
  });
  it('refuses a customer with a malformed email or phone, saying which field', async () => {
    const { caja, operator, ticketService } = await operationWorld();
    const fields = await fieldsOf(ticketService.create(await operator(LAURA), caja.id, { customerEmail: 'nope', customerPhone: '12', customerName: 'A', note: 'x'.repeat(400) }));
    assert.deepEqual(Object.keys(fields).sort(), ['customerEmail', 'customerName', 'customerPhone', 'note']);
  });
  it('a paused queue takes no new turns and keeps the ones it has; resuming opens it again', async () => {
    const { issue, caja, operator, ticketService } = await operationWorld();
    const first = await issue(caja.id);
    await ticketService.setQueueStatus(await operator(LAURA), caja.id, 'paused');
    await assert.rejects(issue(caja.id), QueuePausedError);
    assert.equal((await ticketService.get(await operator(LAURA), first.id)).status, 'waiting', 'the existing turn stays');
    const called = await ticketService.call(await operator(LAURA), first.id);
    assert.equal(called.ticket.status, 'attending', 'and can still be attended');
    await ticketService.setQueueStatus(await operator(LAURA), caja.id, 'active');
    assert.equal((await issue(caja.id)).code, 'P-002');
  });
  it('the same clientRequestId creates the turn once and answers the same turn again', async () => {
    const { caja, operator, ticketService, tickets } = await operationWorld();
    const scope = await operator(LAURA);
    const a = await ticketService.create(scope, caja.id, { clientRequestId: 'request-0001' });
    const b = await ticketService.create(scope, caja.id, { clientRequestId: 'request-0001' });
    assert.deepEqual([a.created, b.created, a.ticket.id === b.ticket.id, tickets.items.size], [true, false, true, 1]);
    await assert.rejects(ticketService.create(await operator(LAURA), (await operator(LAURA)).queueIds![1], { clientRequestId: 'request-0001' }), TurnosInvalidError, 'another queue cannot reuse it');
    assert.ok((await fieldsOf(ticketService.create(scope, caja.id, { clientRequestId: 'x' }))).clientRequestId);
  });
  it('gives different numbers to turns created at the same moment', async () => {
    const { caja, operator, ticketService, tickets } = await operationWorld();
    const scope = await operator(LAURA);
    const created = await Promise.all(Array.from({ length: 40 }, () => ticketService.create(scope, caja.id, {})));
    const codes = created.map((result) => result.ticket.code);
    assert.equal(new Set(codes).size, 40, 'no repeated code');
    assert.deepEqual([...codes].sort(), Array.from({ length: 40 }, (_, index) => `P-${String(index + 1).padStart(3, '0')}`).sort());
    assert.equal(tickets.items.size, 40);
  });
  it('the same retried request made many times at once still creates one turn', async () => {
    const { caja, operator, ticketService, tickets } = await operationWorld();
    const scope = await operator(LAURA);
    const results = await Promise.all(Array.from({ length: 10 }, () => ticketService.create(scope, caja.id, { clientRequestId: 'same-click-1' })));
    assert.equal(new Set(results.map((result) => result.ticket.id)).size, 1);
    assert.equal(tickets.items.size, 1);
    assert.equal(results.filter((result) => result.created).length, 1);
  });
});

describe('who may create turns', () => {
  it('an operator creates only in their queues and only with the view; the administrator creates anywhere, under their own identity', async () => {
    const { caja, recogida, operator, admin, ticketService } = await operationWorld();
    await assert.rejects(ticketService.create(await operator(MATEO), caja.id, {}), QueueNotFoundError, 'Mateo does not work in that queue: it does not exist for him');
    assert.equal((await ticketService.create(await operator(MATEO), recogida.id, {})).created, true);
    const byAdmin = await ticketService.create(await admin(), caja.id, {});
    assert.deepEqual([byAdmin.created, byAdmin.ticket.createdBy], [true, { operatorId: 'admin:ana@cafecentral.co', name: 'Ana Gómez' }]);
    await assert.rejects(ticketService.create(await operator(LAURA), 'ghost', {}), QueueNotFoundError);
  });
  it('an operator without the create-turn view cannot, even with queues', async () => {
    const { service, operator, recogida, ticketService } = await operationWorld();
    const state = await service.get(BUSINESS_ID);
    const mateo = state.configuration.operators.find((item) => item.email === MATEO)!;
    await service.updateOperator(BUSINESS_ID, mateo.id, operatorInput(mateo.name, MATEO, [recogida.id], { views: ['my-turns'] }));
    await assert.rejects(ticketService.create(await operator(MATEO), recogida.id, {}), ViewNotAllowedError);
  });
});

describe('calling and attending', () => {
  it('in a manual queue the operator chooses whom to call, and completing does not call anyone', async () => {
    const { issue, recogida, operator, ticketService } = await operationWorld();
    const [first, second, third] = [await issue(recogida.id), await issue(recogida.id), await issue(recogida.id)];
    const laura = await operator(LAURA);
    const called = await ticketService.call(laura, second.id);
    assert.deepEqual([called.applied, called.ticket.status, called.ticket.attendedBy?.name], [true, 'attending', 'Laura Gómez']);
    const done = await ticketService.complete(laura, second.id);
    assert.deepEqual([done.applied, done.ticket.status, done.next], [true, 'completed', null]);
    assert.deepEqual([(await ticketService.get(laura, first.id)).status, (await ticketService.get(laura, third.id)).status], ['waiting', 'waiting']);
  });
  it('in an automatic queue completing a turn calls the next by order of arrival, once', async () => {
    const { issue, caja, operator, ticketService } = await operationWorld();
    const [a, b, c] = [await issue(caja.id), await issue(caja.id), await issue(caja.id)];
    const laura = await operator(LAURA);
    assert.equal((await ticketService.callNext(laura, caja.id)).ticket.id, a.id);
    const done = await ticketService.complete(laura, a.id);
    assert.deepEqual([done.ticket.status, done.next?.id, done.next?.status, done.next?.events.at(-1)?.automatic], ['completed', b.id, 'attending', true]);
    assert.equal((await ticketService.get(laura, c.id)).status, 'waiting');
    const again = await ticketService.complete(laura, a.id);
    assert.deepEqual([again.applied, again.next], [false, null], 'a repeated completion neither changes anything nor calls another turn');
    assert.equal((await ticketService.current(laura))?.id, b.id);
  });
  it('an automatic queue only lets the next in order be called by hand', async () => {
    const { issue, caja, operator, ticketService } = await operationWorld();
    const [a, b] = [await issue(caja.id), await issue(caja.id)];
    const laura = await operator(LAURA);
    await assert.rejects(ticketService.call(laura, b.id), NotNextInLineError);
    assert.equal((await ticketService.call(laura, a.id)).ticket.id, a.id);
  });
  it('an operator attends one turn at a time, and an empty queue says so', async () => {
    const { issue, caja, recogida, operator, ticketService } = await operationWorld();
    const laura = await operator(LAURA);
    await assert.rejects(ticketService.callNext(laura, caja.id), QueueEmptyError);
    await issue(caja.id);
    await issue(recogida.id);
    await ticketService.callNext(laura, caja.id);
    await assert.rejects(ticketService.callNext(laura, recogida.id), OperatorBusyError, 'they must finish the one they have');
  });
  it('a repeated call by the same operator answers as done before; another operator gets a conflict', async () => {
    const { issue, recogida, operator, ticketService, service } = await operationWorld();
    const ticket = await issue(recogida.id);
    const laura = await operator(LAURA);
    await ticketService.call(laura, ticket.id);
    const again = await ticketService.call(laura, ticket.id);
    assert.deepEqual([again.applied, again.ticket.events.filter((event) => event.type === 'called').length], [false, 1]);
    await assert.rejects(ticketService.call(await operator(MATEO), ticket.id), TicketAlreadyTakenError);
    assert.ok(service);
  });
  it('two operators calling the same turn at the same moment: exactly one gets it', async () => {
    const { issue, recogida, operator, ticketService, tickets } = await operationWorld();
    const ticket = await issue(recogida.id);
    const results = await Promise.allSettled([ticketService.call(await operator(LAURA), ticket.id), ticketService.call(await operator(MATEO), ticket.id)]);
    assert.equal(results.filter((result) => result.status === 'fulfilled' && result.value.applied).length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(tickets.items.get(ticket.id)!.events.filter((event) => event.type === 'called').length, 1, 'one call, one event');
  });
  it('two operators taking the next turn at the same moment get different turns', async () => {
    const { issue, caja, operator, ticketService, service } = await operationWorld();
    const state = await service.get(BUSINESS_ID);
    await service.createOperator(BUSINESS_ID, operatorInput('Ana Díaz', 'ana.d@cafecentral.co', [caja.id]));
    assert.ok(state);
    const [a, b] = [await issue(caja.id), await issue(caja.id)];
    const results = await Promise.all([ticketService.callNext(await operator(LAURA), caja.id), ticketService.callNext(await operator('ana.d@cafecentral.co'), caja.id)]);
    assert.deepEqual(results.map((result) => result.ticket.id).sort(), [a.id, b.id].sort());
  });
  it('the same completion sent at once completes the turn once and calls only one next turn', async () => {
    const { issue, caja, operator, ticketService, tickets } = await operationWorld();
    const [a] = [await issue(caja.id), await issue(caja.id), await issue(caja.id)];
    const laura = await operator(LAURA);
    await ticketService.callNext(laura, caja.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => ticketService.complete(laura, a.id)));
    assert.equal(results.filter((result) => result.applied).length, 1);
    assert.equal([...tickets.items.values()].filter((ticket) => ticket.status === 'attending').length, 1, 'only one next turn was called');
    assert.equal(tickets.items.get(a.id)!.events.filter((event) => event.type === 'completed').length, 1);
  });
  it('two operators completing their turns together each take a different next one', async () => {
    const { issue, caja, operator, ticketService, service } = await operationWorld();
    await service.createOperator(BUSINESS_ID, operatorInput('Ana Díaz', 'ana.d@cafecentral.co', [caja.id]));
    const turns = [await issue(caja.id), await issue(caja.id), await issue(caja.id), await issue(caja.id)];
    const [laura, ana] = [await operator(LAURA), await operator('ana.d@cafecentral.co')];
    await ticketService.callNext(laura, caja.id);
    await ticketService.callNext(ana, caja.id);
    const [x, y] = await Promise.all([ticketService.complete(laura, turns[0].id), ticketService.complete(ana, turns[1].id)]);
    assert.deepEqual([x.next?.id, y.next?.id].sort(), [turns[2].id, turns[3].id].sort());
  });
  it('refuses to complete a turn that is not in attention, and to touch one another operator is attending', async () => {
    const { issue, recogida, operator, ticketService } = await operationWorld();
    const ticket = await issue(recogida.id);
    await assert.rejects(ticketService.complete(await operator(LAURA), ticket.id), InvalidTicketStateError);
    await assert.rejects(ticketService.noShow(await operator(LAURA), ticket.id), InvalidTicketStateError);
    await ticketService.call(await operator(LAURA), ticket.id);
    await assert.rejects(ticketService.complete(await operator(MATEO), ticket.id), TicketAlreadyTakenError);
    await assert.rejects(ticketService.cancel(await operator(MATEO), ticket.id, null), TicketAlreadyTakenError);
  });
  it('cancels a waiting turn, or the one in attention, with a reason; repeating it changes nothing', async () => {
    const { issue, recogida, operator, ticketService } = await operationWorld();
    const [a, b] = [await issue(recogida.id), await issue(recogida.id)];
    const laura = await operator(LAURA);
    const cancelled = await ticketService.cancel(laura, a.id, '  Se fue  ');
    assert.deepEqual([cancelled.applied, cancelled.ticket.status, cancelled.ticket.cancelReason], [true, 'cancelled', 'Se fue']);
    assert.equal((await ticketService.cancel(laura, a.id, null)).applied, false);
    await ticketService.call(laura, b.id);
    assert.equal((await ticketService.cancel(laura, b.id, null)).ticket.status, 'cancelled');
    assert.equal((await ticketService.current(laura)), null);
  });
  it('marks the person called as absent, and a completed turn cannot become absent', async () => {
    const { issue, recogida, operator, ticketService } = await operationWorld();
    const [a, b] = [await issue(recogida.id), await issue(recogida.id)];
    const laura = await operator(LAURA);
    await ticketService.call(laura, a.id);
    assert.equal((await ticketService.noShow(laura, a.id)).ticket.status, 'no-show');
    assert.equal((await ticketService.noShow(laura, a.id)).applied, false);
    await ticketService.call(laura, b.id);
    await ticketService.complete(laura, b.id);
    await assert.rejects(ticketService.noShow(laura, b.id), InvalidTicketStateError);
    await assert.rejects(ticketService.cancel(laura, b.id, null), InvalidTicketStateError);
  });
  it('keeps the whole history of a turn, in order, with who did each thing', async () => {
    const { issue, caja, operator, ticketService } = await operationWorld();
    const ticket = await issue(caja.id);
    const laura = await operator(LAURA);
    await ticketService.callNext(laura, caja.id);
    const done = await ticketService.complete(laura, ticket.id);
    assert.deepEqual(done.ticket.events.map((event) => [event.type, event.by.name]), [['created', 'Laura Gómez'], ['called', 'Laura Gómez'], ['completed', 'Laura Gómez']]);
  });
  it('the queues of other operators do not exist for you: calling or reading their turns answers not found', async () => {
    const { issue, caja, operator, ticketService } = await operationWorld();
    const ticket = await issue(caja.id);
    const mateo = await operator(MATEO);
    await assert.rejects(ticketService.get(mateo, ticket.id), TicketNotFoundError);
    await assert.rejects(ticketService.call(mateo, ticket.id), TicketNotFoundError);
    await assert.rejects(ticketService.complete(mateo, ticket.id), TicketNotFoundError);
    await assert.rejects(ticketService.callNext(mateo, caja.id), QueueNotFoundError);
    await assert.rejects(ticketService.get(mateo, 'nope'), TicketNotFoundError);
  });
  it('an operator without the my-turns view cannot attend', async () => {
    const { issue, caja, operator, ticketService } = await operationWorld();
    await issue(caja.id);
    await assert.rejects(ticketService.callNext(await operator(SOFIA), caja.id), ViewNotAllowedError);
  });
  it('the administrator attends like an operator, under their own identity, one turn at a time, and sees only their own with "mine"', async () => {
    const { issue, caja, recogida, operator, admin, ticketService } = await operationWorld();
    const [a, b, c] = [await issue(caja.id), await issue(recogida.id), await issue(caja.id)];
    const boss = await admin();
    const called = await ticketService.call(boss, a.id);
    assert.deepEqual([called.ticket.attendedBy, called.applied], [{ operatorId: 'admin:ana@cafecentral.co', name: 'Ana Gómez' }, true]);
    await assert.rejects(ticketService.call(boss, b.id), OperatorBusyError);
    await assert.rejects(ticketService.call(await operator(LAURA), a.id), TicketAlreadyTakenError, 'an operator cannot take what the administrator is attending');
    assert.equal((await ticketService.current(boss))?.id, a.id);
    assert.deepEqual((await ticketService.list(boss, { mine: true })).items.map((ticket) => ticket.id), [a.id]);
    const done = await ticketService.complete(boss, a.id);
    assert.deepEqual([done.ticket.status, done.next?.id, done.next?.attendedBy?.operatorId], ['completed', c.id, 'admin:ana@cafecentral.co']);
    await ticketService.complete(boss, c.id);
    assert.equal((await ticketService.cancel(boss, b.id, null)).ticket.status, 'cancelled');
  });
});

describe('looking for turns', () => {
  async function busyDay() {
    const world = await operationWorld();
    const { issue, caja, recogida, operator, ticketService, clock } = world;
    const ana = await issue(recogida.id, { customerName: 'Ana Pérez', customerPhone: '+573001112233' });
    clock.advance(60_000);
    const luis = await issue(caja.id, { customerName: 'Luis Mora', customerEmail: 'luis@x.co' });
    clock.advance(60_000);
    const pedro = await issue(recogida.id, { customerName: 'Pedro Ríos' });
    const laura = await operator(LAURA);
    await ticketService.call(laura, ana.id);
    await ticketService.complete(laura, ana.id);
    return { ...world, ana, luis, pedro };
  }
  it('filters by status and queue, newest first by default or by order of arrival', async () => {
    const { operator, ticketService, ana, luis, pedro, recogida } = await busyDay();
    const laura = await operator(LAURA);
    assert.deepEqual((await ticketService.list(laura, {})).items.map((ticket) => ticket.id), [pedro.id, luis.id, ana.id]);
    assert.deepEqual((await ticketService.list(laura, { order: 'arrival' })).items.map((ticket) => ticket.id), [ana.id, luis.id, pedro.id]);
    assert.deepEqual((await ticketService.list(laura, { statuses: ['waiting'] })).items.map((ticket) => ticket.id), [pedro.id, luis.id]);
    assert.deepEqual((await ticketService.list(laura, { statuses: ['completed', 'cancelled'] })).items.map((ticket) => ticket.id), [ana.id]);
    assert.deepEqual((await ticketService.list(laura, { queueId: recogida.id })).items.map((ticket) => ticket.id), [pedro.id, ana.id]);
  });
  it('searches the code, the name, the phone and the email, ignoring case', async () => {
    const { operator, ticketService, ana, luis, pedro } = await busyDay();
    const laura = await operator(LAURA);
    const found = async (search: string) => (await ticketService.list(laura, { search })).items.map((ticket) => ticket.id);
    assert.deepEqual(await found('r-001'), [ana.id]);
    assert.deepEqual(await found('P-001'), [luis.id]);
    assert.deepEqual(await found('RÍOS'), [pedro.id]);
    assert.deepEqual(await found('1112233'), [ana.id]);
    assert.deepEqual(await found('luis@x'), [luis.id]);
    assert.deepEqual(await found('nadie'), []);
  });
  it('filters by day, in the time zone of the business, and by the turns the operator called', async () => {
    const { operator, ticketService, ana } = await busyDay();
    const laura = await operator(LAURA);
    assert.equal((await ticketService.list(laura, { preset: 'today' })).total, 3);
    assert.equal((await ticketService.list(laura, { preset: 'yesterday' })).total, 0);
    assert.deepEqual((await ticketService.list(laura, { mine: true })).items.map((ticket) => ticket.id), [ana.id]);
  });
  it('paginates and refuses bad filters, saying which', async () => {
    const { operator, ticketService } = await busyDay();
    const laura = await operator(LAURA);
    const page = await ticketService.list(laura, { pageSize: 2, page: 2, order: 'arrival' });
    assert.deepEqual([page.items.length, page.total, page.page, page.pageSize], [1, 3, 2, 2]);
    assert.ok((await fieldsOf(ticketService.list(laura, { statuses: ['done'] }))).status);
    assert.ok((await fieldsOf(ticketService.list(laura, { order: 'sideways' }))).order);
    assert.ok((await fieldsOf(ticketService.list(laura, { pageSize: 1000 }))).pageSize);
    assert.ok((await fieldsOf(ticketService.list(laura, { page: 0 }))).page);
    assert.ok((await fieldsOf(ticketService.list(laura, { from: '2026-03-04' }))).to);
  });
  it('an operator sees only the turns of their queues; the administrator sees all and can filter by operator', async () => {
    const { operator, admin, ticketService, ana, luis, pedro } = await busyDay();
    assert.deepEqual((await ticketService.list(await operator(MATEO), {})).items.map((ticket) => ticket.id), [pedro.id, ana.id], 'only the manual queue he works in');
    assert.deepEqual((await ticketService.list(await admin(), { order: 'arrival' })).items.map((ticket) => ticket.id), [ana.id, luis.id, pedro.id]);
    assert.deepEqual((await ticketService.list(await admin(), { operatorId: (await operator(LAURA)).operator!.id })).items.map((ticket) => ticket.id), [ana.id]);
    assert.ok((await fieldsOf(ticketService.list(await operator(MATEO), { queueId: luis.queueId }))).queueId, 'asking for another queue is refused');
  });
  it('another business never shows up in a list', async () => {
    const { operator, ticketService, directory, service, tickets } = await busyDay();
    const others = await service.get(BUSINESS_ID);
    assert.ok(others);
    directory.set({ ...directory.businesses.get(BUSINESS_ID)!, id: 'c'.repeat(24), name: 'Otro', boss: { assignmentId: 'x', name: 'Otro', email: 'otro@x.co' } });
    const before = tickets.items.size;
    const scope = await operator(LAURA);
    assert.equal((await ticketService.list({ ...scope, businessId: 'c'.repeat(24) }, {})).total, 0);
    assert.equal(tickets.items.size, before);
  });
  it('report: reads the same filters and says when it was cut', async () => {
    const { admin, ticketService } = await busyDay();
    const report = await ticketService.forReport(await admin(), { statuses: ['waiting'] });
    assert.deepEqual([report.items.length, report.truncated], [2, false]);
    assert.deepEqual(report.items.map((ticket) => ticket.code), ['P-001', 'R-002'], 'oldest first');
  });
});

describe('pausing queues and permissions that change', () => {
  it('an operator pauses only the queues they work in and only with the queues view; the administrator pauses any', async () => {
    const { caja, recogida, operator, admin, ticketService } = await operationWorld();
    await assert.rejects(ticketService.setQueueStatus(await operator(MATEO), recogida.id, 'paused'), ViewNotAllowedError);
    await assert.rejects(ticketService.setQueueStatus(await operator(LAURA), 'ghost', 'paused'), QueueNotFoundError);
    assert.equal((await ticketService.setQueueStatus(await admin(), caja.id, 'paused')).status, 'paused');
    assert.equal((await ticketService.setQueueStatus(await admin(), caja.id, 'paused')).status, 'paused', 'repeating changes nothing');
    assert.equal((await ticketService.setQueueStatus(await operator(LAURA), caja.id, 'active')).status, 'active');
  });
  it('pausing a queue does not clear that the configuration is ready', async () => {
    const { caja, admin, ticketService, service } = await operationWorld();
    await service.complete(BUSINESS_ID);
    await ticketService.setQueueStatus(await admin(), caja.id, 'paused');
    assert.ok((await service.get(BUSINESS_ID)).configuration.readyAt, 'it is an operational switch, not an edit of the configuration');
  });
  it('a queue with turns waiting or in attention cannot be deleted; once they are finished it can', async () => {
    const { issue, caja, recogida, service, operator, ticketService } = await operationWorld();
    const ticket = await issue(recogida.id);
    await assert.rejects(service.deleteQueue(BUSINESS_ID, recogida.id, []), QueueHasOpenTurnsError);
    await ticketService.cancel(await operator(LAURA), ticket.id, null);
    const state = await service.deleteQueue(BUSINESS_ID, recogida.id, [{ operatorId: (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!.id, queueId: caja.id }]);
    assert.ok(!state.configuration.queues.some((queue) => queue.id === recogida.id));
  });
  it('switching an operator off, or removing them, gives the turn they were attending back to the line, in its place', async () => {
    const { issue, recogida, service, operator, ticketService, tickets } = await operationWorld();
    const [first, second] = [await issue(recogida.id), await issue(recogida.id)];
    const mateo = await operator(MATEO);
    await ticketService.call(mateo, first.id);
    const record = (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, MATEO, record.queueIds, { status: 'inactive' }));
    const released = tickets.items.get(first.id)!;
    assert.deepEqual([released.status, released.attendedBy, released.events.at(-1)?.type], ['waiting', null, 'released']);
    const head = await tickets.head(BUSINESS_ID, recogida.id);
    assert.equal(head?.id, first.id, 'it goes back to the front: it arrived first');
    assert.ok(second);
  });
  it('taking the turns view away from an operator who is attending releases their turn too', async () => {
    const { issue, recogida, service, operator, ticketService, tickets } = await operationWorld();
    const ticket = await issue(recogida.id);
    await ticketService.call(await operator(MATEO), ticket.id);
    const record = (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, MATEO, record.queueIds, { views: ['home', 'create-turn'] }));
    assert.equal(tickets.items.get(ticket.id)!.status, 'waiting');
    await assert.rejects(ticketService.callNext(await operator(MATEO, ['home', 'create-turn']).catch(() => operator(MATEO)), recogida.id), ViewNotAllowedError);
  });
  it('is applied to a scope read before: a change made after is seen on the next request', async () => {
    const { issue, recogida, service, operator, ticketService } = await operationWorld();
    await issue(recogida.id);
    const before = await operator(MATEO);
    assert.ok((await ticketService.list(before, {})).total === 1);
    const record = (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await service.updateOperator(BUSINESS_ID, record.id, operatorInput(record.name, MATEO, record.queueIds, { views: ['home'] }));
    await assert.rejects(operator(MATEO, ['my-turns']), ViewNotAllowedError);
    assert.ok((await operator(MATEO, ['home'])).views.includes('home'));
    assert.equal(BOSS.includes('@'), true);
  });
});
