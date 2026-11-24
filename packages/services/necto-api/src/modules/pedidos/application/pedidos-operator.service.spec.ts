import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PedidosBusinessNotFoundError, PedidosOperatorNotFoundError } from '../domain/errors';
import { BOSS, BUSINESS_ID, aBusiness, setupPedidos } from '../fakes.spec';

describe('PedidosOperatorService', () => {
  it('returns only the operator-scoped payload and isolates sibling operators', async () => {
    const { service, operators, scheduleReader } = setupPedidos();
    scheduleReader.inherit = false;
    scheduleReader.openNow = true;

    await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Gómez',
      email: 'laura@cafecentral.co',
      phone: '+57 300 111 2233',
      stages: ['confirmation', 'dispatch'],
    });
    await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Mateo Ruiz',
      email: 'mateo@cafecentral.co',
      stages: ['preparation'],
    });

    const view = await operators.view('  LAURA@cafecentral.co ', BUSINESS_ID);
    assert.deepEqual(Object.keys(view).sort(), ['business', 'confirmationMode', 'modalities', 'operator', 'schedule']);
    assert.deepEqual(view.business, { id: BUSINESS_ID, name: 'Café Central' });
    assert.equal(view.operator.name, 'Laura Gómez');
    assert.equal(view.operator.email, 'laura@cafecentral.co');
    assert.equal(view.operator.phone, '+57 300 111 2233');
    assert.deepEqual(view.operator.stages, ['confirmation', 'dispatch']);
    assert.deepEqual(view.schedule, { timezone: 'America/Bogota', inherit: false, openNow: true });
    assert.deepEqual(view.modalities, ['delivery', 'pickup', 'on_site']);
    assert.equal(view.confirmationMode, 'manual');
    assert.ok(!JSON.stringify(view).includes('mateo@cafecentral.co'));
  });

  it('throws not-found for unknown/paused/disabled business or unassigned operator', async () => {
    const { service, operators, directory, repository } = setupPedidos();
    await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Gómez',
      email: 'laura@cafecentral.co',
      stages: ['confirmation'],
    });

    await assert.rejects(operators.view('nobody@cafecentral.co', BUSINESS_ID), PedidosOperatorNotFoundError);
    await assert.rejects(operators.view('laura@cafecentral.co', 'f'.repeat(24)), PedidosBusinessNotFoundError);

    // Operator with empty stages is rejected.
    repository.items.get(BUSINESS_ID)!.operators[0].stages = [];
    await assert.rejects(operators.view('laura@cafecentral.co', BUSINESS_ID), PedidosOperatorNotFoundError);
    repository.items.get(BUSINESS_ID)!.operators[0].stages = ['confirmation'];

    // Paused business or disabled module -> 404.
    directory.set(aBusiness({ status: 'paused' }));
    await assert.rejects(operators.view('laura@cafecentral.co', BUSINESS_ID), PedidosBusinessNotFoundError);

    directory.set(aBusiness({ status: 'active', modules: ['turnos'] }));
    await assert.rejects(operators.view('laura@cafecentral.co', BUSINESS_ID), PedidosBusinessNotFoundError);
  });
});
