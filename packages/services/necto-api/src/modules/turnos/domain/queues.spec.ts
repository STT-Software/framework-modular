import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Queue } from './configuration';
import { TurnosInvalidError } from './errors';
import { parseQueue, type QueueInput } from './queues';
import { DEFAULT_RULES } from './rules';

const base: QueueInput = { name: 'Consulta general', mode: 'auto', averageMinutes: 14 };
const existing = (name: string): Queue => ({ id: name, name, color: 'blue', mode: 'auto', averageMinutes: 5, source: 'custom', overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null } });
const parse = (input: Partial<QueueInput> & Record<string, unknown>, others: Queue[] = [], rules = DEFAULT_RULES) =>
  parseQueue({ ...base, ...input } as QueueInput, { rules, others, defaultColor: 'purple' });
function fieldsOf(input: Partial<QueueInput> & Record<string, unknown>, others: Queue[] = [], rules = DEFAULT_RULES): Record<string, string[]> {
  try {
    parse(input, others, rules);
  } catch (error) {
    if (error instanceof TurnosInvalidError) return error.fields;
    throw error;
  }
  return {};
}

describe('queue validation', () => {
  it('accepts a queue and fills what was left out: the color, and no own values', () => {
    assert.deepEqual(parse({}), {
      name: 'Consulta general',
      color: 'purple',
      mode: 'auto',
      averageMinutes: 14,
      overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null },
    });
  });

  it('requires a name of 2 to 60 characters, trimmed, and not repeated in the business (ignoring case)', () => {
    assert.equal(parse({ name: '  Caja  ' }).name, 'Caja');
    for (const bad of ['', ' ', 'A', 'x'.repeat(61), 7 as never]) assert.ok(fieldsOf({ name: bad }).name, String(bad));
    assert.ok(fieldsOf({ name: 'caja' }, [existing('CAJA')]).name);
    assert.deepEqual(fieldsOf({ name: 'Caja 2' }, [existing('Caja')]), {});
  });

  it('accepts only the known modes and colors and a whole average between 1 and 1440', () => {
    assert.ok(fieldsOf({ mode: 'robot' }).mode);
    assert.ok(fieldsOf({ color: 'black' }).color);
    assert.equal(parse({ color: 'green', mode: 'manual' }).color, 'green');
    for (const bad of [0, 1441, 1.5, '15' as never, null as never]) assert.ok(fieldsOf({ averageMinutes: bad }).averageMinutes, String(bad));
    assert.deepEqual(fieldsOf({ averageMinutes: 1 }), {});
    assert.deepEqual(fieldsOf({ averageMinutes: 1440 }), {});
  });

  it('normalizes the own prefix and treats blank as "use the general one"', () => {
    assert.equal(parse({ overrides: { prefix: ' ñ1 ' } }).overrides.prefix, 'N1');
    assert.equal(parse({ overrides: { prefix: '   ' } }).overrides.prefix, null);
    assert.equal(parse({ overrides: { prefix: null } }).overrides.prefix, null);
    for (const bad of ['ABCDEF', 'A-1', '¿?']) assert.ok(fieldsOf({ overrides: { prefix: bad } })['overrides.prefix'], bad);
  });

  it('validates each own number on its own, with its own range', () => {
    assert.ok(fieldsOf({ overrides: { urgentMinutes: 0 } })['overrides.urgentMinutes']);
    assert.ok(fieldsOf({ overrides: { busyLimit: 10000 } })['overrides.busyLimit']);
    assert.ok(fieldsOf({ overrides: { fullLimit: 10001 } })['overrides.fullLimit']);
    assert.ok(fieldsOf({ overrides: { urgentMinutes: 1.5 } })['overrides.urgentMinutes']);
    assert.ok(fieldsOf({ overrides: { busyLimit: '3' as never } })['overrides.busyLimit']);
    assert.deepEqual(fieldsOf({ overrides: { urgentMinutes: 1, busyLimit: 1, fullLimit: 2 } }), {});
  });
});

describe('queue limits mixing general and own values (full must be above busy)', () => {
  // The general rules are busy 4 / full 8.
  it('accepts own values that keep full above busy, alone or together', () => {
    assert.deepEqual(fieldsOf({ overrides: { busyLimit: 7 } }), {}, 'own busy 7 with general full 8');
    assert.deepEqual(fieldsOf({ overrides: { fullLimit: 5 } }), {}, 'own full 5 with general busy 4');
    assert.deepEqual(fieldsOf({ overrides: { busyLimit: 20, fullLimit: 30 } }), {}, 'both own, apart from the general ones');
  });

  it('rejects an own busy limit that reaches the INHERITED full limit', () => {
    assert.ok(fieldsOf({ overrides: { busyLimit: 8 } })['overrides.fullLimit']);
    assert.ok(fieldsOf({ overrides: { busyLimit: 12 } })['overrides.fullLimit']);
  });

  it('rejects an own full limit that does not exceed the INHERITED busy limit', () => {
    assert.ok(fieldsOf({ overrides: { fullLimit: 4 } })['overrides.fullLimit']);
    assert.ok(fieldsOf({ overrides: { fullLimit: 1 } })['overrides.fullLimit']);
  });

  it('rejects two own values where full is not above busy, and uses the rules it is given', () => {
    assert.ok(fieldsOf({ overrides: { busyLimit: 6, fullLimit: 6 } })['overrides.fullLimit']);
    assert.deepEqual(fieldsOf({ overrides: { busyLimit: 9 } }, [], { ...DEFAULT_RULES, fullLimit: 20 }), {}, 'the same busy value is fine when the general full is higher');
  });
});
