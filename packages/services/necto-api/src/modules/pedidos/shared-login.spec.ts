import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  BusinessModuleGuard,
  OperatesModule,
  OperatorModuleGuard,
  RequiresBusinessModule,
  type AdminRequest,
} from '../business-access/api/business-admin.guards';
import { BusinessNotAdministeredError, EmailNotAssignedError, SessionExpiredError } from '../business-access/domain/errors';
import { setupAdminAccess } from '../business-access/fakes.spec';
import { TurnosConfigurationService } from '../turnos/application/turnos-configuration.service';
import { TurnosConfigurationStore } from '../turnos/application/turnos-configuration.store';
import { TurnosOperatorAccessSource } from '../turnos/application/turnos-operator-access.source';
import { buildTurnos, operatorInput as turnosOperatorInput } from '../turnos/fakes.spec';
import { PedidosConfigurationService } from './application/pedidos-configuration.service';
import { PedidosConfigurationStore } from './application/pedidos-configuration.store';
import { PedidosOperatorAccessSource } from './application/pedidos-operator-access.source';
import { PedidosOperatorService } from './application/pedidos-operator.service';
import {
  FakeAdministeredProfiles,
  FakeBusinessScheduleReader,
  InMemoryPedidosConfigurationRepository,
} from './fakes.spec';

const LAURA = 'laura@cafecentral.co';
const ANA = 'ana@cafecentral.co';

function setupDualModule() {
  const access = setupAdminAccess();
  access.directory.set({ ...access.business, modules: ['turnos', 'pedidos'] });
  const businessId = access.business.id;

  // Wire Turnos
  const wired = buildTurnos(access.directory as never, access.clock, access.registry);
  const turnosRepo = wired.repository;
  const turnos = wired.service;
  wired.source.onModuleInit();

  // Wire Pedidos
  const pedidosRepo = new InMemoryPedidosConfigurationRepository();
  const pedidosStore = new PedidosConfigurationStore(pedidosRepo, access.clock);
  const profiles = new FakeAdministeredProfiles(access.directory as never);
  const scheduleReader = new FakeBusinessScheduleReader();
  const pedidos = new PedidosConfigurationService(pedidosStore, profiles, scheduleReader);
  const pedidosOperators = new PedidosOperatorService(pedidosStore, access.directory, scheduleReader);
  new PedidosOperatorAccessSource(pedidosRepo, access.registry).onModuleInit();

  const context = (request: Partial<AdminRequest>, handler: () => void): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => class {} }) as unknown as ExecutionContext;

  const makeRoute = (decorator: MethodDecorator) => {
    class Route {
      handle() {}
    }
    decorator(Route.prototype, 'handle', Object.getOwnPropertyDescriptor(Route.prototype, 'handle')!);
    return Route.prototype.handle;
  };

  const pedidosAdminRoute = makeRoute(RequiresBusinessModule('pedidos'));
  const pedidosOperatorRoute = makeRoute(OperatesModule('pedidos'));
  const turnosOperatorRoute = makeRoute(OperatesModule('turnos'));

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
      configurePedidos: await attempt(new BusinessModuleGuard(new Reflector(), access.administered), pedidosAdminRoute),
      operatePedidos: await attempt(new OperatorModuleGuard(new Reflector(), access.grants), pedidosOperatorRoute),
      operateTurnos: await attempt(new OperatorModuleGuard(new Reflector(), access.grants), turnosOperatorRoute),
    };
  }

  async function addPedidosOperator(email = LAURA, name = 'Laura Pedidos') {
    const created = await pedidos.createOperator(ANA, businessId, {
      name,
      email,
      stages: ['confirmation', 'dispatch'],
    });
    return created.created!.id;
  }

  async function addTurnosOperator(email = LAURA, name = 'Laura Turnos') {
    const state = await turnos.get(businessId);
    const created = await turnos.createOperator(businessId, turnosOperatorInput(name, email, [state.configuration.queues[0].id]));
    return created.created!.id;
  }

  return { access, businessId, pedidos, pedidosOperators, turnos, can, addPedidosOperator, addTurnosOperator };
}

describe('Pedidos shared OTP login and dual-module (turnos + pedidos) operator grants', () => {
  it('allows a Pedidos operator to sign in via OTP and operate Pedidos without admin permissions', async () => {
    const world = setupDualModule();
    await assert.rejects(world.access.login.requestCode({ email: LAURA, ip: '203.0.113.5' }), EmailNotAssignedError);

    await world.addPedidosOperator();
    const { started, grant } = await world.access.signIn({ email: LAURA });
    assert.deepEqual(
      grant.accesses.map((a) => ({ key: a.key, role: a.role, modules: a.modules, personName: a.personName })),
      [{ key: `${world.businessId}:operator:pedidos`, role: 'operator', modules: ['pedidos'], personName: 'Laura Pedidos' }],
    );
    assert.deepEqual(grant.businesses, []);
    assert.deepEqual(await world.can(started.session), {
      configurePedidos: false,
      operatePedidos: true,
      operateTurnos: false,
    });

    const view = await world.pedidosOperators.view(LAURA, world.businessId);
    assert.equal(view.operator.email, LAURA);
    assert.deepEqual(view.operator.stages, ['confirmation', 'dispatch']);
  });

  it('grants two distinct AccessGrants when the same email operates BOTH turnos and pedidos in the same business', async () => {
    const world = setupDualModule();
    const pedidosOpId = await world.addPedidosOperator(LAURA, 'Laura Pedidos');
    await world.addTurnosOperator(LAURA, 'Laura Turnos');

    const { started, grant } = await world.access.signIn({ email: LAURA });
    assert.deepEqual(
      grant.accesses.map((a) => ({ key: a.key, role: a.role, modules: a.modules, personName: a.personName })),
      [
        { key: `${world.businessId}:operator:pedidos`, role: 'operator', modules: ['pedidos'], personName: 'Laura Pedidos' },
        { key: `${world.businessId}:operator:turnos`, role: 'operator', modules: ['turnos'], personName: 'Laura Turnos' },
      ],
    );
    assert.deepEqual(await world.can(started.session), {
      configurePedidos: false,
      operatePedidos: true,
      operateTurnos: true,
    });

    // Removing the Pedidos operator revokes ONLY Pedidos; Turnos remains active in the same session!
    await world.pedidos.deleteOperator(ANA, world.businessId, pedidosOpId);
    assert.deepEqual(await world.can(started.session), {
      configurePedidos: false,
      operatePedidos: false,
      operateTurnos: true,
    });
    const refreshed = await world.access.sessions.refresh(started.cookieValue);
    assert.deepEqual(
      refreshed.accesses.map((a) => a.key),
      [`${world.businessId}:operator:turnos`],
    );
  });

  it('revokes Pedidos access when Pedidos is disabled on the business, while keeping Turnos active', async () => {
    const world = setupDualModule();
    await world.addPedidosOperator();
    await world.addTurnosOperator();
    const { started } = await world.access.signIn({ email: LAURA });

    world.access.directory.set({ ...world.access.business, modules: ['turnos'] });
    assert.deepEqual(await world.can(started.session), {
      configurePedidos: false,
      operatePedidos: false,
      operateTurnos: true,
    });

    world.access.directory.set({ ...world.access.business, modules: [] });
    await assert.rejects(world.access.sessions.refresh(started.cookieValue), SessionExpiredError);
  });
});
