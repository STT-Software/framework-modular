import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OperatorNotFoundError, TurnosBusinessNotFoundError } from '../domain/errors';
import { aBusiness, BOSS, BUSINESS_ID, operatorInput, OTHER_BUSINESS_ID, queueInput, setupTurnos } from '../fakes.spec';

const LAURA = 'laura@x.co';

/** Ana's business with two queues; Laura works only the second one, Mateo both. */
async function withTeam() {
  const setup = setupTurnos();
  const state = await setup.service.get(BUSINESS_ID);
  const [pedidos, recogida] = state.configuration.queues.map((queue) => queue.id);
  await setup.service.createOperator(BUSINESS_ID, operatorInput('Laura Gómez', LAURA, [recogida], { phone: '+573001234567' }));
  await setup.service.createOperator(BUSINESS_ID, operatorInput('Mateo Ríos', 'mateo@x.co', [pedidos, recogida]));
  return { ...setup, pedidos, recogida };
}

describe('what an operator sees', () => {
  it('only their own queues, with what they need to work and nothing administrative', async () => {
    const { operators, recogida } = await withTeam();
    const view = await operators.view(LAURA, BUSINESS_ID);
    assert.deepEqual(view.business, { id: BUSINESS_ID, name: 'Café Central' });
    assert.deepEqual(view.operator.email, LAURA);
    assert.deepEqual(view.queues.map((queue) => queue.id), [recogida]);
    assert.deepEqual(Object.keys(view.queues[0]).sort(), ['averageMinutes', 'color', 'fields', 'id', 'mode', 'name', 'status', 'ticketExample']);
    assert.ok(!('rules' in view) && !('operators' in view), 'no rules, no other operators');
    assert.ok(!('phone' in view.operator), 'not even their own phone: the view is about the work');
  });

  it('a person with several queues sees all of theirs and no one else\'s', async () => {
    const { operators } = await withTeam();
    assert.equal((await operators.view('mateo@x.co', BUSINESS_ID)).queues.length, 2);
  });

  it('is looked up by the email of the session: an email that is not an operator of the business gets not-found', async () => {
    const { operators } = await withTeam();
    await assert.rejects(operators.view(BOSS, BUSINESS_ID), OperatorNotFoundError, 'being the boss does not make you an operator');
    await assert.rejects(operators.view('nobody@x.co', BUSINESS_ID), OperatorNotFoundError);
  });

  it('never shows the queues of another business, even for an email that is an operator there', async () => {
    const { operators, service, directory } = await withTeam();
    directory.set(aBusiness({ id: OTHER_BUSINESS_ID, name: 'Clínica Norte', category: 'health-wellness', boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } }));
    const b = await service.createQueue(OTHER_BUSINESS_ID, queueInput('Solo de B'));
    await service.createOperator(OTHER_BUSINESS_ID, operatorInput('Laura en B', LAURA, [b.created!.id]));
    assert.deepEqual((await operators.view(LAURA, OTHER_BUSINESS_ID)).queues.map((queue) => queue.name), ['Solo de B']);
    assert.ok((await operators.view(LAURA, BUSINESS_ID)).queues.every((queue) => queue.name !== 'Solo de B'));
  });

  it('stops answering when the assignment is removed, and keeps the other operators', async () => {
    const { operators, service } = await withTeam();
    const laura = (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === LAURA)!;
    await service.deleteOperator(BUSINESS_ID, laura.id);
    await assert.rejects(operators.view(LAURA, BUSINESS_ID), OperatorNotFoundError);
    assert.equal((await operators.view('mateo@x.co', BUSINESS_ID)).operator.name, 'Mateo Ríos');
  });

  it('follows a reassignment: after their queue is deleted the operator sees the queue they were moved to', async () => {
    const { operators, service, pedidos, recogida } = await withTeam();
    const laura = (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === LAURA)!;
    await service.deleteQueue(BUSINESS_ID, recogida, [{ operatorId: laura.id, queueId: pedidos }]);
    assert.deepEqual((await operators.view(LAURA, BUSINESS_ID)).queues.map((queue) => queue.id), [pedidos]);
  });

  it('answers not-found when the business is paused or unknown', async () => {
    const { operators, directory } = await withTeam();
    directory.set(aBusiness({ status: 'paused' }));
    await assert.rejects(operators.view(LAURA, BUSINESS_ID), TurnosBusinessNotFoundError);
    await assert.rejects(operators.view(LAURA, 'f'.repeat(24)), TurnosBusinessNotFoundError);
  });
});

describe('the assignments Turnos reports to the shared sign-in', () => {
  it('reports every business where the email is an operator, with the name they are known by there', async () => {
    const { source, service, directory } = await withTeam();
    directory.set(aBusiness({ id: OTHER_BUSINESS_ID, name: 'Clínica Norte', category: 'health-wellness', boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } }));
    const b = await service.createQueue(OTHER_BUSINESS_ID, queueInput('Solo de B'));
    await service.createOperator(OTHER_BUSINESS_ID, operatorInput('Laura en B', LAURA, [b.created!.id]));
    const assignments = await source.assignmentsOf(LAURA);
    assert.deepEqual(
      assignments.map((item) => [item.businessId, item.moduleId, item.role, item.personName]).sort(),
      [[BUSINESS_ID, 'turnos', 'operator', 'Laura Gómez'], [OTHER_BUSINESS_ID, 'turnos', 'operator', 'Laura en B']].sort(),
    );
  });

  it('reports nothing for an email that is not an operator, and nothing for a boss who is not one', async () => {
    const { source } = await withTeam();
    assert.deepEqual(await source.assignmentsOf('nobody@x.co'), []);
    assert.deepEqual(await source.assignmentsOf(BOSS), []);
  });

  it('stops reporting a person as soon as the assignment is removed', async () => {
    const { source, service } = await withTeam();
    assert.equal((await source.assignmentsOf(LAURA)).length, 1);
    const laura = (await service.get(BUSINESS_ID)).configuration.operators.find((item) => item.email === LAURA)!;
    await service.deleteOperator(BUSINESS_ID, laura.id);
    assert.deepEqual(await source.assignmentsOf(LAURA), []);
  });

  it('does not count an operator whose queues no longer exist (it never happens through the service, but it is checked)', async () => {
    const { source, repository } = await withTeam();
    const stored = repository.items.get(BUSINESS_ID)!;
    stored.operators[0].queueIds = ['ghost'];
    assert.deepEqual(await source.assignmentsOf(LAURA), []);
  });
});
