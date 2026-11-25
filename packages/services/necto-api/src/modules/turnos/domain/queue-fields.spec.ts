import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { QueueField } from './configuration';
import { Issues } from './issues';
import { parseFields, validateAnswers } from './queue-fields';
const ids = (() => {
  let next = 0;
  return () => `generated-${++next}`;
})();
const parse = (input: unknown) => {
  const issues = new Issues();
  const fields = parseFields(input, issues, ids);
  return { fields, issues: issues.fields };
};
const field = (extra: Partial<QueueField> & Pick<QueueField, 'type'>): QueueField => ({ id: extra.id ?? 'f1', label: extra.label ?? 'Documento', required: extra.required ?? false, options: extra.options ?? [], type: extra.type });
const answer = (fields: QueueField[], given: unknown) => {
  const issues = new Issues();
  const answers = validateAnswers(fields, given, issues);
  return { answers, issues: issues.fields };
};
describe('the extra fields of a queue', () => {
  it('keeps the id of a field that has one, gives one to a new field and trims the label', () => {
    const { fields, issues } = parse([{ id: 'doc', label: '  Documento ', type: 'text', required: true }, { label: 'Motivo', type: 'select', options: ['Pago', 'Consulta'] }]);
    assert.deepEqual(issues, {});
    assert.deepEqual(fields.map((item) => [item.id, item.label, item.type, item.required, item.options]), [
      ['doc', 'Documento', 'text', true, []],
      ['generated-1', 'Motivo', 'select', false, ['Pago', 'Consulta']],
    ]);
  });
  it('reports every problem by field: type, label, repeated labels and ids, options', () => {
    const { issues } = parse([
      { label: 'a', type: 'text' },
      { label: 'Edad', type: 'age' },
      { label: 'Edad', type: 'number' },
      { label: 'Tipo', type: 'select', options: ['Solo una'] },
      { label: 'Otro', type: 'text', options: ['x', 'y'] },
      { id: 'dup', label: 'Uno', type: 'text' },
      { id: 'dup', label: 'Dos', type: 'text' },
      { id: 'bad id!', label: 'Tres', type: 'text' },
      { label: 'Lista', type: 'select', options: ['A', 'a'] },
    ]);
    assert.ok(issues['fields.0.label']);
    assert.ok(issues['fields.1.type']);
    assert.ok(issues['fields.2.label'], 'two fields with the same label');
    assert.ok(issues['fields.3.options']);
    assert.ok(issues['fields.4.options'], 'only a list has options');
    assert.ok(issues['fields.6.id']);
    assert.ok(issues['fields.7.id']);
    assert.ok(issues['fields.8.options'], 'options cannot repeat, whatever the case');
  });
  it('accepts at most ten fields and refuses what is not a list', () => {
    assert.ok(parse(Array.from({ length: 11 }, (_, index) => ({ label: `Campo ${index}`, type: 'text' }))).issues.fields);
    assert.ok(parse('nope').issues.fields);
  });
});
describe('the answers to the extra fields', () => {
  it('requires the required fields and leaves the empty optional ones out', () => {
    const fields = [field({ id: 'a', label: 'Documento', type: 'text', required: true }), field({ id: 'b', label: 'Nota', type: 'text' })];
    assert.deepEqual(answer(fields, {}).issues, { 'answers.a': ['Documento is required'] });
    assert.deepEqual(answer(fields, { a: '   ' }).issues, { 'answers.a': ['Documento is required'] });
    assert.deepEqual(answer(fields, { a: ' 123 ', b: '' }).answers, [{ fieldId: 'a', label: 'Documento', type: 'text', value: '123' }]);
  });
  it('checks the type of each answer', () => {
    const fields = [
      field({ id: 'n', label: 'Edad', type: 'number' }),
      field({ id: 'p', label: 'Celular', type: 'phone' }),
      field({ id: 'e', label: 'Correo', type: 'email' }),
      field({ id: 'd', label: 'Fecha', type: 'date' }),
      field({ id: 's', label: 'Motivo', type: 'select', options: ['Pago', 'Consulta'] }),
      field({ id: 'c', label: 'Acepta', type: 'checkbox' }),
    ];
    const good = answer(fields, { n: '42', p: '+57 300 123 4567', e: ' ANA@X.CO ', d: '2026-02-28', s: 'Pago', c: true });
    assert.deepEqual(good.issues, {});
    assert.deepEqual(good.answers.map((item) => item.value), [42, '+573001234567', 'ana@x.co', '2026-02-28', 'Pago', true]);
    const bad = answer(fields, { n: 'abc', p: '12', e: 'sin-arroba', d: '2026-02-30', s: 'Otro', c: 'yes' });
    assert.deepEqual(Object.keys(bad.issues).sort(), ['answers.c', 'answers.d', 'answers.e', 'answers.n', 'answers.p', 'answers.s']);
  });
  it('a required checkbox must be accepted, and an answer for a field the queue does not have is refused', () => {
    const fields = [field({ id: 'c', label: 'Acepto', type: 'checkbox', required: true })];
    assert.ok(answer(fields, { c: false }).issues['answers.c']);
    assert.ok(answer(fields, {}).issues['answers.c']);
    assert.deepEqual(answer(fields, { c: true }).issues, {});
    assert.ok(answer(fields, { c: true, ghost: 'x' }).issues['answers.ghost']);
  });
  it('refuses answers that are not an object, and accepts no answers for a queue without fields', () => {
    assert.ok(answer([], 'text').issues.answers);
    assert.ok(answer([], ['a']).issues.answers);
    assert.deepEqual(answer([], undefined), { answers: [], issues: {} });
    assert.ok(answer([], { x: 1 }).issues['answers.x']);
  });
});
