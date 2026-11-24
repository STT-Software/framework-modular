import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemberAccessRegistry } from '../../business-access/public';
import { BOSS, BUSINESS_ID, OTHER_BOSS, OTHER_BUSINESS_ID, setupPedidos } from '../fakes.spec';
import { PedidosOperatorAccessSource } from './pedidos-operator-access.source';

describe('PedidosOperatorAccessSource', () => {
  it('registers on module init and reports assignments only for operators with at least one stage', async () => {
    const { service, repository } = setupPedidos();
    const registry = new MemberAccessRegistry();
    const source = new PedidosOperatorAccessSource(repository, registry);
    source.onModuleInit();

    await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Pedidos',
      email: 'laura@cafecentral.co',
      stages: ['confirmation', 'dispatch'],
    });
    await service.createOperator(OTHER_BOSS, OTHER_BUSINESS_ID, {
      name: 'Laura Librería',
      email: 'laura@cafecentral.co',
      stages: ['preparation'],
    });

    const assignments = await registry.assignmentsOf('laura@cafecentral.co');
    assert.deepEqual(assignments, [
      { businessId: BUSINESS_ID, moduleId: 'pedidos', role: 'operator', personName: 'Laura Pedidos' },
      { businessId: OTHER_BUSINESS_ID, moduleId: 'pedidos', role: 'operator', personName: 'Laura Librería' },
    ]);

    // Clearing stages removes the operator from reported assignments immediately.
    repository.items.get(OTHER_BUSINESS_ID)!.operators[0].stages = [];
    assert.deepEqual(await registry.assignmentsOf('laura@cafecentral.co'), [
      { businessId: BUSINESS_ID, moduleId: 'pedidos', role: 'operator', personName: 'Laura Pedidos' },
    ]);
  });
});
