import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InvalidLogoError,
  InvalidScheduleError,
  LogoNotFoundError,
  ModuleNotAssignedError,
  SetupBusinessNotFoundError,
  SetupIncompleteError,
  TurnosNotAssignedError,
} from '../domain/errors';
import { ModuleSetupStatusSource, type ModuleSetupStatus } from '../domain/module-setup-status';
import { defaultWeekSchedule } from '../domain/week-schedule';
import { aWeek, BOSS_EMAIL, BUSINESS_ID, NIGHT_SHIFT, OTHER_BUSINESS_ID, setupBusinessSetup } from '../fakes.spec';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
const LUIS = 'luis@libreriasur.co';
const form = {
  contact: {
    name: 'Café Central Chapinero',
    legalName: 'Café Central Chapinero S.A.S.',
    taxId: '900999888-1',
    phone: '+573105550000',
    address: 'Carrera 13 # 60-10',
    supportEmail: 'chapinero@cafecentral.co',
    website: 'https://cafecentral.co/chapinero',
  },
  description: 'Café de especialidad en el corazón de Chapinero.',
};

describe('setup: the modules assigned to the business', () => {
  it('shows only the modules the owner enabled for this business, in catalog order', async () => {
    const { service } = setupBusinessSetup();
    const state = await service.get(BOSS_EMAIL, BUSINESS_ID);
    assert.deepEqual(state.modules.map((module) => module.id), ['reservas', 'turnos']);
    const luis = await service.get(LUIS, OTHER_BUSINESS_ID);
    assert.deepEqual(luis.modules.map((module) => module.id), ['inventario']);
  });

  it('follows the owner: a module enabled or disabled later appears or disappears, and an empty selection is valid', async () => {
    const { service, profiles } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['pedidos'];
    assert.deepEqual((await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.map((module) => module.id), ['pedidos']);
    profiles.businesses.get(BUSINESS_ID)!.modules = [];
    assert.deepEqual((await service.get(BOSS_EMAIL, BUSINESS_ID)).modules, []);
  });

  it('never lets the administrator change the assignments: saving the form leaves modules, currency and time zone as the owner set them', async () => {
    const { service, profiles } = setupBusinessSetup();
    await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form);
    await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'retail', null, null);
    const business = profiles.businesses.get(BUSINESS_ID)!;
    assert.deepEqual(business.modules, ['turnos', 'reservas']);
    assert.equal(business.currency, 'COP');
    assert.equal(business.timezone, 'America/Bogota');
  });
});

