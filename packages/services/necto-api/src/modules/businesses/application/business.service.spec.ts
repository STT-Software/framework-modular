import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventBus } from '../../../platform/events/event-bus';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import type { BusinessDraft } from '../domain/business';
import { BusinessNotFoundError, ConcurrentModificationError, IdempotencyKeyReusedError } from '../domain/errors';
import { BossAssigned } from '../domain/events';
import { InMemoryBusinessRepository } from '../fakes.spec';
import { BusinessDirectoryService, BusinessModuleAccessService } from './business-directory.service';
import { BusinessService } from './business.service';

const OWNER = 'owner-1';
const OTHER_OWNER = 'owner-2';

function draft(overrides: Partial<BusinessDraft['profile']> = {}, boss: Partial<BusinessDraft['boss']> = {}): BusinessDraft {
  return {
    profile: {
      name: 'Café Central',
      legalName: 'Café Central S.A.S.',
      taxId: '900123456-7',
      phone: '+573001234567',
      address: 'Calle 10 # 5-20',
      supportEmail: 'ayuda@cafecentral.co',
      website: 'https://cafecentral.co',
      category: 'gastronomy',
      categoryOther: null,
      currency: 'COP',
      timezone: 'America/Bogota',
      modules: ['reservas', 'pedidos'],
      ...overrides,
    },
    boss: { name: 'Ana Gómez', email: 'ana@cafecentral.co', ...boss },
  };
}

function setup() {
  const repository = new InMemoryBusinessRepository();
  const events = new EventBus();
  const announced: BossAssigned[] = [];
  events.subscribe(BossAssigned, (event) => {
    announced.push(event);
  });
  const service = new BusinessService(repository, events, new FixedClock());
  return { repository, service, announced };
}

describe('BusinessService.create', () => {
  it('creates the business with its boss, owned by the session user, and announces the boss once', async () => {
    const { service, announced } = setup();
    const { business, created } = await service.create(OWNER, draft(), 'key-0000001');

    assert.equal(created, true);
    assert.equal(business.ownerId, OWNER);
    assert.equal(business.status, 'active');
    assert.equal(business.boss.email, 'ana@cafecentral.co');
    assert.ok(business.boss.assignmentId);
    assert.equal(announced.length, 1);
    assert.equal(announced[0].businessId, business.id);
    assert.equal(announced[0].assignmentId, business.boss.assignmentId);
    assert.equal(announced[0].replacedAssignmentId, null);
  });

  it('normalizes the boss email to lowercase without touching dots or suffixes', async () => {
    const { service } = setup();
    const { business } = await service.create(OWNER, draft({}, { email: '  Ana.Gomez+ventas@CafeCentral.co ' }), 'key-0000001');
    assert.equal(business.boss.email, 'ana.gomez+ventas@cafecentral.co');
  });

  it('is safe to repeat: the same key returns the same business and does not announce a second boss', async () => {
    const { service, repository, announced } = setup();
    const first = await service.create(OWNER, draft(), 'key-0000001');
    const second = await service.create(OWNER, draft(), 'key-0000001');

    assert.equal(second.created, false);
    assert.equal(second.business.id, first.business.id);
    assert.equal(repository.items.size, 1);
    assert.equal(announced.length, 1);
  });

  it('refuses the same key with a different request', async () => {
    const { service } = setup();
    await service.create(OWNER, draft(), 'key-0000001');
    await assert.rejects(service.create(OWNER, draft({ name: 'Otro nombre' }), 'key-0000001'), IdempotencyKeyReusedError);
  });

  it('does not require unique names, phones or tax ids: two branches may share them', async () => {
    const { service, repository } = setup();
    await service.create(OWNER, draft(), 'key-0000001');
    await service.create(OWNER, draft(), 'key-0000002');
    await service.create(OTHER_OWNER, draft(), 'key-0000001');
    assert.equal(repository.items.size, 3);
  });

  it('lets the same email be the boss of several businesses', async () => {
    const { service } = setup();
    const a = await service.create(OWNER, draft({ name: 'Sede norte' }), 'key-0000001');
    const b = await service.create(OWNER, draft({ name: 'Sede sur' }), 'key-0000002');
    assert.equal(a.business.boss.email, b.business.boss.email);
    assert.notEqual(a.business.boss.assignmentId, b.business.boss.assignmentId);
  });

  it('keeps the free-text category only for "other"', async () => {
    const { service } = setup();
    const kept = await service.create(OWNER, draft({ category: 'other', categoryOther: 'Floristería' }), 'key-0000001');
    const dropped = await service.create(OWNER, draft({ category: 'retail', categoryOther: 'Floristería' }), 'key-0000002');
    assert.equal(kept.business.categoryOther, 'Floristería');
    assert.equal(dropped.business.categoryOther, null);
  });
});

