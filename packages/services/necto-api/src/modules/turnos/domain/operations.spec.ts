import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TurnosConfiguration } from './configuration';
import {
  OnlyQueueWithOperatorsError,
  OperatorNotFoundError,
  QueueNotFoundError,
  ReassignmentRequiredError,
  TurnosIncompleteError,
  TurnosInvalidError,
} from './errors';
import {
  addOperator,
  addQueue,
  changeProfile,
  ensureSeeded,
  markReady,
  newConfiguration,
  readinessProblems,
  recordStep,
  removeOperator,
  removeQueue,
  setRules,
  updateOperator,
  updateQueue,
} from './operations';

const NOW = new Date('2026-03-04T15:00:00Z');
const LATER = new Date('2026-03-04T16:00:00Z');
let counter = 0;
const ids = () => `id-${++counter}`;
const rules = { prefixMode: 'initial', dailyReset: true, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 };

const emptied = () => ({ ...seeded('custom'), queues: [] as ReturnType<typeof seeded>['queues'] });
const seeded = (profile: 'clinic' | 'restaurant' | 'custom' = 'clinic') => ensureSeeded(newConfiguration('b1', NOW), profile, NOW, ids);
const queueNamed = (config: TurnosConfiguration, name: string) => config.queues.find((queue) => queue.name === name)!;
const operator = (name: string, email: string, queueIds: string[]) => ({ name, email, queueIds });
function failure(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('should have thrown');
}

describe('suggested queues and the attention profile', () => {
  it('generates the suggestions of the profile once, with distinct colors, and tags them with their source', () => {
    const config = seeded('clinic');
    assert.deepEqual(config.queues.map((queue) => [queue.name, queue.mode, queue.averageMinutes, queue.source]), [
      ['Consulta general', 'auto', 14, 'clinic'],
      ['Laboratorio', 'manual', 25, 'clinic'],
    ]);
    assert.notEqual(config.queues[0].color, config.queues[1].color);
    assert.equal(config.profile, 'clinic');
    assert.equal(config.touched, false);
    assert.equal(ensureSeeded(config, 'bank', NOW, ids), config, 'a second call changes nothing and generates nothing');
  });

  it('uses the profile already chosen over the suggested one, and the custom profile starts with one general queue', () => {
    const chosen = { ...newConfiguration('b1', NOW), profile: 'salon' as const };
    assert.deepEqual(ensureSeeded(chosen, 'restaurant', NOW, ids).queues.map((queue) => queue.name), ['Corte', 'Color', 'Uñas']);
    assert.deepEqual(seeded('custom').queues.map((queue) => queue.name), ['Atención general']);
  });

  it('replaces untouched suggestions when the profile changes', () => {
    const next = changeProfile(seeded('clinic'), 'bank', false, LATER, ids);
    assert.equal(next.profile, 'bank');
    assert.deepEqual(next.queues.map((queue) => queue.name), ['Caja', 'Asesoría']);
    assert.equal(next.touched, false);
  });

  it('keeps everything the person did when the profile changes, and does not duplicate or add anything unless asked', () => {
    let config = seeded('clinic');
    config = updateQueue(config, queueNamed(config, 'Laboratorio').id, { name: 'Laboratorio clínico', mode: 'manual', averageMinutes: 30 }, NOW);
    config = addQueue(config, { name: 'Vacunación', mode: 'auto', averageMinutes: 5 }, NOW, ids);
    const before = structuredClone(config.queues);
    const next = changeProfile(config, 'bank', false, LATER, ids);
    assert.equal(next.profile, 'bank');
    assert.deepEqual(next.queues, before, 'queues are exactly the same');
    assert.equal(next.rules, config.rules);
  });

  it('adds the new profile suggestions only when asked, skipping names that already exist (no duplicates)', () => {
    let config = seeded('restaurant');
    config = addQueue(config, { name: 'caja', mode: 'auto', averageMinutes: 5 }, NOW, ids);
    const next = changeProfile(config, 'bank', true, LATER, ids);
    assert.deepEqual(next.queues.map((queue) => queue.name), ['Pedidos en caja', 'Recogida de pedidos', 'caja', 'Asesoría'], '«Caja» already existed as «caja»');
    assert.equal(next.queues.filter((queue) => queue.source === 'bank').length, 1);
    const again = changeProfile(next, 'bank', true, LATER, ids);
    assert.deepEqual(again.queues.map((queue) => queue.name), next.queues.map((queue) => queue.name), 'asking again adds nothing');
  });

  it('keeps operators and their queues when the profile changes', () => {
    let config = seeded('clinic');
    config = addOperator(config, operator('Laura', 'laura@x.co', [config.queues[0].id]), NOW, ids);
    const next = changeProfile(config, 'salon', true, LATER, ids);
    assert.deepEqual(next.operators, config.operators);
    assert.ok(next.queues.some((queue) => queue.name === 'Corte'));
  });

  it('does nothing when the profile is the same, and refuses an unknown one', () => {
    const config = seeded('clinic');
    assert.equal(changeProfile(config, 'clinic', false, LATER, ids), config);
    assert.ok(failure(() => changeProfile(config, 'spaceship', false, LATER, ids)) instanceof TurnosInvalidError);
  });

  it('only stores the profile when the suggestions were not generated yet', () => {
    const next = changeProfile(newConfiguration('b1', NOW), 'bank', false, LATER, ids);
    assert.equal(next.profile, 'bank');
    assert.equal(next.seeded, false);
    assert.deepEqual(next.queues, []);
  });

  it('clears "ready" when the profile replaces or adds queues', () => {
    let config = markReady(seeded('clinic'), NOW);
    assert.ok(config.readyAt);
    assert.equal(changeProfile(config, 'bank', false, LATER, ids).readyAt, null);
    config = markReady(addQueue(config, { name: 'Extra', mode: 'auto', averageMinutes: 5 }, NOW, ids), NOW);
    assert.equal(changeProfile(config, 'bank', true, LATER, ids).readyAt, null);
  });
});

