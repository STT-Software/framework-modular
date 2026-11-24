import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuthenticationGuard } from '../../platform/security/authentication.guard';
import { FixedClock } from '../../platform/time/fixed-clock.spec';
import { BusinessAdminGuard, BusinessAdministeredGuard } from '../business-access/api/business-admin.guards';
import { BusinessSetupOverview, type SetupOverview, type SetupOverviewModule } from '../business-setup/public';
import { TurnosDashboard, type TurnosDashboardSummary } from '../turnos/public';
import { BusinessDashboardController } from './api/business-dashboard.controller';
import { toDashboardResponse } from './api/business-dashboard.response';
import { BusinessDashboardService } from './application/business-dashboard.service';
import { setupProgress } from './domain/dashboard';

const BOSS = 'ana@cafecentral.co';
const module = (id: string, extra: Partial<SetupOverviewModule> = {}): SetupOverviewModule => ({
  id: id as SetupOverviewModule['id'],
  name: id,
  description: id,
  configurable: true,
  settings: { status: 'ready', summary: null },
  openNow: null,
  ...extra,
});
const notReady = { settings: { status: 'pending' as const, summary: null } };
const summary: TurnosDashboardSummary = {
  queues: { total: 2, paused: 0 },
  operators: { total: 3, active: 2, pending: 1, inactive: 0 },
  today: { created: 5, waiting: 1, attending: 1, completed: 3, cancelled: 0, noShow: 0, averageWaitMinutes: 4.5, averageServiceMinutes: null },
  satisfaction: { average: null, responses: 0 },
};
class FakeSetup extends BusinessSetupOverview {
  constructor(public overview: SetupOverview) {
    super();
  }
  async overviewOf(adminEmail: string, businessId: string) {
    if (adminEmail !== BOSS || businessId !== this.overview.business.id) throw new Error('not found');
    return this.overview;
  }
}
class FakeTurnos extends TurnosDashboard {
  calls = 0;
  async summaryOf() {
    this.calls += 1;
    return summary;
  }
}
const overview = (modules: SetupOverviewModule[], baseReady = true): SetupOverview => ({
  business: { id: 'a'.repeat(24), name: 'Café Central', category: 'gastronomy', categoryOther: null, status: 'active', timezone: 'America/Bogota' },
  baseReady,
  baseReadyAt: baseReady ? new Date('2026-03-01T10:00:00Z') : null,
  modules,
});
const service = (setup: SetupOverview) => {
  const turnos = new FakeTurnos();
  return { turnos, dashboard: new BusinessDashboardService(new FakeSetup(setup), turnos, new FixedClock('2026-03-04T15:00:00.000Z')) };
};

describe('where the administrator goes after choosing the business', () => {
  it('to the dashboard when the base and every module that can be configured are ready', () => {
    assert.deepEqual(setupProgress(overview([module('turnos'), module('pedidos')])), { entry: 'dashboard', next: null, pendingModules: [], configurableModules: 2, readyModules: 2 });
  });
  it('to the setup, on the base, while the base is not ready, whatever the modules are', () => {
    assert.deepEqual(setupProgress(overview([module('turnos')], false)).next, { step: 'base' });
    assert.equal(setupProgress(overview([module('turnos')], false)).entry, 'setup');
  });
  it('to the setup of the first module that is missing, once the base is ready', () => {
    const progress = setupProgress(overview([module('turnos'), module('pedidos', notReady), module('reservas', { ...notReady, configurable: true })]));
    assert.deepEqual([progress.entry, progress.next, progress.pendingModules, progress.readyModules], ['setup', { step: 'module', moduleId: 'pedidos' }, ['pedidos', 'reservas'], 1]);
  });
  it('a module that cannot be configured yet never holds the business back, and a business without modules only needs its base', () => {
    assert.equal(setupProgress(overview([module('turnos'), module('reservas', { ...notReady, configurable: false })])).entry, 'dashboard');
    assert.equal(setupProgress(overview([])).entry, 'dashboard');
    assert.equal(setupProgress(overview([], false)).entry, 'setup');
  });
});

describe('the general dashboard', () => {
  it('shows only the modules assigned, with their real state, and the real indicators of Turnos when it is ready', async () => {
    const { dashboard, turnos } = service(overview([module('turnos', { settings: { status: 'ready', summary: { queueCount: 2, operatorCount: 3 } } }), module('reservas', { configurable: false, ...notReady })]));
    const result = await dashboard.get(BOSS, 'a'.repeat(24));
    assert.deepEqual(result.modules.map((item) => [item.id, item.operational, item.configurable, item.indicators !== null]), [['turnos', true, true, true], ['reservas', false, false, false]]);
    assert.deepEqual(result.modules[0].indicators, { turnos: summary });
    assert.equal(turnos.calls, 1, 'Turnos is asked once, and only because it is ready');
    assert.equal(result.entry, 'dashboard');
  });
  it('does not ask for indicators of a module whose configuration is not ready, and invents nothing for the modules that do not run yet', async () => {
    const { dashboard, turnos } = service(overview([module('turnos', notReady), module('pedidos'), module('inventario', { configurable: false, ...notReady })]));
    const result = await dashboard.get(BOSS, 'a'.repeat(24));
    assert.equal(turnos.calls, 0);
    assert.ok(result.modules.every((item) => item.indicators === null));
    assert.deepEqual([result.entry, result.setup.next, result.setup.pendingModules], ['setup', { step: 'module', moduleId: 'turnos' }, ['turnos']]);
  });
  it('is for the boss of the business: anyone else, or another business, is refused by the setup', async () => {
    const { dashboard } = service(overview([module('turnos')]));
    await assert.rejects(dashboard.get('luis@x.co', 'a'.repeat(24)));
    await assert.rejects(dashboard.get(BOSS, 'b'.repeat(24)));
  });
  it('the API shows plain data with ISO dates', async () => {
    const { dashboard } = service(overview([module('turnos')]));
    const response = toDashboardResponse(await dashboard.get(BOSS, 'a'.repeat(24)));
    assert.deepEqual(Object.keys(response).sort(), ['business', 'entry', 'generatedAt', 'modules', 'setup']);
    assert.deepEqual([response.generatedAt, response.setup.baseReadyAt], ['2026-03-04T15:00:00.000Z', '2026-03-01T10:00:00.000Z']);
    assert.deepEqual(Object.keys(response.modules[0]).sort(), ['configurable', 'description', 'id', 'indicators', 'name', 'openNow', 'operational', 'setup']);
  });
  it('the route needs the boss of THAT business, checked on every request: an operator never gets the general dashboard', () => {
    assert.deepEqual(Reflect.getMetadata('__guards__', BusinessDashboardController), [AuthenticationGuard, BusinessAdminGuard, BusinessAdministeredGuard]);
    assert.equal(Reflect.getMetadata('path', BusinessDashboardController), 'dashboard/businesses/:businessId');
  });
});