describe('setup: isolation between businesses and permissions', () => {
  it('answers not-found to every operation when the administrator is not the boss of that business, and writes nothing', async () => {
    const { service, repository, profiles } = setupBusinessSetup();
    const before = structuredClone(profiles.businesses.get(BUSINESS_ID));
    const calls: Array<() => Promise<unknown>> = [
      () => service.get(LUIS, BUSINESS_ID),
      () => service.saveProfile(LUIS, BUSINESS_ID, form),
      () => service.saveCategory(LUIS, BUSINESS_ID, 'retail', null, null),
      () => service.saveBaseSchedule(LUIS, BUSINESS_ID, defaultWeekSchedule()),
      () => service.saveModuleSchedule(LUIS, BUSINESS_ID, 'turnos', { inherit: false }),
      () => service.uploadLogo(LUIS, BUSINESS_ID, { bytes: PNG, declaredType: 'image/png' }),
      () => service.removeLogo(LUIS, BUSINESS_ID),
      () => service.getLogo(LUIS, BUSINESS_ID),
      () => service.saveProgress(LUIS, BUSINESS_ID, 'schedule'),
      () => service.complete(LUIS, BUSINESS_ID),
    ];
    for (const call of calls) await assert.rejects(call(), SetupBusinessNotFoundError);
    assert.equal(repository.items.size, 0);
    assert.deepEqual(profiles.businesses.get(BUSINESS_ID), before);
  });

  it('answers the same for a business that does not exist and for one that is someone else\'s', async () => {
    const { service } = setupBusinessSetup();
    await assert.rejects(service.get(BOSS_EMAIL, 'f'.repeat(24)), SetupBusinessNotFoundError);
    await assert.rejects(service.get(BOSS_EMAIL, OTHER_BUSINESS_ID), SetupBusinessNotFoundError);
  });

  it('keeps the setup of each business apart, even for a boss of two businesses', async () => {
    const { service, profiles } = setupBusinessSetup();
    const second = 'c'.repeat(24);
    profiles.add({ ...profiles.businesses.get(BUSINESS_ID)!, id: second, name: 'Café Central Norte' }, BOSS_EMAIL);
    await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form);
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    await service.complete(BOSS_EMAIL, BUSINESS_ID);
    const other = await service.get(BOSS_EMAIL, second);
    assert.equal(other.description, null);
    assert.equal(other.business.name, 'Café Central Norte');
    assert.equal(other.baseScheduleSaved, false);
    assert.equal(other.progress.baseReady, false);
  });

  it('closes the door at once when the business is paused or the boss is replaced', async () => {
    const { service, profiles } = setupBusinessSetup();
    await service.get(BOSS_EMAIL, BUSINESS_ID);
    profiles.businesses.get(BUSINESS_ID)!.status = 'paused';
    await assert.rejects(service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form), SetupBusinessNotFoundError);
    profiles.businesses.get(BUSINESS_ID)!.status = 'active';
    await service.get(BOSS_EMAIL, BUSINESS_ID);
    profiles.bosses.set(BUSINESS_ID, 'nuevo@cafecentral.co');
    await assert.rejects(service.get(BOSS_EMAIL, BUSINESS_ID), SetupBusinessNotFoundError);
    await assert.rejects(service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek()), SetupBusinessNotFoundError);
  });

  it('refuses to configure a module that is not assigned, whether it exists in the catalog or not, and writes nothing', async () => {
    const { service, repository } = setupBusinessSetup();
    await assert.rejects(service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'inventario', { inherit: false }), ModuleNotAssignedError);
    await assert.rejects(service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'facturacion', { inherit: true }), ModuleNotAssignedError);
    assert.equal(new ModuleNotAssignedError().code, 'module-not-enabled');
    assert.equal(repository.items.size, 0);
  });
});

describe('setup: business data, description and type', () => {
  it('starts from the data the owner registered, without copying it', async () => {
    const { service, repository } = setupBusinessSetup();
    const state = await service.get(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(state.business.name, 'Café Central');
    assert.equal(state.business.legalName, 'Café Central S.A.S.');
    assert.equal(state.business.taxId, '900123456-7');
    assert.equal(state.business.supportEmail, 'hola@cafecentral.co');
    assert.equal(state.business.currency, 'COP');
    assert.equal(state.business.timezone, 'America/Bogota');
    assert.equal(state.description, null);
    assert.equal(repository.items.size, 0, 'reading creates nothing');
  });

  it('writes the form on the SAME business the owner sees, and keeps the description with the setup', async () => {
    const { service, profiles, repository } = setupBusinessSetup();
    const state = await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form);
    const business = profiles.businesses.get(BUSINESS_ID)!;
    assert.equal(business.name, 'Café Central Chapinero');
    assert.equal(business.taxId, '900999888-1');
    assert.equal(state.business.name, 'Café Central Chapinero');
    assert.equal(state.description, form.description);
    assert.equal(repository.items.get(BUSINESS_ID)!.description, form.description);
    assert.ok(!('name' in repository.items.get(BUSINESS_ID)!), 'the setup holds no copy of the business data');
  });

  it('replaces the form: a field left blank is cleared, and the description can be cleared too', async () => {
    const { service } = setupBusinessSetup();
    await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form);
    const state = await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, {
      contact: { ...form.contact, website: null, address: null, phone: null },
      description: null,
    });
    assert.equal(state.business.website, null);
    assert.equal(state.business.address, null);
    assert.equal(state.business.phone, null);
    assert.equal(state.description, null);
  });

  it('keeps the type of business, and the text of "other" only for "other"', async () => {
    const { service } = setupBusinessSetup();
    assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).business.category, 'gastronomy');
    const other = await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'other', 'Estudio de tatuajes', null);
    assert.equal(other.business.category, 'other');
    assert.equal(other.business.categoryOther, 'Estudio de tatuajes');
    const back = await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'retail', 'texto que debe descartarse', null);
    assert.equal(back.business.categoryOther, null);
  });
});