describe('queues', () => {
  it('creates, edits and keeps the source of a suggested queue when it is edited', () => {
    let config = seeded('clinic');
    const lab = queueNamed(config, 'Laboratorio');
    config = updateQueue(config, lab.id, { name: 'Lab', mode: 'auto', averageMinutes: 20, color: 'pink', overrides: { busyLimit: 3 } }, LATER);
    const edited = config.queues.find((queue) => queue.id === lab.id)!;
    assert.deepEqual([edited.name, edited.mode, edited.color, edited.source, edited.overrides.busyLimit], ['Lab', 'auto', 'pink', 'clinic', 3]);
    assert.equal(config.touched, true);
    config = addQueue(config, { name: 'Nueva', mode: 'manual', averageMinutes: 9 }, LATER, ids);
    assert.equal(config.queues.at(-1)!.source, 'custom');
  });

  it('going back to the general value is just leaving the own value empty', () => {
    let config = addQueue(emptied(), { name: 'Caja', mode: 'auto', averageMinutes: 5, overrides: { prefix: 'Z', urgentMinutes: 3 } }, NOW, ids);
    config = updateQueue(config, config.queues[0].id, { name: 'Caja', mode: 'auto', averageMinutes: 5, overrides: { urgentMinutes: 3 } }, NOW);
    assert.deepEqual(config.queues[0].overrides, { prefix: null, urgentMinutes: 3, busyLimit: null, fullLimit: null });
  });

  it('refuses a duplicate name, an unknown queue and more queues than the limit', () => {
    const config = seeded('clinic');
    assert.ok(failure(() => addQueue(config, { name: 'laboratorio', mode: 'auto', averageMinutes: 5 }, NOW, ids)) instanceof TurnosInvalidError);
    assert.ok(failure(() => updateQueue(config, 'nope', { name: 'X1', mode: 'auto', averageMinutes: 5 }, NOW)) instanceof QueueNotFoundError);
    assert.ok(failure(() => updateQueue(config, config.queues[0].id, { name: 'laboratorio', mode: 'auto', averageMinutes: 5 }, NOW)) instanceof TurnosInvalidError);
    let full = emptied();
    for (let i = 0; i < 30; i++) full = addQueue(full, { name: `Fila ${i}`, mode: 'auto', averageMinutes: 5 }, NOW, ids);
    assert.ok(failure(() => addQueue(full, { name: 'Una más', mode: 'auto', averageMinutes: 5 }, NOW, ids)) instanceof TurnosInvalidError);
  });

  it('lets a queue keep its own name when edited (it does not collide with itself)', () => {
    const config = seeded('clinic');
    const next = updateQueue(config, config.queues[0].id, { name: 'Consulta general', mode: 'manual', averageMinutes: 14 }, NOW);
    assert.equal(next.queues[0].mode, 'manual');
  });
});

