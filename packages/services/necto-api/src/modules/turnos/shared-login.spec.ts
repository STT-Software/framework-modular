import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessModuleGuard, OperatesModule, OperatorModuleGuard, RequiresBusinessModule, type AdminRequest } from '../business-access/api/business-admin.guards';
import { BusinessNotAdministeredError, EmailNotAssignedError, InvalidAccessCodeError, SessionExpiredError } from '../business-access/domain/errors';
import { aBusiness as anAccessBusiness, setupAdminAccess } from '../business-access/fakes.spec';
import { TurnosConfigurationService } from './application/turnos-configuration.service';
import { TurnosConfigurationStore } from './application/turnos-configuration.store';
import { TurnosOperatorAccessSource } from './application/turnos-operator-access.source';
import { TurnosOperatorService } from './application/turnos-operator.service';
import { buildTurnos, operatorInput } from './fakes.spec';

/**
 * The same login for administrators and operators, with the real pieces of both modules wired together in memory: the OTP flow
 * of business-access (codes, sessions, limits), the guards, and the Turnos module registered as the source of operator assignments.
 */
const LAURA = 'laura@cafecentral.co';
const ANA = 'ana@cafecentral.co';

function setup() {
  const access = setupAdminAccess();
  access.directory.set({ ...access.business, modules: ['reservas', 'turnos'] });
  const wired = buildTurnos(access.directory as never, access.clock, access.registry);
  const repository = wired.repository;
  const turnos = wired.service;
  const operators = wired.operators;
  wired.source.onModuleInit();
  const businessId = access.business.id;

  const context = (request: Partial<AdminRequest>, handler: () => void): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => class {} }) as unknown as ExecutionContext;
  const adminRoute = (() => {
    class Route {
      @RequiresBusinessModule('turnos')
      handle() {}
    }
    return Route.prototype.handle;
  })();
  const operatorRoute = (() => {
    class Route {
      @OperatesModule('turnos')
      handle() {}
    }
    return Route.prototype.handle;
  })();
  /** What a request of this session would be allowed to do in `id`, as the server decides it on every request. */
  async function can(session: AdminRequest['adminSession'], id = businessId) {
    const request: Partial<AdminRequest> = { adminSession: session, params: { businessId: id } };
    const attempt = async (guard: { canActivate: (c: ExecutionContext) => boolean | Promise<boolean> }, handler: () => void) => {
      try {
        return await guard.canActivate(context(request, handler));
      } catch (error) {
        if (error instanceof BusinessNotAdministeredError) return false;
        throw error;
      }
    };
    return {
      configure: await attempt(new BusinessModuleGuard(new Reflector(), access.administered), adminRoute),
      operate: await attempt(new OperatorModuleGuard(new Reflector(), access.grants), operatorRoute),
    };
  }
  /** The administrator adds an operator of Turnos, and returns the ids of what they have. */
  async function addOperator(email = LAURA, name = 'Laura Gómez') {
    const state = await turnos.get(businessId);
    const queueId = state.configuration.queues[0].id;
    const created = await turnos.createOperator(businessId, operatorInput(name, email, [queueId]));
    return { queueId, operatorId: created.created!.id, queues: state.configuration.queues.map((queue) => queue.id) };
  }
  return { access, repository, turnos, operators, businessId, can, addOperator };
}

