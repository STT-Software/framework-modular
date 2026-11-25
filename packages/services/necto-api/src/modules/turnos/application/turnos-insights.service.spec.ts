import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdministratorRequiredError, TurnosInvalidError, ViewNotAllowedError } from '../domain/errors';
import { BUSINESS_ID, LAURA, MATEO, SOFIA, operationWorld, operatorInput, setupTurnos } from '../fakes.spec';

const MIN = 60_000;
type World = Awaited<ReturnType<typeof operationWorld>>;
/** A day with real work: Laura attends two turns of the automatic queue (waits of 4 and 6 minutes), Mateo one of the manual queue, one is cancelled. */
async function workedDay(world: World) {
  const { issue, caja, recogida, operator, ticketService, clock } = world;
  const laura = await operator(LAURA);
  const mateo = await operator(MATEO);
  const a = await issue(caja.id, { customerName: 'Ana' });
  const b = await issue(caja.id, { customerName: 'Beto' });
  const r = await issue(recogida.id, { customerName: 'Rosa' }, MATEO);
  const gone = await issue(recogida.id, { customerName: 'Carlos' }, MATEO);
  clock.advance(4 * MIN);
  await ticketService.callNext(laura, caja.id);
  clock.advance(10 * MIN);
  await ticketService.complete(laura, a.id);
  clock.advance(2 * MIN);
  await ticketService.complete(laura, b.id);
  await ticketService.call(mateo, r.id);
  clock.advance(5 * MIN);
  await ticketService.complete(mateo, r.id);
  await ticketService.cancel(mateo, gone.id, 'Se fue');
  return { a, b, r, gone };
}

describe('the dashboard counts what really happened', () => {
  it('answers zeros and nulls, not invented numbers, for a business that has not served anyone', async () => {
    const world = await operationWorld();
    const overview = await world.insights.overview(await world.admin(), {});
    assert.deepEqual(overview.totals, { created: 0, completed: 0, cancelled: 0, noShow: 0, called: 0, averageWaitMinutes: null, averageServiceMinutes: null, completionRate: null, noShowRate: null });
    assert.deepEqual(overview.board.map((entry) => [entry.waiting, entry.attending, entry.longestWaitMinutes, entry.state]), [[0, 0, null, 'empty'], [0, 0, null, 'empty']]);
    assert.deepEqual([overview.daily.length, overview.hourly.length, overview.mine.created], [1, 24, 0]);
    const idle = setupTurnos();
    const scope = await idle.access.forAdmin('ana@cafecentral.co', BUSINESS_ID);
    assert.equal((await idle.insights.overview(scope, {})).totals.created, 0, 'a business whose Turnos was never opened');
  });
  it('totals, rates, waits and the state of each queue come from the turns', async () => {
    const world = await operationWorld();
    await workedDay(world);
    await world.issue(world.caja.id);
    const overview = await world.insights.overview(await world.admin(), { preset: 'today' });
    const { totals } = overview;
    assert.deepEqual([totals.created, totals.completed, totals.cancelled, totals.noShow], [5, 3, 1, 0]);
    assert.equal(totals.completionRate, 60);
    assert.equal(totals.averageWaitMinutes, 11.3, 'waits of 4, 14 and 16 minutes, from the creation to the call');
    assert.equal(totals.averageServiceMinutes, 5.7, 'attentions of 10, 2 and 5 minutes');
    const caja = overview.board.find((entry) => entry.queue.id === world.caja.id)!;
    assert.deepEqual([caja.waiting, caja.metrics.created, caja.metrics.completed], [1, 3, 2]);
    assert.equal(overview.daily[0].created, 5);
    assert.equal(overview.hourly[10].created, 5, 'all created at 10:00 of the business, not of the server');
  });
  it('an operator sees only the numbers of their queues, plus their own', async () => {
    const world = await operationWorld();
    await workedDay(world);
    const mateo = await world.insights.overview(await world.operator(MATEO), {});
    assert.deepEqual([mateo.totals.created, mateo.board.length, mateo.board[0].queue.id], [2, 1, world.recogida.id]);
    assert.deepEqual([mateo.mine?.completed, mateo.mine?.cancelled], [1, 0], 'he called one turn and completed it; the cancelled one was never called');
    const laura = await world.insights.overview(await world.operator(LAURA), {});
    assert.deepEqual([laura.totals.created, laura.mine?.completed], [4, 2]);
  });
  it('needs the home view for an operator', async () => {
    const world = await operationWorld();
    await assert.rejects(world.insights.overview(await world.operator(SOFIA), {}), ViewNotAllowedError);
    await assert.rejects(world.insights.activity(await world.operator(SOFIA), 5), ViewNotAllowedError);
  });
  it('days with no turns are still in the series, and a range outside what happened is empty', async () => {
    const world = await operationWorld();
    await workedDay(world);
    const week = await world.insights.overview(await world.admin(), { preset: '7d' });
    assert.deepEqual([week.daily.length, week.daily.filter((day) => day.created === 0).length], [7, 6]);
    const past = await world.insights.overview(await world.admin(), { from: '2026-02-01', to: '2026-02-10' });
    assert.equal(past.totals.created, 0);
    await assert.rejects(world.insights.overview(await world.admin(), { from: '2026-02-01', to: '2026-12-31' }), TurnosInvalidError);
  });
});