describe('general rules and inheritance', () => {
  it('saves the rules and every queue inherits them except for what it sets itself', () => {
    let config = seeded('clinic');
    config = updateQueue(config, config.queues[1].id, { name: 'Laboratorio', mode: 'manual', averageMinutes: 25, overrides: { busyLimit: 2 } }, NOW);
    config = setRules(config, { ...rules, busyLimit: 6, fullLimit: 12 }, LATER);
    assert.deepEqual([config.rules.busyLimit, config.rules.fullLimit], [6, 12]);
    assert.equal(config.queues[1].overrides.busyLimit, 2, 'the own value survives a change of the general one');
    assert.equal(config.touched, true);
  });

  it('refuses general limits that cross with the own value of a queue, naming it, and keeps the previous rules', () => {
    let config = seeded('clinic');
    config = updateQueue(config, config.queues[0].id, { name: 'Consulta general', mode: 'auto', averageMinutes: 14, overrides: { busyLimit: 6 } }, NOW);
    const error = failure(() => setRules(config, { ...rules, busyLimit: 4, fullLimit: 6 }, LATER));
    assert.ok(error instanceof TurnosInvalidError);
    assert.match(error.fields.fullLimit[0], /Consulta general/);
    assert.deepEqual(config.rules.fullLimit, 8);
  });

  it('refuses full not above busy even when nothing is inherited from a queue', () => {
    const error = failure(() => setRules(emptied(), { ...rules, busyLimit: 8, fullLimit: 8 }, NOW));
    assert.ok(error instanceof TurnosInvalidError && error.fields.fullLimit);
  });

  it('a change to the rules is a change: clears "ready"', () => {
    const ready = markReady(seeded('clinic'), NOW);
    assert.equal(setRules(ready, { ...rules, urgentMinutes: 15 }, LATER).readyAt, null);
  });
});

describe('operators', () => {
  const base = () => {
    const config = seeded('clinic');
    return { config, general: config.queues[0].id, lab: config.queues[1].id };
  };

  it('needs a name, an email and at least one queue; the phone is optional and is normalized', () => {
    const { config, general } = base();
    const next = addOperator(config, { name: ' Laura Gómez ', email: 'laura@x.co', phone: '+57 (300) 123-4567', queueIds: [general] }, NOW, ids);
    assert.deepEqual([next.operators[0].name, next.operators[0].phone], ['Laura Gómez', '+573001234567']);
    assert.equal(addOperator(config, operator('Mateo', 'mateo@x.co', [general]), NOW, ids).operators[0].phone, null);
    for (const bad of [{ name: 'L', email: 'laura@x.co', queueIds: [general] }, { name: 'Laura', email: '', queueIds: [general] }, { name: 'Laura', email: 'no-email', queueIds: [general] }, { name: 'Laura', email: 'laura@x.co', queueIds: [] }, { name: 'Laura', email: 'laura@x.co', phone: '123', queueIds: [general] }]) {
      assert.ok(failure(() => addOperator(config, bad as never, NOW, ids)) instanceof TurnosInvalidError, JSON.stringify(bad));
    }
  });

  it('refuses an email already used by another operator of the business, but not by itself when edited', () => {
    const { config, general, lab } = base();
    const withLaura = addOperator(config, operator('Laura', 'laura@x.co', [general]), NOW, ids);
    assert.ok(failure(() => addOperator(withLaura, operator('Otra', 'laura@x.co', [lab]), NOW, ids)) instanceof TurnosInvalidError);
    const edited = updateOperator(withLaura, withLaura.operators[0].id, operator('Laura G', 'laura@x.co', [general, lab]), NOW);
    assert.deepEqual(edited.operators[0].queueIds, [general, lab]);
  });

  it('only accepts queues that exist in THIS configuration, never ids of another business', () => {
    const { config } = base();
    const otherBusiness = ensureSeeded(newConfiguration('b2', NOW), 'bank', NOW, ids);
    const error = failure(() => addOperator(config, operator('Laura', 'laura@x.co', [otherBusiness.queues[0].id]), NOW, ids));
    assert.ok(error instanceof TurnosInvalidError && error.fields.queueIds);
    assert.ok(failure(() => addOperator(config, operator('Laura', 'laura@x.co', ['ghost']), NOW, ids)) instanceof TurnosInvalidError);
  });

  it('cannot add an operator while there are no queues', () => {
    assert.ok(failure(() => addOperator(emptied(), operator('Laura', 'laura@x.co', ['x']), NOW, ids)) instanceof TurnosInvalidError);
  });

  it('cannot leave an operator without queues by editing it, and removes only the assignment when deleted', () => {
    const { config, general } = base();
    const withLaura = addOperator(config, operator('Laura', 'laura@x.co', [general]), NOW, ids);
    assert.ok(failure(() => updateOperator(withLaura, withLaura.operators[0].id, operator('Laura', 'laura@x.co', []), NOW)) instanceof TurnosInvalidError);
    const removed = removeOperator(withLaura, withLaura.operators[0].id, LATER);
    assert.deepEqual(removed.operators, []);
    assert.deepEqual(removed.queues, withLaura.queues, 'queues are untouched');
    assert.ok(failure(() => removeOperator(removed, 'nope', LATER)) instanceof OperatorNotFoundError);
  });

  it('works without operators: they are optional', () => {
    assert.equal(markReady(base().config, NOW).operators.length, 0);
  });
});