describe('an operator signs in with the same code flow as the administrator', () => {
  it('cannot ask for a code before the administrator adds them, and can right after', async () => {
    const { access, addOperator } = setup();
    await assert.rejects(access.login.requestCode({ email: LAURA, ip: '203.0.113.5' }), EmailNotAssignedError);
    await addOperator();
    assert.ok(await access.requestCode(LAURA), 'a real code was emailed to the operator');
    assert.equal(access.transport.sent.at(-1)?.to, LAURA);
  });

  it('receives only their operator access: the business and Turnos, no administrator access', async () => {
    const { access, addOperator, businessId } = setup();
    await addOperator();
    const { grant } = await access.signIn({ email: LAURA });
    assert.deepEqual(grant.accesses.map((item) => ({ businessId: item.businessId, role: item.role, modules: item.modules, name: item.personName })), [
      { businessId, role: 'operator', modules: ['turnos'], name: 'Laura Gómez' },
    ]);
    assert.deepEqual(grant.businesses, [], 'the list of administered businesses is empty');
  });

  it('uses the real OTP: the old demo code 123456 does not open anything, and a code is spent by its first use', async () => {
    const { access, addOperator } = setup();
    await addOperator();
    const code = await access.requestCode(LAURA);
    assert.ok(code);
    const wrong = code === '123456' ? '654321' : '123456';
    await assert.rejects(access.login.verifyCode({ email: LAURA, code: wrong, ip: '203.0.113.1', remember: false }), InvalidAccessCodeError);
    await access.login.verifyCode({ email: LAURA, code, ip: '203.0.113.1', remember: false });
    await assert.rejects(access.login.verifyCode({ email: LAURA, code, ip: '203.0.113.1', remember: false }), InvalidAccessCodeError, 'single use');
  });

  it('limits the attempts of an operator like those of an administrator: five wrong tries lock the code', async () => {
    const { access, addOperator } = setup();
    await addOperator();
    const code = await access.requestCode(LAURA);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await assert.rejects(access.login.verifyCode({ email: LAURA, code: wrong, ip: '203.0.113.1', remember: false }), InvalidAccessCodeError);
    await assert.rejects(access.login.verifyCode({ email: LAURA, code: code!, ip: '203.0.113.1', remember: false }), InvalidAccessCodeError, 'even the right one is locked now');
  });

  it('gives one identity both roles when the same email is the boss of a business and an operator of another, and lets them choose', async () => {
    const { access, turnos, addOperator } = setup();
    const other = anAccessBusiness({ id: 'c'.repeat(24), name: 'Clínica Norte', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } });
    access.directory.set(other);
    const queue = await turnos.createQueue(other.id, { name: 'Consultas', mode: 'auto', averageMinutes: 10 });
    await turnos.createOperator(other.id, operatorInput('Ana en la clínica', ANA, [queue.created!.id]));
    await addOperator();
    const { grant } = await access.signIn({ email: ANA });
    assert.deepEqual(grant.accesses.map((item) => `${item.businessName}:${item.role}`), ['Café Central:admin', 'Clínica Norte:operator']);
    assert.deepEqual(grant.businesses.map((item) => item.name), ['Café Central'], 'only the administered one in the legacy list');
  });
});

describe('what each role may do, decided on every request', () => {
  it('an operator may operate their business and may not configure it; the boss may configure it and is not an operator', async () => {
    const world = setup();
    await world.addOperator();
    const operator = await world.access.signIn({ email: LAURA });
    const boss = await world.access.signIn({ email: ANA });
    assert.deepEqual(await world.can(operator.started.session), { configure: false, operate: true });
    assert.deepEqual(await world.can(boss.started.session), { configure: true, operate: false });
  });

  it('answers the same for a business that is not theirs: an operator of one business has nothing in another', async () => {
    const world = setup();
    await world.addOperator();
    world.access.directory.set(anAccessBusiness({ id: 'c'.repeat(24), name: 'Clínica Norte', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } }));
    const operator = await world.access.signIn({ email: LAURA });
    assert.deepEqual(await world.can(operator.started.session, 'c'.repeat(24)), { configure: false, operate: false });
    assert.deepEqual(await world.can(operator.started.session, 'f'.repeat(24)), { configure: false, operate: false });
  });

  it('the operator sees only their queues with the session email, not those of a colleague', async () => {
    const world = setup();
    const { queues } = await world.addOperator();
    await world.turnos.createOperator(world.businessId, operatorInput('Mateo', 'mateo@cafecentral.co', [queues[1]]));
    assert.deepEqual((await world.operators.view(LAURA, world.businessId)).queues.map((queue) => queue.id), [queues[0]]);
    assert.deepEqual((await world.operators.view('mateo@cafecentral.co', world.businessId)).queues.map((queue) => queue.id), [queues[1]]);
  });
});