describe('setup: schedules (own or inherited)', () => {
  it('shows the default schedule until someone saves one, and the default is not marked as saved', async () => {
    const { service } = setupBusinessSetup();
    const state = await service.get(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(state.baseScheduleSaved, false);
    assert.deepEqual(state.baseSchedule, defaultWeekSchedule());
    assert.ok(state.modules.every((module) => module.inherit));
  });

  it('saves the schedule of the business and it is still there after signing out and back in', async () => {
    const { service, reopen } = setupBusinessSetup();
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    const again = await reopen().get(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(again.baseScheduleSaved, true);
    assert.deepEqual(again.baseSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }]);
    assert.equal(again.baseSchedule.sat.open, false);
  });

  it('rejects an invalid schedule with the field of each problem and keeps the previous one', async () => {
    const { service } = setupBusinessSetup();
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    const broken = aWeek({ open: true, ranges: [{ start: '10:00', end: '09:00' }, { start: '08:00', end: '11:00' }] });
    await assert.rejects(service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, broken), (error: unknown) => {
      assert.ok(error instanceof InvalidScheduleError);
      assert.ok(error.fields['schedule.mon.ranges.0.end']);
      return true;
    });
    assert.deepEqual((await service.get(BOSS_EMAIL, BUSINESS_ID)).baseSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }]);
  });

  it('makes a module that inherits follow every change of the business schedule', async () => {
    const { service } = setupBusinessSetup();
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    const turnos = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.find((module) => module.id === 'turnos')!;
    assert.equal(turnos.inherit, true);
    assert.deepEqual(turnos.effectiveSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }]);
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek(NIGHT_SHIFT));
    const after = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.find((module) => module.id === 'turnos')!;
    assert.deepEqual(after.effectiveSchedule.mon.ranges, NIGHT_SHIFT.ranges);
  });

  it('keeps the exceptions: a module with its own schedule is not touched by changes to the business schedule', async () => {
    const { service } = setupBusinessSetup();
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'reservas', { inherit: false, schedule: aWeek(NIGHT_SHIFT) });
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    const state = await service.get(BOSS_EMAIL, BUSINESS_ID);
    const reservas = state.modules.find((module) => module.id === 'reservas')!;
    const turnos = state.modules.find((module) => module.id === 'turnos')!;
    assert.equal(reservas.inherit, false);
    assert.deepEqual(reservas.effectiveSchedule.mon.ranges, NIGHT_SHIFT.ranges);
    assert.deepEqual(turnos.effectiveSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }], 'the other module still follows the business');
  });

  it('keeps the own schedule while the module inherits, so going back to it loses nothing', async () => {
    const { service } = setupBusinessSetup();
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'reservas', { inherit: false, schedule: aWeek(NIGHT_SHIFT) });
    const inheriting = await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'reservas', { inherit: true });
    const view = inheriting.modules.find((module) => module.id === 'reservas')!;
    assert.equal(view.inherit, true);
    assert.deepEqual(view.effectiveSchedule, inheriting.baseSchedule);
    assert.deepEqual(view.ownSchedule?.mon.ranges, NIGHT_SHIFT.ranges);
    const back = await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'reservas', { inherit: false });
    assert.deepEqual(back.modules.find((module) => module.id === 'reservas')!.effectiveSchedule.mon.ranges, NIGHT_SHIFT.ranges);
  });

  it('starts a module\'s own schedule as a copy of the business one at that moment, which no longer follows it', async () => {
    const { service } = setupBusinessSetup();
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'turnos', { inherit: false });
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek(NIGHT_SHIFT));
    const turnos = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.find((module) => module.id === 'turnos')!;
    assert.deepEqual(turnos.effectiveSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }]);
  });

  it('rejects an invalid schedule of a module and keeps how it was', async () => {
    const { service } = setupBusinessSetup();
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'turnos', { inherit: false, schedule: aWeek() });
    const overlapping = aWeek({ open: true, ranges: [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '14:00' }] });
    await assert.rejects(service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'turnos', { inherit: false, schedule: overlapping }), InvalidScheduleError);
    const turnos = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.find((module) => module.id === 'turnos')!;
    assert.deepEqual(turnos.effectiveSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }]);
  });

  it('survives signing out and back in, including the exceptions', async () => {
    const { service, reopen } = setupBusinessSetup();
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'reservas', { inherit: false, schedule: aWeek(NIGHT_SHIFT) });
    const again = await reopen().get(BOSS_EMAIL, BUSINESS_ID);
    assert.deepEqual(again.modules.map((module) => [module.id, module.inherit]), [['reservas', false], ['turnos', true]]);
  });

  it('ignores the schedule of a module that is no longer assigned, and brings it back if it is assigned again', async () => {
    const { service, profiles } = setupBusinessSetup();
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'reservas', { inherit: false, schedule: aWeek(NIGHT_SHIFT) });
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos'];
    assert.deepEqual((await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.map((module) => module.id), ['turnos']);
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos', 'reservas'];
    const reservas = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules.find((module) => module.id === 'reservas')!;
    assert.equal(reservas.inherit, false);
  });

  it('evaluates "open now" in the time zone of the business', async () => {
    const { service, profiles } = setupBusinessSetup(); // the clock is Wednesday 10:00 in Bogotá
    assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).baseOpenNow, true);
    profiles.businesses.get(BUSINESS_ID)!.timezone = 'Asia/Tokyo'; // the same instant is Thursday 00:00 there
    const state = await service.get(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(state.baseOpenNow, false);
    assert.ok(state.modules.every((module) => module.openNow === false));
  });
});