describe('deleting a queue with reassignment', () => {
  function team() {
    let config = seeded('clinic');
    const [general, lab] = config.queues.map((queue) => queue.id);
    config = addQueue(config, { name: 'Vacunación', mode: 'auto', averageMinutes: 5 }, NOW, ids);
    const vaccine = config.queues[2].id;
    config = addOperator(config, operator('Solo lab', 'lab@x.co', [lab]), NOW, ids);
    config = addOperator(config, operator('Ambas', 'ambas@x.co', [general, lab]), NOW, ids);
    config = addOperator(config, operator('Otra solo lab', 'lab2@x.co', [lab]), NOW, ids);
    config = addOperator(config, operator('General', 'general@x.co', [general]), NOW, ids);
    const [soloLab, ambas, soloLab2, soloGeneral] = config.operators;
    return { config, general, lab, vaccine, soloLab, ambas, soloLab2, soloGeneral };
  }

  it('deletes a queue nobody depends on and removes it from the operators that also had others', () => {
    const { config, lab, general, ambas } = team();
    const next = removeQueue(config, lab, [{ operatorId: config.operators[0].id, queueId: general }, { operatorId: config.operators[2].id, queueId: general }], LATER);
    assert.equal(next.queues.some((queue) => queue.id === lab), false);
    assert.deepEqual(next.operators.find((item) => item.id === ambas.id)!.queueIds, [general], 'lost only the deleted queue');
  });

  it('demands a new queue for every operator who would be left with none, and changes nothing without it', () => {
    const { config, lab, soloLab, soloLab2 } = team();
    const error = failure(() => removeQueue(config, lab, [], LATER));
    assert.ok(error instanceof ReassignmentRequiredError);
    assert.deepEqual(Object.keys(error.fields).sort(), [`reassignments.${soloLab.id}`, `reassignments.${soloLab2.id}`].sort());
    const partial = failure(() => removeQueue(config, lab, [{ operatorId: soloLab.id, queueId: config.queues[0].id }], LATER));
    assert.ok(partial instanceof ReassignmentRequiredError);
    assert.deepEqual(Object.keys((partial as ReassignmentRequiredError).fields), [`reassignments.${soloLab2.id}`]);
  });

  it('moves each operator to the queue chosen for them, in the same result as deleting the queue', () => {
    const { config, lab, general, vaccine, soloLab, soloLab2 } = team();
    const next = removeQueue(config, lab, [{ operatorId: soloLab.id, queueId: vaccine }, { operatorId: soloLab2.id, queueId: general }], LATER);
    assert.deepEqual(next.operators.find((item) => item.id === soloLab.id)!.queueIds, [vaccine]);
    assert.deepEqual(next.operators.find((item) => item.id === soloLab2.id)!.queueIds, [general]);
    assert.ok(next.operators.every((item) => item.queueIds.length > 0), 'nobody is left without a queue');
    assert.ok(next.operators.every((item) => item.queueIds.every((id) => next.queues.some((queue) => queue.id === id))), 'every assignment points to an existing queue');
    assert.equal(config.queues.length, 3, 'the original configuration was not modified');
  });

  it('rejects reassignments to the deleted queue, to a queue that does not exist, for operators that do not need it, or twice', () => {
    const { config, lab, general, soloLab, soloLab2, soloGeneral } = team();
    const good = { operatorId: soloLab2.id, queueId: general };
    for (const bad of [
      { operatorId: soloLab.id, queueId: lab },
      { operatorId: soloLab.id, queueId: 'ghost' },
      { operatorId: soloGeneral.id, queueId: general },
      { operatorId: 'ghost', queueId: general },
    ]) {
      assert.ok(failure(() => removeQueue(config, lab, [bad, good], LATER)) instanceof TurnosInvalidError, JSON.stringify(bad));
    }
    assert.ok(failure(() => removeQueue(config, lab, [{ operatorId: soloLab.id, queueId: general }, { operatorId: soloLab.id, queueId: general }, good], LATER)) instanceof TurnosInvalidError);
  });

  it('refuses to delete the only queue while it has operators, and allows it when nobody depends on it', () => {
    let config = addQueue(emptied(), { name: 'Única', mode: 'auto', averageMinutes: 5 }, NOW, ids);
    const only = config.queues[0].id;
    const free = removeQueue(config, only, [], LATER);
    assert.deepEqual(free.queues, []);
    config = addOperator(config, operator('Laura', 'laura@x.co', [only]), NOW, ids);
    assert.ok(failure(() => removeQueue(config, only, [], LATER)) instanceof OnlyQueueWithOperatorsError);
  });

  it('rejects an unknown queue', () => {
    assert.ok(failure(() => removeQueue(seeded('clinic'), 'ghost', [], LATER)) instanceof QueueNotFoundError);
  });
});

