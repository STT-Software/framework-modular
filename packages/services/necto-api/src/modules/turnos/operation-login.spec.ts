import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OperatesModule, OperatorModuleGuard, type AdminRequest } from '../business-access/api/business-admin.guards';
import { BusinessNotAdministeredError } from '../business-access/domain/errors';
import { aBusiness as anAccessBusiness, setupAdminAccess } from '../business-access/fakes.spec';
import { RequiresView, TurnosOperatorScopeGuard } from './api/turnos-scope.guards';
import { TurnosOperatorActivation } from './application/turnos-operator-activation';
import { OperatorNotOperableError, ViewNotAllowedError } from './domain/errors';
import { buildTurnos, operatorInput } from './fakes.spec';

const LAURA = 'laura@cafecentral.co';
const ANA = 'ana@cafecentral.co';

/**
 * The same login for administrators and operators with the real pieces of business-access (codes, sessions, guards) and of Turnos wired
 * together in memory: what the administrator gives an operator decides where they land after signing in, and a change of permissions reaches
 * the sessions that are already open.
 */
function setup() {
  const access = setupAdminAccess();
  access.directory.set({ ...access.business, modules: ['reservas', 'turnos'] });
  const wired = buildTurnos(access.directory as never, access.clock, access.registry);
  wired.source.onModuleInit();
  new TurnosOperatorActivation(access.events, wired.repository, wired.store, wired.hub, access.clock).onModuleInit();
  const businessId = access.business.id;
  const context = (request: Partial<AdminRequest>, handler: () => void): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => class {} }) as unknown as ExecutionContext;
  class Route {
    @OperatesModule('turnos')
    anyView() {}
    @RequiresView('my-turns')
    myTurns() {}
    @RequiresView('surveys')
    surveys() {}
  }
  const guards = { operator: new OperatorModuleGuard(new Reflector(), access.grants), scope: new TurnosOperatorScopeGuard(new Reflector(), wired.access) };
  /** What a request of this session does on a route of the operator workspace: the answer of each guard, in order. */
  async function reach(session: AdminRequest['adminSession'], handler: 'myTurns' | 'surveys') {
    const request: Partial<AdminRequest> = { adminSession: session, params: { businessId } };
    const gate = context(request, Route.prototype.anyView);
    try {
      await guards.operator.canActivate(gate);
    } catch (error) {
      if (error instanceof BusinessNotAdministeredError) return 'not-an-operator';
      throw error;
    }
    try {
      await guards.scope.canActivate(context(request, Route.prototype[handler]));
      return 'allowed';
    } catch (error) {
      if (error instanceof OperatorNotOperableError) return 'not-operable';
      if (error instanceof ViewNotAllowedError) return 'view-not-allowed';
      throw error;
    }
  }
  async function addOperator(extra: Record<string, unknown> = {}, email = LAURA) {
    const state = await wired.service.get(businessId);
    const created = await wired.service.createOperator(businessId, operatorInput('Laura Gómez', email, [state.configuration.queues[0].id], { status: undefined, ...extra }));
    return { operatorId: created.created!.id, queueId: state.configuration.queues[0].id };
  }
  const operatorOf = async (email = LAURA) => (await wired.store.find(businessId))!.operators.find((item) => item.email === email)!;
  return { access, wired, businessId, addOperator, operatorOf, reach };
}

describe('the first sign-in of an operator', () => {
  it('a new operator is pending until they sign in, and the sign-in itself makes them active', async () => {
    const { access, addOperator, operatorOf } = setup();
    await addOperator();
    assert.equal((await operatorOf()).status, 'pending');
    assert.equal((await operatorOf()).activatedAt, null);
    const { grant } = await access.signIn({ email: LAURA });
    const operator = await operatorOf();
    assert.deepEqual([operator.status, operator.activatedAt?.toISOString()], ['active', access.clock.now().toISOString()]);
    assert.deepEqual(grant.accesses.map((item) => [item.role, item.operable]), [['operator', true]], 'already operable in the very grant of that sign-in');
  });
  it('lands the operator on the first view they were given, in the order of the workspace, not on a general dashboard', async () => {
    const { access, addOperator } = setup();
    await addOperator({ views: ['surveys', 'my-turns', 'create-turn'] });
    const { grant } = await access.signIn({ email: LAURA });
    assert.deepEqual([grant.accesses[0].views, grant.accesses[0].firstView], [['my-turns', 'create-turn', 'surveys'], 'my-turns']);
    assert.equal(grant.accesses[0].role, 'operator');
    assert.deepEqual(grant.businesses, [], 'nothing of the administrators dashboard');
  });
  it('an operator with only the surveys view lands on surveys', async () => {
    const { access, addOperator } = setup();
    await addOperator({ views: ['surveys'] });
    assert.equal((await access.signIn({ email: LAURA })).grant.accesses[0].firstView, 'surveys');
  });
  it('an operator without any view has no access at all: the code is not even sent', async () => {
    const { access, addOperator } = setup();
    await addOperator({ views: [] });
    assert.equal(await access.requestCode(LAURA).catch(() => 'refused'), 'refused');
  });
  it('a pending operator who already has a session through another access cannot operate until they sign in again', async () => {
    const { access, wired, businessId, addOperator, reach } = setup();
    // Ana is the boss of the business and has a session; the administrator (her) assigns her as an operator of the same business.
    const { started } = await access.signIn({ email: ANA });
    await addOperator({}, ANA);
    assert.equal(await reach(started.session, 'myTurns'), 'not-an-operator', 'pending: the operator routes refuse her');
    const grant = await access.grants.list(ANA);
    assert.deepEqual(grant.map((item) => [item.role, item.operable]), [['admin', true], ['operator', false]]);
    access.clock.advance(61_000);
    await access.signIn({ email: ANA });
    assert.equal((await wired.store.find(businessId))!.operators[0].status, 'active');
    assert.equal(await reach(started.session, 'myTurns'), 'allowed', 'and after signing in the same session can');
  });
  it('an operator the administrator switched off is not activated by signing in, and cannot sign in with only that access', async () => {
    const { access, addOperator, operatorOf, wired, businessId } = setup();
    const { operatorId, queueId } = await addOperator();
    await wired.service.updateOperator(businessId, operatorId, operatorInput('Laura Gómez', LAURA, [queueId], { status: 'inactive' }));
    assert.equal(await access.requestCode(LAURA).catch(() => 'refused'), 'refused');
    assert.equal((await operatorOf()).status, 'inactive');
  });
});

