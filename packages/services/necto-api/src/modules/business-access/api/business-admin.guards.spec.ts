import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../../platform/security/authenticated-user';
import { ModuleNotEnabledError, ReverificationRequiredError, SessionExpiredError, BusinessNotAdministeredError } from '../domain/errors';
import { aBusiness, setupAdminAccess } from '../fakes.spec';
import { BusinessAdministeredGuard, BusinessAdminGuard, BusinessModuleGuard, OperatesModule, OperatorModuleGuard, RecentVerificationGuard, RequiresBusinessModule, type AdminRequest } from './business-admin.guards';

function contextFor(request: Partial<AdminRequest>, handler: () => void = () => undefined): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => class {} } as unknown as ExecutionContext;
}

const admin = (sessionId: string, email = 'ana@cafecentral.co'): AuthenticatedUser => ({ userId: email, role: 'business-admin', sessionId });

describe('BusinessAdminGuard (is this session still valid?)', () => {
  it('lets in an administrator whose session is active, and leaves the session on the request', async () => {
    const { signIn, sessions } = setupAdminAccess();
    const { started } = await signIn();
    const request: Partial<AdminRequest> = { user: admin(started.session.id) };
    assert.equal(await new BusinessAdminGuard(sessions).canActivate(contextFor(request)), true);
    assert.equal(request.adminSession?.id, started.session.id);
  });

  it('answers 401 without a user and 403 for a super admin', async () => {
    const { sessions } = setupAdminAccess();
    const guard = new BusinessAdminGuard(sessions);
    await assert.rejects(guard.canActivate(contextFor({})), UnauthorizedException);
    await assert.rejects(guard.canActivate(contextFor({ user: { userId: 'u1', role: 'superadmin' } })), ForbiddenException);
  });

  it('answers session-expired once the session was ended, even with a token that has not expired yet', async () => {
    const { signIn, sessions } = setupAdminAccess();
    const { started } = await signIn();
    await sessions.endByCookie(started.cookieValue, 'signed-out');
    await assert.rejects(new BusinessAdminGuard(sessions).canActivate(contextFor({ user: admin(started.session.id) })), SessionExpiredError);
  });

  it('answers session-expired for an unknown session or one that expired', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const guard = new BusinessAdminGuard(sessions);
    await assert.rejects(guard.canActivate(contextFor({ user: admin('no-such-session') })), SessionExpiredError);
    const { started } = await signIn({ remember: true });
    clock.advance(31 * 24 * 60 * 60_000);
    await assert.rejects(guard.canActivate(contextFor({ user: admin(started.session.id) })), SessionExpiredError);
  });
});

describe('RecentVerificationGuard (sensitive actions)', () => {
  it('lets through a recently verified session and asks for a new code after ten minutes', async () => {
    const { signIn, sessions, clock } = setupAdminAccess();
    const { started } = await signIn();
    const guard = new RecentVerificationGuard(sessions);
    assert.equal(guard.canActivate(contextFor({ adminSession: started.session })), true);
    clock.advance(11 * 60_000);
    assert.throws(() => guard.canActivate(contextFor({ adminSession: started.session })), ReverificationRequiredError);
  });

  it('answers 401 if no session was checked before it', async () => {
    const { sessions } = setupAdminAccess();
    assert.throws(() => new RecentVerificationGuard(sessions).canActivate(contextFor({})), UnauthorizedException);
  });

  it('the error carries a stable code so the interface can ask for a code instead of failing', () => {
    assert.equal(new ReverificationRequiredError().code, 'reverification-required');
    assert.equal(new SessionExpiredError().code, 'session-expired');
    assert.equal(new ModuleNotEnabledError().code, 'module-not-enabled');
  });
});