describe('progress and saving as ready', () => {
  it('needs at least one queue and valid rules; operators are optional', () => {
    const empty = emptied();
    const error = failure(() => markReady(empty, NOW));
    assert.ok(error instanceof TurnosIncompleteError && error.fields.queues);
    const ready = markReady(addQueue(empty, { name: 'Caja', mode: 'auto', averageMinutes: 5 }, NOW, ids), NOW);
    assert.deepEqual(ready.operators, []);
    assert.equal(ready.readyAt?.getTime(), NOW.getTime());
  });

  it('refuses to mark as ready a configuration whose rules or queues are no longer valid, saying where', () => {
    const config = seeded('clinic');
    const brokenRules = { ...config, rules: { ...config.rules, fullLimit: 3 } };
    assert.ok((failure(() => markReady(brokenRules, NOW)) as TurnosIncompleteError).fields['rules.fullLimit']);
    const crossed = { ...config, queues: [{ ...config.queues[0], overrides: { ...config.queues[0].overrides, busyLimit: 9 } }, config.queues[1]] };
    assert.ok(Object.keys(readinessProblems(crossed)).some((path) => path.startsWith(`queues.${config.queues[0].id}`)));
    const stranded = { ...config, operators: [{ id: 'o1', name: 'Laura', email: 'l@x.co', phone: null, queueIds: ['ghost'], views: ['home' as const], status: 'active' as const, activatedAt: null, createdAt: NOW }] };
    assert.ok(readinessProblems(stranded)['operators.o1.queueIds']);
  });

  it('keeps the original date when saved again, and any later change clears it', () => {
    const first = markReady(seeded('clinic'), NOW);
    assert.equal(markReady(first, LATER).readyAt?.getTime(), NOW.getTime());
    const edited = addQueue(first, { name: 'Extra', mode: 'auto', averageMinutes: 5 }, LATER, ids);
    assert.equal(edited.readyAt, null);
  });

  it('moving between steps remembers where the person is without clearing "ready"', () => {
    const ready = markReady(seeded('clinic'), NOW);
    const moved = recordStep(ready, 'rules', LATER);
    assert.equal(moved.currentStep, 'rules');
    assert.deepEqual(moved.visitedSteps, ['review', 'rules']);
    assert.ok(moved.readyAt);
    assert.deepEqual(recordStep(moved, 'rules', LATER).visitedSteps, ['review', 'rules'], 'no repeats');
    assert.ok(failure(() => recordStep(ready, 'payments' as never, LATER)) instanceof TurnosInvalidError);
  });
});