describe('access is re-evaluated when something is taken away', () => {
  it('removing the operator ends their access on the next request, but not their session or identity', async () => {
    const world = setup();
    const { operatorId } = await world.addOperator();
    const { started } = await world.access.signIn({ email: LAURA });
    assert.equal((await world.can(started.session)).operate, true);
    await world.turnos.deleteOperator(world.businessId, operatorId);
    assert.deepEqual(await world.can(started.session), { configure: false, operate: false });
    await assert.rejects(world.operators.view(LAURA, world.businessId));
    await assert.rejects(world.access.sessions.refresh(started.cookieValue), SessionExpiredError, 'with no access left the session ends on refresh');
  });

  it('removing one assignment keeps the person\'s other accesses, in the same session', async () => {
    const world = setup();
    const { operatorId } = await world.addOperator();
    const other = anAccessBusiness({ id: 'c'.repeat(24), name: 'Clínica Norte', modules: ['turnos'], boss: { assignmentId: 'a-2', name: 'Luis', email: 'luis@norte.co' } });
    world.access.directory.set(other);
    const queue = await world.turnos.createQueue(other.id, { name: 'Consultas', mode: 'auto', averageMinutes: 10 });
    await world.turnos.createOperator(other.id, operatorInput('Laura en la clínica', LAURA, [queue.created!.id]));
    const { started, grant } = await world.access.signIn({ email: LAURA });
    assert.equal(grant.accesses.length, 2);
    await world.turnos.deleteOperator(world.businessId, operatorId);
    const refreshed = await world.access.sessions.refresh(started.cookieValue);
    assert.deepEqual(refreshed.accesses.map((item) => item.businessId), [other.id]);
    assert.deepEqual(await world.can(started.session, other.id), { configure: false, operate: true });
  });

  it('removing an administrator\'s own operator role keeps their administrator access', async () => {
    const world = setup();
    const { operatorId } = await world.addOperator(ANA, 'Ana Gómez');
    const { started, grant } = await world.access.signIn({ email: ANA });
    assert.deepEqual(grant.accesses.map((item) => item.role), ['admin', 'operator']);
    await world.turnos.deleteOperator(world.businessId, operatorId);
    assert.deepEqual((await world.access.sessions.refresh(started.cookieValue)).accesses.map((item) => item.role), ['admin']);
    assert.deepEqual(await world.can(started.session), { configure: true, operate: false });
  });

  it('disabling Turnos for the business closes both the configuration and the operator access', async () => {
    const world = setup();
    await world.addOperator();
    const operator = await world.access.signIn({ email: LAURA });
    const boss = await world.access.signIn({ email: ANA });
    world.access.directory.set({ ...world.access.business, modules: ['reservas'] });
    assert.equal((await world.can(operator.started.session)).operate, false);
    await assert.rejects(world.can(boss.started.session), 'the administrator is told the module is not enabled (403)');
    await assert.rejects(world.access.sessions.refresh(operator.started.cookieValue), SessionExpiredError);
    world.access.directory.set({ ...world.access.business, modules: ['reservas', 'turnos'] });
    assert.equal((await world.can(operator.started.session)).operate, true, 'enabling it again gives the access back: the assignment was never deleted');
  });

  it('pausing the business closes the operator access', async () => {
    const world = setup();
    await world.addOperator();
    const operator = await world.access.signIn({ email: LAURA });
    world.access.directory.set({ ...world.access.business, modules: ['turnos'], status: 'paused' });
    assert.deepEqual(await world.can(operator.started.session), { configure: false, operate: false });
  });

  it('deleting the queue of an operator keeps their access only when they are reassigned', async () => {
    const world = setup();
    const { operatorId, queueId, queues } = await world.addOperator();
    const { started } = await world.access.signIn({ email: LAURA });
    await assert.rejects(world.turnos.deleteQueue(world.businessId, queueId, []));
    assert.equal((await world.can(started.session)).operate, true, 'the refused deletion changed nothing');
    await world.turnos.deleteQueue(world.businessId, queueId, [{ operatorId, queueId: queues[1] }]);
    assert.equal((await world.can(started.session)).operate, true);
    assert.deepEqual((await world.operators.view(LAURA, world.businessId)).queues.map((queue) => queue.id), [queues[1]]);
  });

  it('an administrator who loses the business loses the configuration but an operator of it keeps working', async () => {
    const world = setup();
    await world.addOperator();
    const boss = await world.access.signIn({ email: ANA });
    const operator = await world.access.signIn({ email: LAURA });
    world.access.directory.set({ ...world.access.business, modules: ['turnos'], boss: { assignmentId: 'a-9', name: 'Nuevo', email: 'nuevo@cafecentral.co' } });
    assert.deepEqual(await world.can(boss.started.session), { configure: false, operate: false });
    assert.deepEqual(await world.can(operator.started.session), { configure: false, operate: true });
  });
});
