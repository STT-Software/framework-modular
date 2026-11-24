import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ModuleSetupStatusRegistry } from '../../business-setup/public';
import { BOSS, BUSINESS_ID, setupPedidos } from '../fakes.spec';
import { PedidosSetupStatusSource } from './pedidos-setup-status.source';

describe('PedidosSetupStatusSource', () => {
  it('registers in ModuleSetupStatusRegistry and reports live pending/ready status and counts', async () => {
    const { service, repository } = setupPedidos();
    const registry = new ModuleSetupStatusRegistry();
    const source = new PedidosSetupStatusSource(repository, registry);
    source.onModuleInit();

    assert.deepEqual(await registry.statusOf('pedidos', BUSINESS_ID), {
      ready: false,
      summary: { modalityCount: 0, operatorCount: 0 },
    });

    await service.get(BOSS, BUSINESS_ID);
    await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Gómez',
      email: 'laura@cafecentral.co',
      stages: ['confirmation'],
    });
    assert.deepEqual(await registry.statusOf('pedidos', BUSINESS_ID), {
      ready: false,
      summary: { modalityCount: 3, operatorCount: 1 },
    });

    await service.complete(BOSS, BUSINESS_ID);
    assert.deepEqual(await registry.statusOf('pedidos', BUSINESS_ID), {
      ready: true,
      summary: { modalityCount: 3, operatorCount: 1 },
    });

    // Editing after completion returns ready to false.
    await service.updateModalities(BOSS, BUSINESS_ID, ['pickup', 'on_site'], 'counter');
    assert.deepEqual(await registry.statusOf('pedidos', BUSINESS_ID), {
      ready: false,
      summary: { modalityCount: 2, operatorCount: 1 },
    });
  });
});
