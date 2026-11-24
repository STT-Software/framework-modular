import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestMethod } from '@nestjs/common';
import { AuthenticationGuard } from '../../../platform/security/authentication.guard';
import { BusinessAdminGuard, BusinessModuleGuard, OperatorModuleGuard } from '../../business-access/api/business-admin.guards';
import { LAURA, MATEO, operationWorld } from '../fakes.spec';
import { TurnosInsightsController } from './turnos-insights.controller';
import { TurnosOperationController } from './turnos-operation.controller';
import {
  toActivityResponse,
  toBoardResponse,
  toEventResponse,
  toOutcomeResponse,
  toOverviewResponse,
  toRoomScreenResponse,
  toTeamResponse,
  toTicketResponse,
} from './turnos-operation.response';
import { TurnosAdminScopeGuard, TurnosOperatorScopeGuard } from './turnos-scope.guards';
import { toEventItem } from './turnos-stream.mapper';
import { TurnosSurveyController } from './turnos-survey.controller';

const guardsOf = (target: object): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];
const pathOf = (target: object): string => Reflect.getMetadata('path', target);
const methodOf = (target: object): string => RequestMethod[Reflect.getMetadata('method', target)];
const handlersOf = (controller: { prototype: object }) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: (controller.prototype as Record<string, object>)[name] }));
const routesOf = (controller: { prototype: object }) => handlersOf(controller).map(({ handler }) => `${methodOf(handler)} ${pathOf(handler)}`).sort();
const viewsOf = (controller: { prototype: object }) => Object.fromEntries(handlersOf(controller).map(({ handler }) => [`${methodOf(handler)} ${pathOf(handler)}`, Reflect.getMetadata('turnos:operator-view', handler) as string[] | undefined]));

describe('who may reach each route of the operation of Turnos', () => {
  it('the operator workspace needs an operator of THAT business, checked on every request, and then their scope', () => {
    assert.deepEqual(guardsOf(TurnosOperationController), [AuthenticationGuard, BusinessAdminGuard, OperatorModuleGuard, TurnosOperatorScopeGuard]);
    assert.equal(Reflect.getMetadata('business-access:operator-module', TurnosOperationController), 'turnos');
    assert.equal(pathOf(TurnosOperationController), 'turnos/businesses/:businessId/operation');
  });
  it('the administrator side needs the boss of THAT business with Turnos enabled, and never an operator', () => {
    assert.deepEqual(guardsOf(TurnosInsightsController), [AuthenticationGuard, BusinessAdminGuard, BusinessModuleGuard, TurnosAdminScopeGuard]);
    assert.equal(Reflect.getMetadata('business-access:module', TurnosInsightsController), 'turnos');
    assert.equal(pathOf(TurnosInsightsController), 'turnos/businesses/:businessId/insights');
  });
  it('every route of the operator workspace declares the view it belongs to', () => {
    const views = viewsOf(TurnosOperationController);
    assert.deepEqual(Object.keys(views).filter((route) => !views[route]), [], 'a route without a view would let any operator in');
    assert.deepEqual(views, {
      'GET home': ['home'],
      'GET activity': ['home'],
      'GET queues': ['queues'],
      'POST queues/:queueId/pause': ['queues'],
      'POST queues/:queueId/resume': ['queues'],
      'POST queues/:queueId/tickets': ['create-turn'],
      'POST queues/:queueId/call-next': ['my-turns'],
      'GET tickets': ['my-turns'],
      'GET tickets/current': ['my-turns', 'home'],
      'GET tickets/:ticketId': ['my-turns'],
      'POST tickets/:ticketId/call': ['my-turns'],
      'POST tickets/:ticketId/complete': ['my-turns'],
      'POST tickets/:ticketId/cancel': ['my-turns'],
      'POST tickets/:ticketId/no-show': ['my-turns'],
      'GET surveys/summary': ['surveys'],
      'GET surveys/responses': ['surveys'],
      'GET events': ['home', 'my-turns', 'create-turn', 'queues', 'surveys'],
    });
  });
  it('the operator workspace has no route that changes configuration, operators, rules or settings', () => {
    const routes = routesOf(TurnosOperationController).join('\n');
    for (const forbidden of ['operators', 'rules', 'profile', 'room-screen', 'surveys/config', 'csv']) assert.ok(!routes.includes(forbidden), forbidden);
    assert.ok(!routesOf(TurnosOperationController).some((route) => route.startsWith('PUT') || route.startsWith('DELETE')));
  });
  it('the administrator side reads, configures and can attend like an operator, with the same routes for turns', () => {
    assert.deepEqual(routesOf(TurnosInsightsController), [
      'GET activity',
      'GET events',
      'GET overview',
      'GET queues',
      'GET room-screen',
      'GET surveys/config',
      'GET surveys/responses',
      'GET surveys/summary',
      'GET team',
      'GET tickets',
      'GET tickets.csv',
      'GET tickets/:ticketId',
      'GET tickets/current',
      'POST queues/:queueId/call-next',
      'POST queues/:queueId/pause',
      'POST queues/:queueId/resume',
      'POST queues/:queueId/tickets',
      'POST tickets/:ticketId/call',
      'POST tickets/:ticketId/cancel',
      'POST tickets/:ticketId/complete',
      'POST tickets/:ticketId/no-show',
      'PUT room-screen',
      'PUT surveys/config',
    ]);
  });
  it('the live streams are Server-Sent Events behind the same guards', () => {
    assert.equal(Reflect.getMetadata('__sse__', TurnosOperationController.prototype.events), true);
    assert.equal(Reflect.getMetadata('__sse__', TurnosInsightsController.prototype.events), true);
  });
  it('the customer survey needs no sign-in, only the private link, and has nothing else', () => {
    assert.deepEqual(guardsOf(TurnosSurveyController), []);
    assert.deepEqual(routesOf(TurnosSurveyController), ['GET /', 'POST /']);
    assert.equal(pathOf(TurnosSurveyController), 'turnos/surveys/:token');
  });
});

