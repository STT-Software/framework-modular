import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TurnosInvalidError } from './errors';
import { addDays, localDayKey, localHour, startOfLocalDay } from './local-day';
import { buildQueueBoard, dailySeries, hourlySeries, queueState, teamPerformance, totalsOf } from './metrics';
import { resolveRange } from './range';
import { buildCsv, csvCell } from './report';
import type { Operator, Queue } from './configuration';
import { DEFAULT_RULES } from './rules';
import { ticketCode, type Ticket } from './ticket';
const BOGOTA = 'America/Bogota';
const at = (iso: string) => new Date(iso);
function ticket(extra: Partial<Ticket> & Pick<Ticket, 'id'>): Ticket {
  return {
    businessId: 'b',
    queueId: 'q1',
    queueName: 'Caja',
    dayKey: '2026-03-04',
    prefix: 'C',
    number: 1,
    code: 'C-001',
    seq: 1,
    status: 'waiting',
    customer: { name: null, phone: null, email: null },
    answers: [],
    note: null,
    createdAt: at('2026-03-04T15:00:00Z'),
    createdBy: { operatorId: 'o1', name: 'Laura' },
    attendedBy: null,
    calledAt: null,
    finishedAt: null,
    cancelReason: null,
    events: [],
    clientRequestId: null,
    ...extra,
  };
}
const queue = (extra: Partial<Queue> = {}): Queue => ({
  id: 'q1',
  name: 'Caja',
  color: 'orange',
  mode: 'auto',
  averageMinutes: 5,
  source: 'custom',
  overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null },
  status: 'active',
  fields: [],
  ...extra,
});
describe('the day of the business', () => {
  it('is the day in its time zone, not the server one', () => {
    const instant = at('2026-03-05T03:30:00Z');
    assert.equal(localDayKey(instant, BOGOTA), '2026-03-04');
    assert.equal(localDayKey(instant, 'UTC'), '2026-03-05');
    assert.equal(localHour(instant, BOGOTA), 22);
  });
  it('finds where a local day starts and moves between days', () => {
    assert.equal(startOfLocalDay('2026-03-04', BOGOTA).toISOString(), '2026-03-04T05:00:00.000Z');
    assert.equal(startOfLocalDay('2026-03-04', 'Asia/Kolkata').toISOString(), '2026-03-03T18:30:00.000Z');
    assert.equal(addDays('2026-03-31', 1), '2026-04-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  });
});
describe('the ranges of the dashboards', () => {
  const now = at('2026-03-05T03:30:00Z');
  it('takes today of the business by default, and presets that end today', () => {
    assert.deepEqual([resolveRange({}, now, BOGOTA).fromDay, resolveRange({}, now, BOGOTA).toDay], ['2026-03-04', '2026-03-04']);
    assert.deepEqual([resolveRange({ preset: 'yesterday' }, now, BOGOTA).fromDay, resolveRange({ preset: 'yesterday' }, now, BOGOTA).toDay], ['2026-03-03', '2026-03-03']);
    const week = resolveRange({ preset: '7d' }, now, BOGOTA);
    assert.deepEqual([week.fromDay, week.toDay, week.days], ['2026-02-26', '2026-03-04', 7]);
    assert.equal(week.to.toISOString(), '2026-03-05T05:00:00.000Z', 'it ends where the day after the last one starts');
  });
  it('takes explicit days, both included', () => {
    const range = resolveRange({ from: '2026-03-01', to: '2026-03-03' }, now, BOGOTA);
    assert.deepEqual([range.days, range.from.toISOString(), range.to.toISOString()], [3, '2026-03-01T05:00:00.000Z', '2026-03-04T05:00:00.000Z']);
  });
  it('refuses what does not exist, is reversed, is too long or has only one end', () => {
    const fields = (query: Parameters<typeof resolveRange>[0]) => {
      try {
        resolveRange(query, now, BOGOTA);
      } catch (error) {
        assert.ok(error instanceof TurnosInvalidError);
        return Object.keys(error.fields);
      }
      return [];
    };
    assert.deepEqual(fields({ from: '2026-02-30', to: '2026-03-01' }), ['from']);
    assert.deepEqual(fields({ from: '2026-03-03', to: '2026-03-01' }), ['to']);
    assert.deepEqual(fields({ from: '2026-01-01', to: '2026-12-31' }), ['to']);
    assert.deepEqual(fields({ from: '2026-03-01' }), ['to']);
    assert.deepEqual(fields({ preset: 'forever' }), ['range']);
  });
});
describe('what is counted', () => {
  const done = (id: string, waitMin: number, serviceMin: number, operatorId = 'o1') =>
    ticket({
      id,
      status: 'completed',
      createdAt: at('2026-03-04T15:00:00Z'),
      calledAt: new Date(at('2026-03-04T15:00:00Z').getTime() + waitMin * 60_000),
      finishedAt: new Date(at('2026-03-04T15:00:00Z').getTime() + (waitMin + serviceMin) * 60_000),
      attendedBy: { operatorId, name: operatorId },
    });
  it('averages only what was measured and leaves null where there is nothing, never an invented zero', () => {
    assert.deepEqual(totalsOf([]), { created: 0, completed: 0, cancelled: 0, noShow: 0, called: 0, averageWaitMinutes: null, averageServiceMinutes: null, completionRate: null, noShowRate: null });
    const totals = totalsOf([done('a', 4, 10), done('b', 6, 20), ticket({ id: 'c', status: 'cancelled' }), ticket({ id: 'd', status: 'no-show', calledAt: at('2026-03-04T15:02:00Z'), attendedBy: { operatorId: 'o1', name: 'x' } })]);
    assert.deepEqual([totals.created, totals.completed, totals.cancelled, totals.noShow, totals.called], [4, 2, 1, 1, 3]);
    assert.equal(totals.averageWaitMinutes, 4, 'waits of 4, 6 and 2 minutes');
    assert.equal(totals.averageServiceMinutes, 15);
    assert.equal(totals.completionRate, 50);
    assert.equal(totals.noShowRate, 33.3);
  });
  it('gives one point for each day of the range, also the empty ones, and the hour of each turn in the local time', () => {
    const range = resolveRange({ preset: '7d' }, at('2026-03-05T03:30:00Z'), BOGOTA);
    const series = dailySeries([done('a', 1, 1), ticket({ id: 'b', createdAt: at('2026-03-05T03:00:00Z') })], range, BOGOTA);
    assert.equal(series.length, 7);
    assert.deepEqual(series.find((point) => point.day === '2026-03-04'), { day: '2026-03-04', created: 2, completed: 1, cancelled: 0, noShow: 0 });
    assert.equal(series.filter((point) => point.created === 0).length, 6);
    const hours = hourlySeries([done('a', 1, 1)], BOGOTA);
    assert.equal(hours.length, 24);
    assert.equal(hours[10].created, 1, '15:00 UTC is 10:00 in Bogotá');
  });
  it('says how loaded a queue is from its own or inherited limits, and a paused queue is just paused', () => {
    assert.deepEqual([0, 1, 4, 8].map((waiting) => queueState(queue(), DEFAULT_RULES, waiting)), ['empty', 'normal', 'busy', 'full']);
    assert.equal(queueState(queue({ overrides: { prefix: null, urgentMinutes: null, busyLimit: 2, fullLimit: 3 } }), DEFAULT_RULES, 3), 'full');
    assert.equal(queueState(queue({ status: 'paused' }), DEFAULT_RULES, 50), 'paused');
  });
  it('counts the urgent ones with the urgent time of each queue, own or general', () => {
    const now = at('2026-03-04T15:30:00Z');
    const arrivals = [
      { queueId: 'q1', createdAt: at('2026-03-04T15:00:00Z') },
      { queueId: 'q1', createdAt: at('2026-03-04T15:25:00Z') },
      { queueId: 'q2', createdAt: at('2026-03-04T15:00:00Z') },
    ];
    const queues = [queue(), queue({ id: 'q2', name: 'Citas', overrides: { prefix: null, urgentMinutes: 60, busyLimit: null, fullLimit: null } })];
    const counts = new Map([['q1', { waiting: 2, attending: 0, oldestWaitingAt: at('2026-03-04T15:00:00Z') }]]);
    const board = buildQueueBoard(queues, DEFAULT_RULES, counts, arrivals, now);
    assert.deepEqual(board.map((entry) => [entry.queue.id, entry.waiting, entry.urgent, entry.longestWaitMinutes]), [['q1', 2, 1, 30], ['q2', 0, 0, null]]);
  });
  it('adds up the team from the turns each one called, keeps removed people who worked, and shows who is attending now', () => {
    const operators: Operator[] = [
      { id: 'o1', name: 'Laura', email: 'l@x.co', phone: null, queueIds: ['q1'], views: ['home'], status: 'active', activatedAt: null, createdAt: at('2026-01-01T00:00:00Z') },
      { id: 'o2', name: 'Mateo', email: 'm@x.co', phone: null, queueIds: ['q1'], views: ['home'], status: 'inactive', activatedAt: null, createdAt: at('2026-01-01T00:00:00Z') },
    ];
    const attending = ticket({ id: 'x', status: 'attending', calledAt: at('2026-03-04T15:40:00Z'), attendedBy: { operatorId: 'o1', name: 'Laura' }, code: 'C-009' });
    const team = teamPerformance([done('a', 1, 10, 'o1'), done('b', 1, 20, 'o1'), done('c', 1, 5, 'gone'), attending], operators, [attending]);
    const byId = Object.fromEntries(team.map((member) => [member.operatorId, member]));
    assert.deepEqual([byId.o1.attended, byId.o1.completed, byId.o1.averageServiceMinutes, byId.o1.current?.code], [3, 2, 15, 'C-009']);
    assert.deepEqual([byId.o2.attended, byId.o2.averageServiceMinutes, byId.o2.status], [0, null, 'inactive']);
    assert.deepEqual([byId.gone.attended, byId.gone.completed], [1, 1], 'a person who was removed but worked still adds up');
  });
});
describe('numbers and the report', () => {
  it('writes the code with the prefix and at least three digits', () => {
    assert.deepEqual([ticketCode('C', 1), ticketCode('', 7), ticketCode('AB', 1234)], ['C-001', '007', 'AB-1234']);
  });
  it('quotes what needs it, and what a spreadsheet would run as a formula gets a leading apostrophe', () => {
    assert.equal(csvCell('simple'), 'simple');
    assert.equal(csvCell('a, b'), '"a, b"');
    assert.equal(csvCell('dice "hola"'), '"dice ""hola"""');
    assert.equal(csvCell('línea\nsiguiente'), '"línea\nsiguiente"');
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    for (const dangerous of ['+1', '-2', '@x', '=1']) assert.ok(csvCell(dangerous).startsWith("'"), dangerous);
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(5), '5');
  });
  it('writes a header and a row per turn with the real times and the answers', () => {
    const csv = buildCsv([
      ticket({ id: 'a', status: 'completed', customer: { name: 'Ana, "la jefa"', phone: null, email: null }, calledAt: at('2026-03-04T15:04:00Z'), finishedAt: at('2026-03-04T15:14:00Z'), attendedBy: { operatorId: 'o1', name: 'Laura' }, answers: [{ fieldId: 'f', label: 'Motivo', type: 'text', value: 'Pago' }] }),
    ]);
    const [header, row, end] = csv.split('\r\n');
    assert.ok(header.startsWith('code,queue,status,day,created_at'));
    assert.equal(end, '');
    assert.ok(row.startsWith('C-001,Caja,completed,2026-03-04,2026-03-04T15:00:00.000Z,2026-03-04T15:04:00.000Z,2026-03-04T15:14:00.000Z,4,10,Laura,"Ana, ""la jefa"""'));
    assert.ok(row.endsWith('Motivo: Pago'));
  });
});