describe('BusinessModuleGuard (does this business have the functionality, and is it yours?)', () => {
  /** A route handler marked as a module needs, so the guard reads the same metadata it would in production. */
  function handlerFor(moduleId: string) {
    class Route {
      @RequiresBusinessModule(moduleId)
      handle() {}
    }
    return Route.prototype.handle;
  }

  function guardFor(setup: ReturnType<typeof setupAdminAccess>) {
    return new BusinessModuleGuard(new Reflector(), setup.administered);
  }

  async function check(setup: ReturnType<typeof setupAdminAccess>, businessId: string, moduleId: string, email = setup.business.boss.email) {
    const { started } = await setup.signIn();
    const session = { ...started.session, email };
    return guardFor(setup).canActivate(contextFor({ adminSession: session, params: { businessId } }, handlerFor(moduleId)));
  }

  it('lets through the current boss of an active business that has the module enabled', async () => {
    const setup = setupAdminAccess();
    assert.equal(await check(setup, setup.business.id, 'reservas'), true);
  });

  it('answers module-not-enabled for a functionality the business does not have', async () => {
    const setup = setupAdminAccess();
    await assert.rejects(check(setup, setup.business.id, 'inventario'), ModuleNotEnabledError);
  });

  it('answers not-found for a business of someone else, even with the module enabled there', async () => {
    const setup = setupAdminAccess();
    setup.directory.set(aBusiness({ id: 'e'.repeat(24), boss: { assignmentId: 'assignment-5', name: 'Luis', email: 'luis@otro.co' } }));
    await assert.rejects(check(setup, 'e'.repeat(24), 'reservas'), BusinessNotAdministeredError);
  });

  it('answers not-found for an unknown business, with the same error as for someone else\'s', async () => {
    const setup = setupAdminAccess();
    await assert.rejects(check(setup, 'f'.repeat(24), 'reservas'), BusinessNotAdministeredError);
  });

  it('stops working the moment the business is paused or the boss is replaced', async () => {
    const setup = setupAdminAccess();
    const { started } = await setup.signIn();
    const run = () => guardFor(setup).canActivate(contextFor({ adminSession: started.session, params: { businessId: setup.business.id } }, handlerFor('reservas')));
    assert.equal(await run(), true);
    setup.directory.set({ ...setup.business, status: 'paused' });
    await assert.rejects(run(), BusinessNotAdministeredError);
    setup.directory.set(setup.business);
    assert.equal(await run(), true, 'resuming the business reopens the door for the same session');
    setup.directory.set({ ...setup.business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    await assert.rejects(run(), BusinessNotAdministeredError);
  });

  it('answers 401 when no session was checked before it', async () => {
    const setup = setupAdminAccess();
    await assert.rejects(guardFor(setup).canActivate(contextFor({ params: { businessId: setup.business.id } }, handlerFor('reservas'))), UnauthorizedException);
  });
});

describe('BusinessAdministeredGuard (is this business yours, whatever functionalities it has?)', () => {
  /** Signs in first (the person was the boss then); what changes afterwards is what the guard must notice. */
  async function run(setup: ReturnType<typeof setupAdminAccess>, businessId: string, email = setup.business.boss.email, change?: () => void) {
    const { started } = await setup.signIn();
    change?.();
    const request: Partial<AdminRequest> = { adminSession: { ...started.session, email }, params: { businessId } };
    const allowed = await new BusinessAdministeredGuard(setup.administered).canActivate(contextFor(request));
    return { allowed, request };
  }

  it('lets through the current boss of an active business and leaves the business on the request', async () => {
    const setup = setupAdminAccess();
    const { allowed, request } = await run(setup, setup.business.id);
    assert.equal(allowed, true);
    assert.equal(request.administeredBusiness?.id, setup.business.id);
  });

  it('does not ask for any functionality: a business with none enabled is still administered', async () => {
    const setup = setupAdminAccess();
    assert.equal((await run(setup, setup.business.id, undefined, () => setup.directory.set({ ...setup.business, modules: [] }))).allowed, true);
  });

  it('answers the same not-found for a business of someone else, an unknown one and a paused one', async () => {
    const someoneElses = setupAdminAccess();
    someoneElses.directory.set(aBusiness({ id: 'e'.repeat(24), boss: { assignmentId: 'assignment-5', name: 'Luis', email: 'luis@otro.co' } }));
    await assert.rejects(run(someoneElses, 'e'.repeat(24)), BusinessNotAdministeredError);
    const unknown = setupAdminAccess();
    await assert.rejects(run(unknown, 'f'.repeat(24)), BusinessNotAdministeredError);
    const paused = setupAdminAccess();
    await assert.rejects(
      run(paused, paused.business.id, undefined, () => paused.directory.set({ ...paused.business, status: 'paused' })),
      BusinessNotAdministeredError,
    );
  });

  it('stops working when the boss is replaced', async () => {
    const setup = setupAdminAccess();
    const replaced = () => setup.directory.set({ ...setup.business, boss: { assignmentId: 'assignment-2', name: 'Luis', email: 'luis@cafecentral.co' } });
    await assert.rejects(run(setup, setup.business.id, undefined, replaced), BusinessNotAdministeredError);
  });

  it('answers 401 when no session was checked before it', async () => {
    const setup = setupAdminAccess();
    await assert.rejects(new BusinessAdministeredGuard(setup.administered).canActivate(contextFor({ params: { businessId: setup.business.id } })), UnauthorizedException);
  });
});

describe('OperatorModuleGuard (is this person an operator of this business for this module?)', () => {
  function handlerFor(moduleId: string) {
    class Route {
      @OperatesModule(moduleId)
      handle() {}
    }
    return Route.prototype.handle;
  }
  const LAURA = 'laura@cafecentral.co';
  async function run(setup: ReturnType<typeof setupAdminAccess>, email: string, businessId: string, moduleId = 'turnos') {
    const { started } = await setup.signIn({ email });
    const request: Partial<AdminRequest> = { adminSession: started.session, params: { businessId } };
    const allowed = await new OperatorModuleGuard(new Reflector(), setup.grants).canActivate(contextFor(request, handlerFor(moduleId)));
    return { allowed, request };
  }
  function withOperator() {
    const setup = setupAdminAccess();
    setup.directory.set({ ...setup.business, modules: ['turnos'] });
    setup.memberSource.assign(LAURA, { businessId: setup.business.id, moduleId: 'turnos', role: 'operator', personName: 'Laura Gómez' });
    return setup;
  }

  it('lets through an assigned operator and leaves their grant on the request', async () => {
    const setup = withOperator();
    const { allowed, request } = await run(setup, LAURA, setup.business.id);
    assert.equal(allowed, true);
    assert.equal(request.accessGrant?.role, 'operator');
  });

  it('does not let an administrator in just for being the boss, and answers 404 like for any business that is not theirs', async () => {
    const setup = withOperator();
    await assert.rejects(run(setup, setup.business.boss.email, setup.business.id), BusinessNotAdministeredError);
  });

  it('answers 404 for another business, an unknown one, another module, and once the assignment, the module or the business is gone', async () => {
    const setup = withOperator();
    const { started } = await setup.signIn({ email: LAURA });
    const guard = new OperatorModuleGuard(new Reflector(), setup.grants);
    const check = (businessId = setup.business.id, moduleId = 'turnos') =>
      guard.canActivate(contextFor({ adminSession: started.session, params: { businessId } }, handlerFor(moduleId)));
    assert.equal(await check(), true);
    await assert.rejects(check('e'.repeat(24)), BusinessNotAdministeredError, 'another business');
    await assert.rejects(check(setup.business.id, 'reservas'), BusinessNotAdministeredError, 'another module');
    setup.directory.set({ ...setup.business, modules: [] });
    await assert.rejects(check(), BusinessNotAdministeredError, 'module disabled');
    setup.directory.set({ ...setup.business, modules: ['turnos'], status: 'paused' });
    await assert.rejects(check(), BusinessNotAdministeredError, 'business paused');
    setup.directory.set({ ...setup.business, modules: ['turnos'] });
    assert.equal(await check(), true);
    setup.memberSource.remove(LAURA, setup.business.id);
    await assert.rejects(check(), BusinessNotAdministeredError, 'assignment removed');
  });

  it('answers 401 when no session was checked before it', async () => {
    const setup = withOperator();
    await assert.rejects(new OperatorModuleGuard(new Reflector(), setup.grants).canActivate(contextFor({ params: { businessId: setup.business.id } }, handlerFor('turnos'))), UnauthorizedException);
  });

  it('an operator is never let into an administrator route of the same business', async () => {
    const setup = withOperator();
    const { started } = await setup.signIn({ email: LAURA });
    const route = (() => { class R { @RequiresBusinessModule('turnos') handle() {} } return R.prototype.handle; })();
    const guard = new BusinessModuleGuard(new Reflector(), setup.administered);
    await assert.rejects(guard.canActivate(contextFor({ adminSession: started.session, params: { businessId: setup.business.id } }, route)), BusinessNotAdministeredError);
  });
});