describe('the team', () => {
  it('shows what each operator did, with the time of attention and who is attending now', async () => {
    const world = await operationWorld();
    await workedDay(world);
    const extra = await world.issue(world.recogida.id);
    await world.ticketService.call(await world.operator(MATEO), extra.id);
    const { members } = await world.insights.team(await world.admin(), {});
    const byName = Object.fromEntries(members.map((member) => [member.name, member]));
    assert.deepEqual([byName['Laura Gómez'].attended, byName['Laura Gómez'].completed, byName['Laura Gómez'].averageServiceMinutes], [2, 2, 6]);
    assert.deepEqual([byName['Mateo Ríos'].attended, byName['Mateo Ríos'].completed, byName['Mateo Ríos'].current?.code], [2, 1, extra.code]);
    assert.deepEqual([byName['Sofía Paz'].attended, byName['Sofía Paz'].averageServiceMinutes, byName['Sofía Paz'].status], [0, null, 'active']);
  });
  it('is for the administrator only: it compares people', async () => {
    const world = await operationWorld();
    await assert.rejects(world.insights.team(await world.operator(LAURA), {}), AdministratorRequiredError);
  });
});

describe('recent activity', () => {
  it('lists the latest events newest first, and an operator only sees their queues', async () => {
    const world = await operationWorld();
    await workedDay(world);
    const all = await world.insights.activity(await world.admin(), 3);
    assert.equal(all.length, 3);
    assert.ok(all[0].at >= all[1].at && all[1].at >= all[2].at);
    const mateo = await world.insights.activity(await world.operator(MATEO), 50);
    assert.ok(mateo.length > 0 && mateo.every((entry) => entry.queueId === world.recogida.id));
    assert.ok(mateo.some((entry) => entry.type === 'cancelled'));
  });
  it('marks the calls that the queue made by itself', async () => {
    const world = await operationWorld();
    const [a] = [await world.issue(world.caja.id), await world.issue(world.caja.id)];
    const laura = await world.operator(LAURA);
    await world.ticketService.callNext(laura, world.caja.id);
    await world.ticketService.complete(laura, a.id);
    const calls = (await world.insights.activity(await world.admin(), 20)).filter((entry) => entry.type === 'called');
    assert.deepEqual(calls.map((entry) => entry.automatic).sort(), [false, true]);
  });
  it('refuses a silly limit', async () => {
    const world = await operationWorld();
    await assert.rejects(world.insights.activity(await world.admin(), 0), TurnosInvalidError);
    await assert.rejects(world.insights.activity(await world.admin(), 500), TurnosInvalidError);
  });
});

