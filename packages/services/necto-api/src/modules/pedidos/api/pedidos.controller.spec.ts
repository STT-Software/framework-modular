import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestMethod } from '@nestjs/common';
import { AuthenticationGuard } from '../../../platform/security/authentication.guard';
import { BusinessAdminGuard, BusinessModuleGuard, OperatorModuleGuard } from '../../business-access/api/business-admin.guards';
import { BOSS, BUSINESS_ID, setupPedidos } from '../fakes.spec';
import { PedidosOperatorController } from './pedidos-operator.controller';
import { PedidosController } from './pedidos.controller';
import { toPedidosOperatorResponse, toPedidosResponse } from './pedidos.response';

const guardsOf = (target: object): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];
const pathOf = (target: object): string => Reflect.getMetadata('path', target);
const methodOf = (target: object): string => RequestMethod[Reflect.getMetadata('method', target)];
const httpCodeOf = (target: object): number | undefined => Reflect.getMetadata('__httpCode__', target);
const routesOf = (controller: { prototype: object }) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = (controller.prototype as Record<string, object>)[name];
      return `${methodOf(handler)} ${pathOf(handler)}`;
    })
    .sort();

describe('Pedidos controller routes and guards', () => {
  it('guards PedidosController with AuthenticationGuard, BusinessAdminGuard, BusinessModuleGuard(pedidos)', () => {
    assert.deepEqual(guardsOf(PedidosController), [AuthenticationGuard, BusinessAdminGuard, BusinessModuleGuard]);
    assert.equal(Reflect.getMetadata('business-access:module', PedidosController), 'pedidos');
    assert.equal(pathOf(PedidosController), 'pedidos/businesses/:businessId');
    assert.equal(httpCodeOf(PedidosController.prototype.complete), 200);
  });

  it('exposes the exact 11 configuration routes', () => {
    assert.deepEqual(routesOf(PedidosController), [
      'DELETE operators/:operatorId',
      'GET /',
      'POST complete',
      'POST operators',
      'PUT fulfillment',
      'PUT modalities',
      'PUT operators/:operatorId',
      'PUT payments',
      'PUT profile',
      'PUT progress',
      'PUT sla',
    ]);
  });

  it('guards PedidosOperatorController with OperatesModule(pedidos) and exposes only read-only GET /', () => {
    assert.deepEqual(guardsOf(PedidosOperatorController), [
      AuthenticationGuard,
      BusinessAdminGuard,
      OperatorModuleGuard,
    ]);
    assert.equal(Reflect.getMetadata('business-access:operator-module', PedidosOperatorController), 'pedidos');
    assert.equal(pathOf(PedidosOperatorController), 'pedidos/businesses/:businessId/operator');
    assert.deepEqual(routesOf(PedidosOperatorController), ['GET /']);
  });
});

describe('Pedidos response serializers', () => {
  it('toPedidosResponse exposes full configuration, schedule, progress.touched and never leaks version or seeded', async () => {
    const { service } = setupPedidos();
    const created = await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Gómez',
      email: 'laura@cafecentral.co',
      phone: '+57 300 111 2233',
      stages: ['confirmation', 'dispatch'],
    });
    const response = toPedidosResponse(created);

    assert.equal(response.business.id, BUSINESS_ID);
    assert.equal(response.business.currency, 'COP');
    assert.equal(response.business.timezone, 'America/Bogota');
    assert.deepEqual(response.profile, { id: 'food', suggested: 'food' });
    assert.equal(response.schedule.timezone, 'America/Bogota');
    assert.equal(response.schedule.inherit, true);
    assert.equal(response.schedule.openNow, true);
    assert.ok(response.schedule.days.mon);
    assert.deepEqual(response.progress, {
      currentStep: null,
      visitedSteps: [],
      ready: false,
      readyAt: null,
      touched: true,
    });
    assert.equal(response.created?.id, response.operators[0].id);
    assert.deepEqual(Object.keys(response.operators[0]).sort(), ['createdAt', 'email', 'id', 'name', 'phone', 'stages']);

    const json = JSON.stringify(response);
    assert.ok(!json.includes('"version"'), 'internal version must not be exposed');
    assert.ok(!json.includes('"seeded"'), 'internal seeded flag must not be exposed');

    const getResponse = toPedidosResponse(await service.get(BOSS, BUSINESS_ID));
    assert.ok(!('created' in getResponse));
  });

  it('toPedidosOperatorResponse exposes only the strictly scoped operator payload', async () => {
    const { service, operators } = setupPedidos();
    await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Gómez',
      email: 'laura@cafecentral.co',
      stages: ['preparation'],
    });
    const response = toPedidosOperatorResponse(await operators.view('laura@cafecentral.co', BUSINESS_ID));
    assert.deepEqual(Object.keys(response).sort(), [
      'business',
      'confirmationMode',
      'modalities',
      'operator',
      'schedule',
    ]);
    assert.deepEqual(Object.keys(response.schedule).sort(), ['inherit', 'openNow', 'timezone']);
    assert.deepEqual(response.operator.stages, ['preparation']);
  });
});