describe('BusinessService ownership', () => {
  it('shows each super admin only their own businesses, and answers "not found" for someone else\'s', async () => {
    const { service } = setup();
    const mine = await service.create(OWNER, draft({ name: 'Mío' }), 'key-0000001');
    await service.create(OTHER_OWNER, draft({ name: 'Ajeno' }), 'key-0000001');

    const listed = await service.list(OWNER, { page: 1, pageSize: 10 });
    assert.deepEqual(listed.items.map((b) => b.name), ['Mío']);
    await assert.rejects(service.get(OTHER_OWNER, mine.business.id), BusinessNotFoundError);
    await assert.rejects(service.update(OTHER_OWNER, mine.business.id, draft()), BusinessNotFoundError);
    await assert.rejects(service.pause(OTHER_OWNER, mine.business.id), BusinessNotFoundError);
    await assert.rejects(service.resume(OTHER_OWNER, mine.business.id), BusinessNotFoundError);
  });
});

describe('BusinessService.list', () => {
  it('paginates, searches name, boss and address, and filters by category and status', async () => {
    const { service } = setup();
    await service.create(OWNER, draft({ name: 'Café Central', address: 'Calle 10' }), 'key-0000001');
    await service.create(OWNER, draft({ name: 'Boutique Luna', category: 'retail', address: 'Carrera 7' }, { name: 'Luis Pérez', email: 'luis@luna.co' }), 'key-0000002');
    const third = await service.create(OWNER, draft({ name: 'Clínica Sol', category: 'health-wellness' }), 'key-0000003');
    await service.pause(OWNER, third.business.id);

    assert.equal((await service.list(OWNER, { page: 1, pageSize: 2 })).items.length, 2);
    assert.equal((await service.list(OWNER, { page: 2, pageSize: 2 })).items.length, 1);
    assert.equal((await service.list(OWNER, { page: 1, pageSize: 10 })).total, 3);
    assert.deepEqual((await service.list(OWNER, { page: 1, pageSize: 10, q: 'luna' })).items.map((b) => b.name), ['Boutique Luna']);
    assert.deepEqual((await service.list(OWNER, { page: 1, pageSize: 10, q: 'pérez' })).items.map((b) => b.name), ['Boutique Luna']);
    assert.deepEqual((await service.list(OWNER, { page: 1, pageSize: 10, q: 'carrera 7' })).items.map((b) => b.name), ['Boutique Luna']);
    assert.deepEqual((await service.list(OWNER, { page: 1, pageSize: 10, category: 'retail' })).items.map((b) => b.name), ['Boutique Luna']);
    assert.deepEqual((await service.list(OWNER, { page: 1, pageSize: 10, status: 'paused' })).items.map((b) => b.name), ['Clínica Sol']);
  });
});