describe('setup: logo', () => {
  it('stores a PNG, serves it back and reports it without the bytes', async () => {
    const { service } = setupBusinessSetup();
    const state = await service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: PNG, declaredType: 'image/png' });
    assert.equal(state.logo?.contentType, 'image/png');
    assert.equal(state.logo?.sizeBytes, PNG.length);
    assert.deepEqual(await (await service.getLogo(BOSS_EMAIL, BUSINESS_ID)).bytes, PNG);
  });

  it('refuses a file that is not a PNG or JPG, or too large, and keeps the previous logo', async () => {
    const { service } = setupBusinessSetup();
    await service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: PNG, declaredType: 'image/png' });
    await assert.rejects(service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: new TextEncoder().encode('<svg/>'), declaredType: 'image/png' }), InvalidLogoError);
    await assert.rejects(service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: new Uint8Array(1_048_577), declaredType: 'image/png' }), InvalidLogoError);
    assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).logo?.sizeBytes, PNG.length);
  });

  it('removes the logo, and removing it twice is not an error', async () => {
    const { service } = setupBusinessSetup();
    await service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: PNG, declaredType: 'image/png' });
    assert.equal((await service.removeLogo(BOSS_EMAIL, BUSINESS_ID)).logo, null);
    assert.equal((await service.removeLogo(BOSS_EMAIL, BUSINESS_ID)).logo, null);
    await assert.rejects(service.getLogo(BOSS_EMAIL, BUSINESS_ID), LogoNotFoundError);
  });

  it('never serves the logo of one business to the boss of another', async () => {
    const { service } = setupBusinessSetup();
    await service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: PNG, declaredType: 'image/png' });
    await assert.rejects(service.getLogo(LUIS, BUSINESS_ID), SetupBusinessNotFoundError);
    await assert.rejects(service.getLogo(LUIS, OTHER_BUSINESS_ID), LogoNotFoundError, 'his own business simply has no logo');
  });
});

