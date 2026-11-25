import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SetupBusinessNotFoundError } from '../domain/errors';
import { ModuleSetupStatusSource } from '../domain/module-setup-status';
import { BOSS_EMAIL, BUSINESS_ID, OTHER_BUSINESS_ID, aWeek, setupBusinessSetup } from '../fakes.spec';
import { BusinessSetupOverviewService } from './business-setup-overview.service';

const form = {
  contact: { name: 'Café Central', legalName: null, taxId: null, phone: '+573001234567', address: 'Calle 1 # 2-3', supportEmail: null, website: null },
  description: 'Café',
};
describe('how far the setup of a business is, for the dashboard', () => {
  function overviewOf() {
    const world = setupBusinessSetup();
    return { ...world, overview: new BusinessSetupOverviewService(world.service, world.statusRegistry) };
  }
  it('lists the modules assigned to the business and nothing else, with their real state', async () => {
    const { overview, turnos } = overviewOf();
    turnos.statuses.set(BUSINESS_ID, { ready: true, queueCount: 2, operatorCount: 1 });
    const result = await overview.overviewOf(BOSS_EMAIL, BUSINESS_ID);
    assert.deepEqual(result.modules.map((module) => module.id), ['reservas', 'turnos'].filter((id) => result.modules.some((module) => module.id === id)));
    const turnosModule = result.modules.find((module) => module.id === 'turnos')!;
    assert.deepEqual([turnosModule.configurable, turnosModule.settings.status, turnosModule.settings.summary], [true, 'ready', { queueCount: 2, operatorCount: 1 }]);
  });
  it('a module with no configuration of its own yet is listed as not configurable, and one that reports its status is', async () => {
    const { overview, statusRegistry } = overviewOf();
    const before = (await overview.overviewOf(BOSS_EMAIL, BUSINESS_ID)).modules.filter((module) => module.id !== 'turnos');
    assert.ok(before.length > 0 && before.every((module) => !module.configurable && module.settings.status === 'pending'));
    class Source extends ModuleSetupStatusSource {
      readonly moduleId = before[0].id;
      async statusOf() {
        return { ready: true, summary: { things: 3 } };
      }
    }
    statusRegistry.register(new Source());
    const after = (await overview.overviewOf(BOSS_EMAIL, BUSINESS_ID)).modules.find((module) => module.id === before[0].id)!;
    assert.deepEqual([after.configurable, after.settings.status, after.settings.summary], [true, 'ready', { things: 3 }]);
  });
  it('says whether the base configuration was saved as ready, and any change of the base takes it back', async () => {
    const { overview, service } = overviewOf();
    assert.equal((await overview.overviewOf(BOSS_EMAIL, BUSINESS_ID)).baseReady, false);
    await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form);
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    await service.complete(BOSS_EMAIL, BUSINESS_ID);
    const ready = await overview.overviewOf(BOSS_EMAIL, BUSINESS_ID);
    assert.deepEqual([ready.baseReady, ready.baseReadyAt instanceof Date], [true, true]);
    await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, { ...form, description: 'Otro' });
    assert.equal((await overview.overviewOf(BOSS_EMAIL, BUSINESS_ID)).baseReady, false);
  });
  it('is for the boss of the business only: someone else, or another business, is not found', async () => {
    const { overview } = overviewOf();
    await assert.rejects(overview.overviewOf('luis@libreriasur.co', BUSINESS_ID), SetupBusinessNotFoundError);
    await assert.rejects(overview.overviewOf(BOSS_EMAIL, OTHER_BUSINESS_ID), SetupBusinessNotFoundError);
    await assert.rejects(overview.overviewOf(BOSS_EMAIL, 'f'.repeat(24)), SetupBusinessNotFoundError);
  });
});