describe('BusinessService.update', () => {
  it('edits the data keeping the same id and creation date, without creating another business', async () => {
    const { service, repository, announced } = setup();
    const { business } = await service.create(OWNER, draft(), 'key-0000001');
    const updated = await service.update(OWNER, business.id, draft({ name: 'Café Central Norte', modules: ['turnos'] }));

    assert.equal(updated.id, business.id);
    assert.equal(updated.createdAt.getTime(), business.createdAt.getTime());
    assert.equal(updated.name, 'Café Central Norte');
    assert.deepEqual(updated.modules, ['turnos']);
    assert.equal(repository.items.size, 1);
    assert.equal(announced.length, 1);
  });

  it('keeps the boss assignment when only the boss name changes', async () => {
    const { service, announced } = setup();
    const { business } = await service.create(OWNER, draft(), 'key-0000001');
    const updated = await service.update(OWNER, business.id, draft({}, { name: 'Ana María Gómez' }));

    assert.equal(updated.boss.assignmentId, business.boss.assignmentId);
    assert.equal(updated.boss.name, 'Ana María Gómez');
    assert.equal(announced.length, 1, 'no new invitation for the same boss');
  });

  it('replaces the boss when the email changes: a new assignment, and an announcement that names the replaced one', async () => {
    const { service, announced, repository } = setup();
    const { business } = await service.create(OWNER, draft(), 'key-0000001');
    const updated = await service.update(OWNER, business.id, draft({}, { name: 'Luis Pérez', email: 'luis@cafecentral.co' }));

    assert.notEqual(updated.boss.assignmentId, business.boss.assignmentId);
    assert.equal(updated.boss.email, 'luis@cafecentral.co');
    assert.equal(announced.length, 2);
    assert.equal(announced[1].replacedAssignmentId, business.boss.assignmentId);
    assert.deepEqual(repository.items.get(business.id)?.bossHistory.map((h) => h.email), ['ana@cafecentral.co']);
  });

  it('refuses to overwrite a change someone else made in between', async () => {
    const { service, repository } = setup();
    const { business } = await service.create(OWNER, draft(), 'key-0000001');
    repository.raceOnce = true;
    await assert.rejects(service.update(OWNER, business.id, draft({ name: 'Cambio tardío' })), ConcurrentModificationError);
    assert.equal(repository.items.get(business.id)?.name, 'Café Central');
  });
});

describe('BusinessService pause and resume', () => {
  it('pauses and resumes without touching the boss', async () => {
    const { service } = setup();
    const { business } = await service.create(OWNER, draft(), 'key-0000001');

    const paused = await service.pause(OWNER, business.id);
    assert.equal(paused.status, 'paused');
    const resumed = await service.resume(OWNER, business.id);
    assert.equal(resumed.status, 'active');
    assert.equal(resumed.boss.assignmentId, business.boss.assignmentId);
  });
});

describe('BusinessService.exportCsv', () => {
  it('exports only the owner\'s businesses and neutralizes spreadsheet formulas', async () => {
    const { service } = setup();
    await service.create(OWNER, draft({ name: '=HYPERLINK("http://malo.example","clic")', address: 'Calle 1, local 2' }), 'key-0000001');
    await service.create(OTHER_OWNER, draft({ name: 'Ajeno' }), 'key-0000001');

    const csv = await service.exportCsv(OWNER, {});
    assert.ok(csv.startsWith('\uFEFFNombre comercial,'));
    assert.ok(csv.includes(`"'=HYPERLINK(""http://malo.example"",""clic"")"`), 'the formula is turned into text and quoted');
    assert.ok(csv.includes('"Calle 1, local 2"'), 'commas are quoted');
    assert.ok(!csv.includes('Ajeno'));
  });
});

describe('public contracts of the businesses module', () => {
  it('the directory finds a business, and by owner only the owner\'s', async () => {
    const { service, repository } = setup();
    const { business } = await service.create(OWNER, draft(), 'key-0000001');
    const directory = new BusinessDirectoryService(repository);

    assert.equal((await directory.find(business.id))?.boss.email, 'ana@cafecentral.co');
    assert.equal((await directory.findOwned(OWNER, business.id))?.id, business.id);
    assert.equal(await directory.findOwned(OTHER_OWNER, business.id), null);
    assert.equal(await directory.find('missing'), null);
  });

  it('a module is enabled only if the business is active and has it selected', async () => {
    const { service, repository } = setup();
    const { business } = await service.create(OWNER, draft({ modules: ['reservas'] }), 'key-0000001');
    const access = new BusinessModuleAccessService(repository);

    assert.equal(await access.isEnabled(business.id, 'reservas'), true);
    assert.equal(await access.isEnabled(business.id, 'turnos'), false);
    await service.pause(OWNER, business.id);
    assert.equal(await access.isEnabled(business.id, 'reservas'), false, 'a paused business blocks its functionalities');
    assert.equal(await access.isEnabled('missing', 'reservas'), false);
  });
});
