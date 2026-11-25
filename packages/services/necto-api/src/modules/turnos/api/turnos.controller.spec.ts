import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestMethod } from '@nestjs/common';
import { AuthenticationGuard } from '../../../platform/security/authentication.guard';
import { BusinessAdminGuard, BusinessModuleGuard, OperatorModuleGuard } from '../../business-access/api/business-admin.guards';
import { BUSINESS_ID, setupTurnos } from '../fakes.spec';
import { TurnosOperatorController } from './turnos-operator.controller';
import { TurnosController } from './turnos.controller';
import { toOperatorResponse, toTurnosResponse } from './turnos.response';

const guardsOf = (target: object): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];
const pathOf = (target: object): string => Reflect.getMetadata('path', target);
const methodOf = (target: object): string => RequestMethod[Reflect.getMetadata('method', target)];
const routesOf = (controller: { prototype: object }) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = (controller.prototype as Record<string, object>)[name];
      return `${methodOf(handler)} ${pathOf(handler)}`;
    })
    .sort();

describe('who may reach each route of Turnos', () => {
  it('the configuration needs the boss of THAT business with Turnos enabled, checked on every request', () => {
    assert.deepEqual(guardsOf(TurnosController), [AuthenticationGuard, BusinessAdminGuard, BusinessModuleGuard]);
    assert.equal(Reflect.getMetadata('business-access:module', TurnosController), 'turnos');
    assert.equal(pathOf(TurnosController), 'turnos/businesses/:businessId');
  });

  it('the operator view needs an OPERATOR of that business for the module, which an administrator who is not one does not satisfy', () => {
    assert.deepEqual(guardsOf(TurnosOperatorController), [AuthenticationGuard, BusinessAdminGuard, OperatorModuleGuard]);
    assert.equal(Reflect.getMetadata('business-access:operator-module', TurnosOperatorController), 'turnos');
    assert.equal(pathOf(TurnosOperatorController), 'turnos/businesses/:businessId/operator');
  });

  it('the operator controller offers one read-only route: no administrative operation can be reached with an operator access', () => {
    assert.deepEqual(routesOf(TurnosOperatorController), ['GET /']);
  });

  it('exposes exactly the routes of the configuration', () => {
    assert.deepEqual(routesOf(TurnosController), [
      'DELETE operators/:operatorId',
      'DELETE queues/:queueId',
      'GET /',
      'POST complete',
      'POST operators',
      'POST queues',
      'PUT operators/:operatorId',
      'PUT profile',
      'PUT progress',
      'PUT queues/:queueId',
      'PUT rules',
    ]);
  });
});

describe('what the API shows', () => {
  it('shows each queue with what it really uses, whether its own or inherited, and an example ticket', async () => {
    const { service } = setupTurnos();
    await service.saveRules(BUSINESS_ID, { prefixMode: 'fixed', fixedPrefix: 't', dailyReset: false, urgentMinutes: 12, busyLimit: 4, fullLimit: 8 });
    const state = await service.createQueue(BUSINESS_ID, { name: 'Caja', mode: 'manual', averageMinutes: 9, overrides: { busyLimit: 6 } });
    const response = toTurnosResponse(state);
    const caja = response.queues.find((queue) => queue.name === 'Caja')!;
    assert.deepEqual(caja.overrides, { prefix: null, urgentMinutes: null, busyLimit: 6, fullLimit: null });
    assert.deepEqual(caja.effective, { prefix: 'T', urgentMinutes: 12, busyLimit: 6, fullLimit: 8 });
    assert.equal(caja.ticketExample, 'T-001');
    assert.equal(caja.source, 'custom');
    assert.equal(response.queues[0].source, 'restaurant');
    assert.deepEqual(response.rules, { prefixMode: 'fixed', fixedPrefix: 'T', dailyReset: false, urgentMinutes: 12, busyLimit: 4, fullLimit: 8 });
    assert.equal(response.created?.id, caja.id);
  });

  it('describes the progress, the profile and the catalog the interface needs', async () => {
    const { service } = setupTurnos();
    const response = toTurnosResponse(await service.get(BUSINESS_ID));
    assert.deepEqual(response.profile, { id: 'restaurant', suggested: 'restaurant', suggestionsUntouched: true });
    assert.deepEqual(response.progress, { currentStep: null, visitedSteps: [], ready: false, readyAt: null });
    assert.deepEqual(response.catalog.profiles.map((profile) => profile.id), ['clinic', 'restaurant', 'bank', 'salon', 'custom']);
    assert.deepEqual(response.catalog.colors, ['orange', 'purple', 'blue', 'green', 'pink', 'amber']);
    assert.deepEqual(response.catalog.steps, ['profile', 'queues', 'rules', 'operators', 'review']);
    assert.equal(response.catalog.limits.queuesPerBusiness, 30);
    assert.ok(!('created' in response));
  });

  it('tells the interface whether changing the profile would replace the suggestions or keep everything', async () => {
    const { service } = setupTurnos();
    const untouched = toTurnosResponse(await service.get(BUSINESS_ID));
    assert.equal(untouched.profile.suggestionsUntouched, true);
    const edited = toTurnosResponse(await service.createQueue(BUSINESS_ID, { name: 'Propia', mode: 'auto', averageMinutes: 5 }));
    assert.equal(edited.profile.suggestionsUntouched, false);
    const state = await service.changeProfile(BUSINESS_ID, 'bank', false);
    assert.equal(toTurnosResponse(state).profile.suggestionsUntouched, false, 'it stays false: the work is kept');
  });

  it('lists the operators with their queues and never anything internal of the document', async () => {
    const { service } = setupTurnos();
    const state = await service.get(BUSINESS_ID);
    const response = toTurnosResponse(await service.createOperator(BUSINESS_ID, { name: 'Laura', email: 'laura@x.co', queueIds: [state.configuration.queues[0].id] }));
    assert.deepEqual(Object.keys(response.operators[0]).sort(), ['activatedAt', 'createdAt', 'email', 'id', 'name', 'phone', 'queueIds', 'status', 'views']);
    assert.equal(response.operators[0].status, 'pending', 'a new operator waits for their first sign-in');
    const json = JSON.stringify(response);
    for (const internal of ['version', 'touched', 'seeded']) assert.ok(!json.includes(`"${internal}"`), `${internal} is internal to the document`);
  });

  it('shows an operator only themselves and their queues', async () => {
    const { service, operators } = setupTurnos();
    const state = await service.get(BUSINESS_ID);
    await service.createOperator(BUSINESS_ID, { name: 'Laura', email: 'laura@x.co', queueIds: [state.configuration.queues[1].id], status: 'active' });
    const response = toOperatorResponse(await operators.view('laura@x.co', BUSINESS_ID));
    assert.deepEqual(Object.keys(response).sort(), ['business', 'catalog', 'firstView', 'operator', 'queues', 'views']);
    assert.deepEqual(response.queues.map((queue) => queue.name), ['Recogida de pedidos']);
  });
});
