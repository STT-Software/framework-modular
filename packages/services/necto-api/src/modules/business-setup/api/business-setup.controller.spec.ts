import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestMethod } from '@nestjs/common';
import { AuthenticationGuard } from '../../../platform/security/authentication.guard';
import { SuperAdminGuard } from '../../../platform/security/super-admin.guard';
import { BusinessAdministeredGuard, BusinessAdminGuard } from '../../business-access/api/business-admin.guards';
import { BusinessesController } from '../../businesses/api/businesses.controller';
import { aWeek, BUSINESS_ID, setupBusinessSetup, BOSS_EMAIL } from '../fakes.spec';
import { BusinessSetupController } from './business-setup.controller';
import { toModulesResponse, toSetupResponse } from './business-setup.response';

const guardsOf = (target: object): unknown[] => Reflect.getMetadata('__guards__', target) ?? [];
const pathOf = (target: object): string => Reflect.getMetadata('path', target);
const methodOf = (target: object): RequestMethod => Reflect.getMetadata('method', target);

describe('who may reach each route', () => {
  it('every route of the setup requires an administrator who administers the business in the URL, in this order', () => {
    assert.deepEqual(guardsOf(BusinessSetupController), [AuthenticationGuard, BusinessAdminGuard, BusinessAdministeredGuard]);
    assert.match(pathOf(BusinessSetupController), /:businessId$/, 'the business always comes in the URL, and the guard checks it');
  });

  it('no route of the setup lets the administrator change which modules the business has', () => {
    const routes = Object.getOwnPropertyNames(BusinessSetupController.prototype).filter((name) => name !== 'constructor');
    const paths = routes.map((name) => `${RequestMethod[methodOf(BusinessSetupController.prototype[name as keyof BusinessSetupController] as object)]} ${pathOf(BusinessSetupController.prototype[name as keyof BusinessSetupController] as object)}`);
    assert.ok(!paths.some((path) => /modules$/.test(path) && !path.startsWith('GET')), `unexpected: ${paths.join(', ')}`);
    assert.ok(paths.includes('PUT schedule/modules/:moduleId'), 'only the hours of an assigned module can be set');
  });

  it('assigning modules (creating or editing a business) belongs to the super admin only', () => {
    assert.deepEqual(guardsOf(BusinessesController), [AuthenticationGuard, SuperAdminGuard]);
    const update = BusinessesController.prototype.update;
    assert.equal(RequestMethod[methodOf(update)], 'PUT');
    assert.equal(RequestMethod[methodOf(BusinessesController.prototype.create)], 'POST');
  });
});

describe('what the API shows of the setup', () => {
  it('shows the business data, the modules with pending settings, the schedules and the progress, and never the logo bytes', async () => {
    const { service } = setupBusinessSetup();
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    await service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: Uint8Array.from([0xff, 0xd8, 0xff, 1, 2]), declaredType: 'image/jpeg' });
    const response = toSetupResponse(await service.get(BOSS_EMAIL, BUSINESS_ID));

    assert.equal(response.business.id, BUSINESS_ID);
    assert.equal(response.profile.legalName, 'Café Central S.A.S.');
    assert.equal(response.category.id, 'gastronomy');
    assert.deepEqual(response.modules.map((module) => [module.id, module.schedule.mode, module.settings.status]), [
      ['reservas', 'inherited', 'pending'],
      ['turnos', 'inherited', 'pending'],
    ]);
    assert.equal(response.schedule.base.saved, true);
    assert.deepEqual(response.schedule.modules.turnos.days, response.schedule.base.days);
    assert.deepEqual(response.logo, {
      contentType: 'image/jpeg',
      sizeBytes: 5,
      updatedAt: '2026-03-04T15:00:00.000Z',
      url: `/business-setup/businesses/${BUSINESS_ID}/logo`,
    });
    assert.deepEqual(response.progress, { currentStep: null, visitedSteps: [], baseReady: false, baseReadyAt: null });
    assert.ok(!JSON.stringify(response).includes('sha256'), 'internal hashes are not exposed');
  });

  it('the first screen lists the assigned modules and whether the base is ready', async () => {
    const { service } = setupBusinessSetup();
    const before = toModulesResponse(await service.get(BOSS_EMAIL, BUSINESS_ID));
    assert.equal(before.baseReady, false);
    assert.deepEqual(before.modules.map((module) => module.id), ['reservas', 'turnos']);
    assert.equal(toModulesResponse(await service.complete(BOSS_EMAIL, BUSINESS_ID)).baseReady, true);
  });
});
