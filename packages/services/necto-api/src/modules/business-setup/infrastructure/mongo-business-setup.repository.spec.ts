import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import mongoose, { type Model } from 'mongoose';
import { inspectLogo } from '../domain/logo';
import { defaultWeekSchedule } from '../domain/week-schedule';
import { BusinessSetupRecord, BusinessSetupSchema } from './business-setup.schema';
import { MongoBusinessSetupRepository } from './mongo-business-setup.repository';

/**
 * Persistence against a REAL MongoDB. It only runs when `NECTO_TEST_MONGODB_URI` is set (for example the development
 * database of `.env`); otherwise it is skipped, like the rest of the suite that needs no database. Every document it
 * creates has a random business id of its own and is deleted at the end: it never reads or deletes anything else.
 */
const URI = process.env.NECTO_TEST_MONGODB_URI;
const NOW = new Date('2026-03-04T15:00:00.000Z');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

describe('MongoBusinessSetupRepository (real MongoDB)', { skip: URI ? false : 'set NECTO_TEST_MONGODB_URI to run it' }, () => {
  let model: Model<BusinessSetupRecord>;
  let repository: MongoBusinessSetupRepository;
  const created: string[] = [];
  const newId = () => {
    const id = `test-${randomUUID()}`;
    created.push(id);
    return id;
  };

  before(async () => {
    await mongoose.connect(URI!, { serverSelectionTimeoutMS: 5000 });
    model = mongoose.model(BusinessSetupRecord.name, BusinessSetupSchema) as unknown as Model<BusinessSetupRecord>;
    await model.init();
    repository = new MongoBusinessSetupRepository(model);
  });

  after(async () => {
    if (created.length > 0) await model.deleteMany({ businessId: { $in: created } });
    await mongoose.disconnect();
  });

  it('creates the setup on the first write and returns it empty before that', async () => {
    const id = newId();
    assert.equal(await repository.find(id), null);
    const setup = await repository.apply(id, { description: 'Hola' }, NOW);
    assert.equal(setup.description, 'Hola');
    assert.deepEqual(setup.moduleSchedules, {});
    assert.deepEqual(setup.visitedSteps, []);
    assert.equal(setup.baseSchedule, null);
    assert.equal((await repository.find(id))?.description, 'Hola');
  });

  it('a patch only touches what it names', async () => {
    const id = newId();
    await repository.apply(id, { description: 'Hola', baseSchedule: defaultWeekSchedule() }, NOW);
    await repository.apply(id, { description: 'Otra' }, NOW);
    const setup = (await repository.find(id))!;
    assert.equal(setup.description, 'Otra');
    assert.deepEqual(setup.baseSchedule, defaultWeekSchedule());
  });

  it('keeps the schedules of different modules apart, and a module entry survives the others being written', async () => {
    const id = newId();
    const own = defaultWeekSchedule();
    own.mon.ranges = [{ start: '18:00', end: '22:00' }];
    await repository.apply(id, { moduleSchedule: { moduleId: 'reservas', entry: { inherit: false, schedule: own } } }, NOW);
    await repository.apply(id, { moduleSchedule: { moduleId: 'turnos', entry: { inherit: true, schedule: null } } }, NOW);
    const setup = (await repository.find(id))!;
    assert.deepEqual(setup.moduleSchedules.reservas, { inherit: false, schedule: own });
    assert.deepEqual(setup.moduleSchedules.turnos, { inherit: true, schedule: null });
  });

  it('stores the logo apart: reads leave the bytes out, serving the image brings them back unchanged, and it can be removed', async () => {
    const id = newId();
    const logo = inspectLogo(PNG, 'image/png', NOW);
    const setup = await repository.apply(id, { logo }, NOW);
    assert.equal(setup.logo?.contentType, 'image/png');
    assert.equal(setup.logo?.sizeBytes, PNG.length);
    assert.ok(!('data' in (setup.logo ?? {})), 'the setup never carries the bytes');
    const served = await repository.findLogo(id);
    assert.deepEqual(new Uint8Array(served!.bytes), PNG);
    assert.equal(served!.info.sha256, logo.info.sha256);
    const removed = await repository.apply(id, { logo: null }, NOW);
    assert.equal(removed.logo, null);
    assert.equal(await repository.findLogo(id), null);
  });

  it('records the visited steps without repeating them, and the ready date can be set and cleared', async () => {
    const id = newId();
    await repository.apply(id, { step: 'data' }, NOW);
    await repository.apply(id, { step: 'schedule' }, NOW);
    const setup = await repository.apply(id, { step: 'data', baseReadyAt: NOW }, NOW);
    assert.deepEqual(setup.visitedSteps, ['data', 'schedule']);
    assert.equal(setup.currentStep, 'data');
    assert.deepEqual(setup.baseReadyAt, NOW);
    assert.equal((await repository.apply(id, { baseReadyAt: null }, NOW)).baseReadyAt, null);
  });

  it('creates exactly one document when the first writes arrive at the same time', async () => {
    const id = newId();
    await Promise.all(['data', 'schedule', 'category', 'review', 'data'].map((step) => repository.apply(id, { step: step as 'data' }, NOW)));
    assert.equal(await model.countDocuments({ businessId: id }), 1);
    assert.equal((await repository.find(id))!.visitedSteps.length, 4);
  });

  it('keeps each business apart', async () => {
    const [a, b] = [newId(), newId()];
    await repository.apply(a, { description: 'A' }, NOW);
    assert.equal(await repository.find(b), null);
    assert.equal((await repository.find(a))?.description, 'A');
  });
});
