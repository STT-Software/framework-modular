import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Queue } from './configuration';
import { TurnosInvalidError } from './errors';
import { DEFAULT_RULES, effectiveOf, initialOf, normalizePrefix, parseRules, queuesWithCrossedLimits, ticketExample, type RulesInput } from './rules';

const valid: RulesInput = { prefixMode: 'initial', dailyReset: true, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 };
const queue = (name: string, overrides: Partial<Queue['overrides']> = {}): Queue => ({
  id: name,
  name,
  color: 'orange',
  mode: 'auto',
  averageMinutes: 10,
  source: 'custom',
  overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null, ...overrides },
});
function fieldsOf(input: Partial<RulesInput>): Record<string, string[]> {
  try {
    parseRules({ ...valid, ...input } as RulesInput);
  } catch (error) {
    if (error instanceof TurnosInvalidError) return error.fields;
    throw error;
  }
  return {};
}

describe('general rules: validation', () => {
  it('accepts the defaults and each prefix mode', () => {
    assert.deepEqual(parseRules({ ...valid }), { ...DEFAULT_RULES });
    assert.equal(parseRules({ ...valid, prefixMode: 'none' }).fixedPrefix, null);
    assert.equal(parseRules({ ...valid, prefixMode: 'fixed', fixedPrefix: ' tú ' }).fixedPrefix, 'TU');
  });

  it('requires a prefix of 1 to 5 letters or digits only with the fixed mode, and ignores it with the others', () => {
    for (const bad of [undefined, null, '', '   ', 'ABCDEF', 'A-1', 'a b', '¿?']) {
      assert.ok(fieldsOf({ prefixMode: 'fixed', fixedPrefix: bad as never }).fixedPrefix, String(bad));
    }
    assert.equal(parseRules({ ...valid, prefixMode: 'initial', fixedPrefix: 'garbage!!' }).fixedPrefix, null);
  });

  it('rejects an unknown prefix mode, a non-boolean reset and numbers out of range or not whole', () => {
    assert.ok(fieldsOf({ prefixMode: 'sometimes' }).prefixMode);
    assert.ok(fieldsOf({ dailyReset: 'yes' as never }).dailyReset);
    for (const bad of [0, 1441, 1.5, '10' as never, NaN, null as never]) assert.ok(fieldsOf({ urgentMinutes: bad }).urgentMinutes, String(bad));
    for (const bad of [0, 10000, 2.5]) assert.ok(fieldsOf({ busyLimit: bad }).busyLimit, String(bad));
    for (const bad of [1, 10001]) assert.ok(fieldsOf({ fullLimit: bad }).fullLimit, String(bad));
    assert.deepEqual(fieldsOf({ urgentMinutes: 1, busyLimit: 1, fullLimit: 2 }), {});
    assert.deepEqual(fieldsOf({ urgentMinutes: 1440, busyLimit: 9999, fullLimit: 10000 }), {});
  });

  it('requires the full limit to be greater than the busy limit, equal is not enough', () => {
    assert.ok(fieldsOf({ busyLimit: 5, fullLimit: 5 }).fullLimit);
    assert.ok(fieldsOf({ busyLimit: 9, fullLimit: 8 }).fullLimit);
    assert.deepEqual(fieldsOf({ busyLimit: 5, fullLimit: 6 }), {});
  });

  it('reports every problem at once', () => {
    assert.deepEqual(Object.keys(fieldsOf({ prefixMode: 'x', urgentMinutes: 0, busyLimit: 0, fullLimit: 1 })).sort(), ['busyLimit', 'fullLimit', 'prefixMode', 'urgentMinutes']);
  });
});

describe('prefixes and ticket numbers', () => {
  it('normalizes to uppercase without accents', () => {
    assert.equal(normalizePrefix('  ñandú-1 '), 'NANDU-1');
    assert.equal(initialOf('¿Qué tal?'), 'Q');
    assert.equal(initialOf('Ñandú'), 'N');
    assert.equal(initialOf('---'), '');
  });

  it('numbers by the initial of the queue, with one prefix for all, or with none', () => {
    const rules = parseRules({ ...valid });
    assert.equal(ticketExample(queue('Consulta general'), rules), 'C-001');
    assert.equal(ticketExample(queue('Consulta general'), { ...rules, prefixMode: 'fixed', fixedPrefix: 'T' }), 'T-001');
    assert.equal(ticketExample(queue('Consulta general'), { ...rules, prefixMode: 'none' }), '001');
  });
});

describe('inheritance: a value that is not customized uses the general one, field by field', () => {
  const rules = parseRules({ ...valid, prefixMode: 'fixed', fixedPrefix: 'T', urgentMinutes: 12, busyLimit: 4, fullLimit: 8 });

  it('a queue without own values uses every general value', () => {
    assert.deepEqual(effectiveOf(queue('Caja'), rules), { prefix: 'T', urgentMinutes: 12, busyLimit: 4, fullLimit: 8 });
  });

  it('customizing one value leaves the others inheriting', () => {
    assert.deepEqual(effectiveOf(queue('Caja', { busyLimit: 2 }), rules), { prefix: 'T', urgentMinutes: 12, busyLimit: 2, fullLimit: 8 });
    assert.deepEqual(effectiveOf(queue('Caja', { prefix: 'Z' }), rules), { prefix: 'Z', urgentMinutes: 12, busyLimit: 4, fullLimit: 8 });
  });

  it('changing the general rules changes only what the queue inherits', () => {
    const changed = { ...rules, urgentMinutes: 20, busyLimit: 6, fullLimit: 12, fixedPrefix: 'Q' };
    assert.deepEqual(effectiveOf(queue('Caja', { urgentMinutes: 5 }), changed), { prefix: 'Q', urgentMinutes: 5, busyLimit: 6, fullLimit: 12 });
  });

  it('detects the queues whose own values cross with the general ones, inherited or own', () => {
    const queues = [queue('A', { busyLimit: 9 }), queue('B', { fullLimit: 3 }), queue('C', { busyLimit: 2, fullLimit: 3 }), queue('D')];
    assert.deepEqual(queuesWithCrossedLimits(rules, queues).map((item) => item.name), ['A', 'B']);
  });
});