describe('the CSV report', () => {
  it('has a header and a row for each turn that matches the filters, oldest first, with the real times', async () => {
    const world = await operationWorld();
    await workedDay(world);
    const report = await world.insights.report(await world.admin(), {});
    const lines = report.csv.trimEnd().split('\r\n');
    assert.deepEqual([lines.length, report.rows, report.truncated, report.fileName], [5, 4, false, 'turnos-2026-03-04_2026-03-04.csv']);
    assert.ok(lines[0].startsWith('code,queue,status'));
    assert.ok(lines[1].startsWith('P-001,Pedidos en caja,completed,2026-03-04,'));
    assert.ok(lines.at(-1)!.includes('cancelled') && lines.at(-1)!.includes('Se fue'));
    const filtered = await world.insights.report(await world.admin(), { statuses: ['cancelled'], queueId: world.recogida.id });
    assert.equal(filtered.rows, 1);
    const searched = await world.insights.report(await world.admin(), { search: 'Rosa' });
    assert.equal(searched.rows, 1);
  });
  it('can not be used by an operator, and a formula typed by a customer never reaches a spreadsheet as one', async () => {
    const world = await operationWorld();
    await assert.rejects(world.insights.report(await world.operator(LAURA), {}), AdministratorRequiredError);
    await world.issue(world.caja.id, { customerName: '=SUMA(A1:A9)', note: '+cmd|calc' });
    const { csv } = await world.insights.report(await world.admin(), {});
    assert.ok(csv.includes("'=SUMA(A1:A9)") && csv.includes("'+cmd|calc"));
  });
  it('is empty for a range with nothing, but still has its header', async () => {
    const world = await operationWorld();
    const report = await world.insights.report(await world.admin(), { from: '2026-01-01', to: '2026-01-02' });
    assert.deepEqual([report.rows, report.csv.trimEnd().split('\r\n').length], [0, 1]);
  });
});

describe('the room screen', () => {
  it('is configured by the administrator, validated, and shows only the calls of the queues chosen with the names as set', async () => {
    const world = await operationWorld();
    const admin = await world.admin();
    await assert.rejects(world.settings.saveRoomScreen(await world.operator(LAURA), { enabled: true, customerName: 'full', playSound: true, recentCalls: 3 }), AdministratorRequiredError);
    await assert.rejects(world.settings.saveRoomScreen(admin, { enabled: true, customerName: 'nickname', playSound: 'yes' as never, recentCalls: 99, queueIds: ['ghost'], message: 'x'.repeat(200) }), (error: unknown) =>
      error instanceof TurnosInvalidError && ['customerName', 'playSound', 'recentCalls', 'queueIds', 'message'].every((field) => Boolean(error.fields[field])),
    );
    const [a, b] = [await world.issue(world.caja.id, { customerName: 'Ana María Pérez' }), await world.issue(world.recogida.id, { customerName: 'Beto Soto' })];
    await world.ticketService.call(await world.operator(LAURA), a.id);
    await world.ticketService.call(await world.operator(MATEO), b.id);
    const saved = await world.settings.saveRoomScreen(admin, { enabled: true, customerName: 'first-name', playSound: false, recentCalls: 5, queueIds: [world.caja.id], message: ' Bienvenidos ' });
    assert.deepEqual([saved.enabled, saved.queueIds, saved.message, saved.playSound], [true, [world.caja.id], 'Bienvenidos', false]);
    const screen = await world.insights.roomScreen(await world.admin());
    assert.deepEqual(screen.calls.map((call) => [call.code, call.customer]), [['P-001', 'Ana']], 'only the chosen queue, only the first name');
    const hidden = await world.settings.saveRoomScreen(await world.admin(), { enabled: true, customerName: 'hidden', playSound: true, recentCalls: 1 });
    assert.equal((await world.insights.roomScreen(await world.admin(), hidden)).calls.length, 1, 'no selection: every queue, as many as asked');
    assert.equal((await world.insights.roomScreen(await world.admin(), hidden)).calls[0].customer, null);
    await assert.rejects(world.insights.roomScreen(await world.operator(LAURA)), AdministratorRequiredError);
  });
  it('a queue that is deleted leaves the selection, and an empty selection goes back to every queue', async () => {
    const world = await operationWorld();
    await world.settings.saveRoomScreen(await world.admin(), { enabled: true, customerName: 'full', playSound: true, recentCalls: 3, queueIds: [world.recogida.id] });
    const mateo = (await world.service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === MATEO)!;
    await world.service.deleteQueue(BUSINESS_ID, world.recogida.id, [{ operatorId: mateo.id, queueId: world.caja.id }]);
    assert.equal((await world.service.get(BUSINESS_ID)).configuration.roomScreen.queueIds, null);
    assert.ok(operatorInput);
  });
});