describe('setup: progress and saving the base', () => {
  it('remembers the step and the visited ones, and they are there after signing out and back in', async () => {
    const { service, reopen } = setupBusinessSetup();
    await service.saveProgress(BOSS_EMAIL, BUSINESS_ID, 'data');
    await service.saveProgress(BOSS_EMAIL, BUSINESS_ID, 'schedule');
    await service.saveProgress(BOSS_EMAIL, BUSINESS_ID, 'data');
    const { progress } = await reopen().get(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(progress.currentStep, 'data');
    assert.deepEqual(progress.visitedSteps, ['data', 'schedule']);
    assert.equal(progress.baseReady, false);
  });

  it('recovers everything saved halfway: form, description, type, hours and the module exception', async () => {
    const { service, reopen } = setupBusinessSetup();
    await service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form);
    await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'other', 'Café y coworking', null);
    await service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek());
    await service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'turnos', { inherit: false, schedule: aWeek(NIGHT_SHIFT) });
    await service.saveProgress(BOSS_EMAIL, BUSINESS_ID, 'category');
    const state = await reopen().get(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(state.business.name, form.contact.name);
    assert.equal(state.description, form.description);
    assert.equal(state.business.categoryOther, 'Café y coworking');
    assert.deepEqual(state.baseSchedule.mon.ranges, [{ start: '07:00', end: '16:00' }]);
    assert.equal(state.modules.find((module) => module.id === 'turnos')!.inherit, false);
    assert.equal(state.progress.currentStep, 'category');
    assert.equal(state.progress.baseReady, false, 'saving progress never marks the base as ready');
  });

  it('marks only the base as ready: the module settings are not part of it', async () => {
    const { service } = setupBusinessSetup();
    const state = await service.complete(BOSS_EMAIL, BUSINESS_ID);
    assert.equal(state.progress.baseReady, true);
    assert.ok(state.progress.baseReadyAt);
    assert.equal(state.progress.currentStep, 'review');
    for (const module of state.modules) {
      assert.deepEqual(Object.keys(module).sort(), ['description', 'effectiveSchedule', 'id', 'inherit', 'name', 'openNow', 'ownSchedule', 'settings']);
      assert.equal(module.settings.status, 'pending', 'saving the base never marks the settings of a module as ready');
    }
  });

  it('keeps the original date when the base is saved again without changes', async () => {
    const { service, clock } = setupBusinessSetup();
    const first = await service.complete(BOSS_EMAIL, BUSINESS_ID);
    clock.advance(60 * 60_000);
    const second = await service.complete(BOSS_EMAIL, BUSINESS_ID);
    assert.deepEqual(second.progress.baseReadyAt, first.progress.baseReadyAt);
  });

  it('is no longer ready after any change to the base, but not after only moving between steps', async () => {
    const changes: Array<[string, (service: ReturnType<typeof setupBusinessSetup>['service']) => Promise<unknown>]> = [
      ['form', (service) => service.saveProfile(BOSS_EMAIL, BUSINESS_ID, form)],
      ['type', (service) => service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'retail', null, null)],
      ['business hours', (service) => service.saveBaseSchedule(BOSS_EMAIL, BUSINESS_ID, aWeek())],
      ['module hours', (service) => service.saveModuleSchedule(BOSS_EMAIL, BUSINESS_ID, 'turnos', { inherit: false })],
      ['logo', (service) => service.uploadLogo(BOSS_EMAIL, BUSINESS_ID, { bytes: PNG, declaredType: 'image/png' })],
      ['logo removal', (service) => service.removeLogo(BOSS_EMAIL, BUSINESS_ID)],
    ];
    for (const [name, change] of changes) {
      const { service } = setupBusinessSetup();
      await service.complete(BOSS_EMAIL, BUSINESS_ID);
      await change(service);
      assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).progress.baseReady, false, name);
    }
    const { service } = setupBusinessSetup();
    await service.complete(BOSS_EMAIL, BUSINESS_ID);
    await service.saveProgress(BOSS_EMAIL, BUSINESS_ID, 'data');
    assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).progress.baseReady, true);
  });

  it('refuses to mark the base as ready when something it holds is not valid, and says what', async () => {
    const { service, profiles } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.category = 'other'; // "other" without its description
    await assert.rejects(service.complete(BOSS_EMAIL, BUSINESS_ID), (error: unknown) => {
      assert.ok(error instanceof SetupIncompleteError);
      assert.ok(error.fields['category.categoryOther']);
      return true;
    });
    assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).progress.baseReady, false);
  });
});