describe('what the operation API shows', () => {
  it('a turn with its customer, answers, times and who attended it; the history only when one turn is opened', async () => {
    const world = await operationWorld();
    const ticket = await world.issue(world.recogida.id, { customerName: 'Ana', note: 'Rápido' });
    const laura = await world.operator(LAURA);
    await world.ticketService.call(laura, ticket.id);
    world.clock.advance(120_000);
    const done = await world.ticketService.complete(laura, ticket.id);
    const brief = toTicketResponse(done.ticket);
    assert.deepEqual(Object.keys(brief).sort(), ['answers', 'attendedBy', 'calledAt', 'cancelReason', 'code', 'createdAt', 'createdBy', 'customer', 'finishedAt', 'id', 'note', 'queue', 'serviceMinutes', 'status', 'waitMinutes']);
    assert.deepEqual([brief.code, brief.status, brief.queue, brief.attendedBy?.name, brief.waitMinutes, brief.serviceMinutes], ['R-001', 'completed', { id: world.recogida.id, name: 'Recogida de pedidos' }, 'Laura Gómez', 0, 2]);
    const detail = toTicketResponse(done.ticket, { detail: true });
    assert.deepEqual(detail.events?.map((event) => event.type), ['created', 'called', 'completed']);
    assert.deepEqual(Object.keys(toOutcomeResponse(done)).sort(), ['applied', 'next', 'ticket']);
    const json = JSON.stringify(brief);
    for (const internal of ['businessId', 'clientRequestId', 'seq', 'dayKey', 'prefix']) assert.ok(!json.includes(`"${internal}"`), `${internal} is internal`);
  });
  it('the dashboard, the team, the activity, the board and the room screen are plain data with ISO dates', async () => {
    const world = await operationWorld();
    const ticket = await world.issue(world.caja.id, { customerName: 'Ana' });
    await world.ticketService.callNext(await world.operator(LAURA), world.caja.id);
    const admin = await world.admin();
    const overview = toOverviewResponse(await world.insights.overview(admin, {}));
    assert.deepEqual(Object.keys(overview).sort(), ['daily', 'generatedAt', 'hourly', 'mine', 'queues', 'range', 'totals', 'truncated']);
    assert.deepEqual(overview.range, { from: '2026-03-04', to: '2026-03-04', days: 1 });
    assert.equal(overview.queues[0].queue.id, world.caja.id);
    assert.equal(toTeamResponse(await world.insights.team(admin, {})).members.find((member) => member.name === 'Laura Gómez')?.current?.since, '2026-03-04T15:00:00.000Z');
    assert.equal(toActivityResponse(await world.insights.activity(admin, 5))[0].ticket.id, ticket.id);
    assert.deepEqual(toBoardResponse(await world.ticketService.board(admin))[0], {
      queue: { id: world.caja.id, name: 'Pedidos en caja', color: 'orange', mode: 'auto', status: 'active', averageMinutes: 8 },
      waiting: 0,
      attending: 1,
      longestWaitMinutes: null,
      urgent: 0,
      state: 'empty',
    });
    assert.equal(toRoomScreenResponse(await world.insights.roomScreen(admin)).calls[0].calledAt, '2026-03-04T15:00:00.000Z');
  });
  it('a live event carries the turn only for those who attend, otherwise just its code and state', async () => {
    const world = await operationWorld();
    const ticket = await world.issue(world.caja.id, { customerName: 'Ana', customerPhone: '+573001234567' });
    const event = { type: 'ticket.created' as const, businessId: ticket.businessId, at: new Date('2026-03-04T15:00:00Z'), queueId: ticket.queueId, ticket };
    const full = toEventResponse(event, true) as { ticket: { customer: unknown } };
    const brief = toEventResponse(event, false) as { ticket: Record<string, unknown> };
    assert.ok(full.ticket.customer);
    assert.deepEqual(Object.keys(brief.ticket).sort(), ['code', 'id', 'status']);
    assert.deepEqual(toEventItem({ name: 'ping' }), { type: 'ping', data: {} });
    assert.equal(toEventItem({ name: 'ticket.created', event, withTicket: false }).type, 'ticket.created');
    assert.ok(MATEO);
  });
});