describe('permissions that change while a session is open', () => {
  async function signedIn(views: string[] = ['my-turns', 'surveys']) {
    const world = setup();
    const { operatorId, queueId } = await world.addOperator({ views });
    const { started } = await world.access.signIn({ email: LAURA });
    return { ...world, session: started.session, operatorId, queueId };
  }
  it('taking a view away closes that view in the same session on the next request, and leaves the others', async () => {
    const { reach, session, wired, businessId, operatorId, queueId } = await signedIn();
    assert.deepEqual([await reach(session, 'myTurns'), await reach(session, 'surveys')], ['allowed', 'allowed']);
    await wired.service.updateOperator(businessId, operatorId, operatorInput('Laura Gómez', LAURA, [queueId], { views: ['surveys'] }));
    assert.deepEqual([await reach(session, 'myTurns'), await reach(session, 'surveys')], ['view-not-allowed', 'allowed']);
  });
  it('giving a view back opens it again without signing in again', async () => {
    const { reach, session, wired, businessId, operatorId, queueId } = await signedIn(['surveys']);
    assert.equal(await reach(session, 'myTurns'), 'view-not-allowed');
    await wired.service.updateOperator(businessId, operatorId, operatorInput('Laura Gómez', LAURA, [queueId], { views: ['surveys', 'my-turns'] }));
    assert.equal(await reach(session, 'myTurns'), 'allowed');
  });
  it('switching the operator off, or removing every view, stops everything on the next request', async () => {
    const { reach, session, wired, businessId, operatorId, queueId } = await signedIn();
    await wired.service.updateOperator(businessId, operatorId, operatorInput('Laura Gómez', LAURA, [queueId], { views: [] }));
    assert.equal(await reach(session, 'surveys'), 'not-an-operator', 'without views there is nothing to operate: not even an access');
    await wired.service.updateOperator(businessId, operatorId, operatorInput('Laura Gómez', LAURA, [queueId], { views: ['surveys'], status: 'inactive' }));
    assert.equal(await reach(session, 'surveys'), 'not-an-operator');
  });
  it('removing the operator closes their access but not their session; their other accesses remain', async () => {
    const world = setup();
    const { operatorId } = await world.addOperator({}, ANA);
    const { started } = await world.access.signIn({ email: ANA });
    assert.equal(await world.reach(started.session, 'myTurns'), 'allowed');
    await world.wired.service.deleteOperator(world.businessId, operatorId);
    assert.equal(await world.reach(started.session, 'myTurns'), 'not-an-operator');
    assert.deepEqual((await world.access.grants.list(ANA)).map((item) => item.role), ['admin'], 'she is still the boss');
    assert.ok(await world.access.sessions.requireActive(started.session.id, ANA), 'the session did not end');
  });
  it('the operator of another business never gets in through a view of this one', async () => {
    const world = setup();
    await world.addOperator();
    const other = anAccessBusiness({ id: 'c'.repeat(24), name: 'Clínica Norte', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } });
    world.access.directory.set(other);
    const { started } = await world.access.signIn({ email: LAURA });
    const request: Partial<AdminRequest> = { adminSession: started.session, params: { businessId: other.id } };
    const handler = (() => {
      class Route {
        @OperatesModule('turnos')
        handle() {}
      }
      return Route.prototype.handle;
    })();
    await assert.rejects(
      new OperatorModuleGuard(new Reflector(), world.access.grants).canActivate(
        ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => class {} }) as unknown as ExecutionContext,
      ),
      BusinessNotAdministeredError,
    );
  });
});