describe('setup: the attention profile of Turnos (chosen here, stored by Turnos)', () => {
  it('offers the profile only to a business that has Turnos, with the one its category suggests', async () => {
    const { service, profiles } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['reservas'];
    assert.equal((await service.get(BOSS_EMAIL, BUSINESS_ID)).turnos, null, 'no Turnos, no profile to choose');
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos'];
    const info = (await service.get(BOSS_EMAIL, BUSINESS_ID)).turnos!;
    assert.equal(info.suggested, 'restaurant', 'gastronomy suggests restaurant');
    assert.equal(info.profile, 'restaurant', 'nothing chosen yet: the suggested one is shown');
    assert.deepEqual(info.options.map((option) => option.id), ['clinic', 'restaurant', 'bank', 'salon', 'custom']);
  });

  it('chooses the profile with the category step and keeps it after signing out and back in', async () => {
    const { service, reopen, profiles, turnos } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos'];
    const state = await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'health-wellness', null, 'clinic');
    assert.equal(state.turnos?.profile, 'clinic');
    assert.equal(turnos.chosen.get(BUSINESS_ID), 'clinic');
    assert.equal((await reopen().get(BOSS_EMAIL, BUSINESS_ID)).turnos?.profile, 'clinic');
  });

  it('refuses a profile for a business without Turnos and changes nothing', async () => {
    const { service, profiles, turnos } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['reservas'];
    await assert.rejects(service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'retail', null, 'bank'), TurnosNotAssignedError);
    assert.equal(profiles.businesses.get(BUSINESS_ID)!.category, 'gastronomy');
    assert.equal(turnos.chosen.size, 0);
  });

  it('does not let the boss of another business choose a profile', async () => {
    const { service, turnos, profiles } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos'];
    await assert.rejects(service.saveCategory(LUIS, BUSINESS_ID, 'retail', null, 'bank'), SetupBusinessNotFoundError);
    assert.equal(turnos.chosen.size, 0);
  });

  it('saving the category without a profile leaves the chosen one as it was', async () => {
    const { service, profiles } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos'];
    await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'retail', null, 'salon');
    const state = await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'other', 'Estudio', null);
    assert.equal(state.turnos?.profile, 'salon');
  });

  it('shows the module as ready (with its counts) once Turnos says its configuration is saved', async () => {
    const { service, profiles, turnos } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos', 'reservas'];
    const before = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules;
    assert.deepEqual(before.map((module) => [module.id, module.settings.status]), [['reservas', 'pending'], ['turnos', 'pending']]);
    turnos.statuses.set(BUSINESS_ID, { ready: true, queueCount: 2, operatorCount: 3 });
    const after = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules;
    assert.deepEqual(after.find((module) => module.id === 'turnos')!.settings, { status: 'ready', summary: { queueCount: 2, operatorCount: 3 } });
    assert.equal(after.find((module) => module.id === 'reservas')!.settings.status, 'pending');
  });

  it('changing the category invalidates the saved base, like any other change', async () => {
    const { service, profiles } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['turnos'];
    await service.complete(BOSS_EMAIL, BUSINESS_ID);
    const state = await service.saveCategory(BOSS_EMAIL, BUSINESS_ID, 'gastronomy', null, 'bank');
    assert.equal(state.progress.baseReady, false);
  });
});

describe('setup: registered module status sources (IoC registry)', () => {
  it('populates settings.status and settings.summary for pedidos from a registered ModuleSetupStatusSource', async () => {
    const { service, profiles, statusRegistry } = setupBusinessSetup();
    profiles.businesses.get(BUSINESS_ID)!.modules = ['pedidos', 'reservas'];

    let pedidosStatus: ModuleSetupStatus = { ready: false, summary: { modalityCount: 2, operatorCount: 0 } };
    class FakePedidosStatusSource extends ModuleSetupStatusSource {
      readonly moduleId = 'pedidos';
      async statusOf(_businessId: string): Promise<ModuleSetupStatus> {
        return pedidosStatus;
      }
    }
    statusRegistry.register(new FakePedidosStatusSource());

    const before = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules;
    assert.deepEqual(before.find((module) => module.id === 'pedidos')!.settings, {
      status: 'pending',
      summary: { modalityCount: 2, operatorCount: 0 },
    });
    assert.deepEqual(before.find((module) => module.id === 'reservas')!.settings, { status: 'pending', summary: null });

    pedidosStatus = { ready: true, summary: { modalityCount: 3, operatorCount: 2 } };
    const after = (await service.get(BOSS_EMAIL, BUSINESS_ID)).modules;
    assert.deepEqual(after.find((module) => module.id === 'pedidos')!.settings, {
      status: 'ready',
      summary: { modalityCount: 3, operatorCount: 2 },
    });
  });
});
