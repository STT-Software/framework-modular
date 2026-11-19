import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import mongoose, { type Model } from 'mongoose';
import { addOperator, addQueue, ensureSeeded, newConfiguration, removeQueue, updateQueue } from '../domain/operations';
import { TurnosConfigurationRecord, TurnosConfigurationSchema } from './turnos-configuration.schema';
import { MongoTurnosConfigurationRepository } from './mongo-turnos-configuration.repository';

/**
 * Persistence against a REAL MongoDB. It only runs when `NECTO_TEST_MONGODB_URI` is set (for example the development database of
 * `.env`); otherwise it is skipped. Every document it creates has a random business id of its own and is deleted at the end:
 * it never reads or deletes anything else.
 */
const URI = process.env.NECTO_TEST_MONGODB_URI;
const NOW = new Date('2026-03-04T15:00:00.000Z');

describe('MongoTurnosConfigurationRepository (real MongoDB)', { skip: URI ? false : 'set NECTO_TEST_MONGODB_URI to run it' }, () => {
  let model: Model<TurnosConfigurationRecord>;
  let repository: MongoTurnosConfigurationRepository;
  const created: string[] = [];
  const newId = () => {
    const id = `test-${randomUUID()}`;
    created.push(id);
    return id;
  };
  const fresh = (businessId: string) => ensureSeeded(newConfiguration(businessId, NOW), 'clinic', NOW);

  before(async () => {
    await mongoose.connect(URI!, { serverSelectionTimeoutMS: 5000 });
    model = mongoose.model(TurnosConfigurationRecord.name, TurnosConfigurationSchema) as unknown as Model<TurnosConfigurationRecord>;
    await model.init();
    repository = new MongoTurnosConfigurationRepository(model);
  });

  after(async () => {
    if (created.length > 0) await model.deleteMany({ businessId: { $in: created } });
    await mongoose.disconnect();
  });

  it('stores and returns the whole configuration unchanged, with queues, own values and operators', async () => {
    const id = newId();
    let config = fresh(id);
    config = addQueue(config, { name: 'Vacunación', mode: 'manual', averageMinutes: 5, color: 'green', overrides: { prefix: 'V', busyLimit: 2 } }, NOW);
    config = addOperator(config, { name: 'Laura', email: 'laura@x.co', phone: '+573001234567', queueIds: [config.queues[0].id, config.queues[2].id] }, NOW);
    await repository.insert(config);
    const read = await repository.find(id);
    assert.deepEqual(read, config);
  });

  it('returns nothing for a business without configuration', async () => {
    assert.equal(await repository.find(newId()), null);
  });

  it('insert is safe to race: the second insert gets the first document, and only one exists', async () => {
    const id = newId();
    const [a, b] = await Promise.all([repository.insert(fresh(id)), repository.insert({ ...fresh(id), profile: 'bank' })]);
    assert.equal(await model.countDocuments({ businessId: id }), 1);
    assert.equal(a.profile, b.profile, 'both continue with the same stored configuration');
  });

  it('replace only succeeds from the version that was read, and raises it', async () => {
    const id = newId();
    const stored = await repository.insert(fresh(id));
    const changed = updateQueue(stored, stored.queues[0].id, { name: 'Consulta', mode: 'auto', averageMinutes: 9 }, NOW);
    const saved = await repository.replace(stored.version, changed);
    assert.equal(saved?.version, stored.version + 1);
    assert.equal(saved?.queues[0].name, 'Consulta');
    assert.equal(await repository.replace(stored.version, changed), null, 'a stale version does not write');
    assert.equal((await repository.find(id))?.version, stored.version + 1);
  });

  it('two writers from the same version: exactly one wins and nothing is lost', async () => {
    const id = newId();
    const stored = await repository.insert(fresh(id));
    const first = addQueue(stored, { name: 'Del primero', mode: 'auto', averageMinutes: 5 }, NOW);
    const second = addQueue(stored, { name: 'Del segundo', mode: 'auto', averageMinutes: 5 }, NOW);
    const results = await Promise.all([repository.replace(stored.version, first), repository.replace(stored.version, second)]);
    assert.equal(results.filter(Boolean).length, 1);
    const names = (await repository.find(id))!.queues.map((queue) => queue.name);
    assert.equal(names.length, 3);
  });

  it('deleting a queue and moving its operators is one write: either both happen or neither', async () => {
    const id = newId();
    let config = fresh(id);
    const [general, lab] = config.queues.map((queue) => queue.id);
    config = addOperator(config, { name: 'Solo lab', email: 'lab@x.co', queueIds: [lab] }, NOW);
    const stored = await repository.insert(config);
    const next = removeQueue(stored, lab, [{ operatorId: stored.operators[0].id, queueId: general }], NOW);
    assert.ok(await repository.replace(stored.version, next));
    const read = (await repository.find(id))!;
    assert.deepEqual(read.queues.map((queue) => queue.id), [general]);
    assert.deepEqual(read.operators[0].queueIds, [general]);
    assert.equal(await repository.replace(stored.version, next), null, 'repeating it from the old version changes nothing');
  });

  it('finds the configurations of every business where an email is an operator, using its index', async () => {
    const [a, b, c] = [newId(), newId(), newId()];
    const email = `op-${randomUUID()}@x.co`;
    for (const id of [a, b]) {
      let config = fresh(id);
      config = addOperator(config, { name: 'Operador', email, queueIds: [config.queues[0].id] }, NOW);
      await repository.insert(config);
    }
    await repository.insert(fresh(c));
    const found = await repository.findByOperatorEmail(email);
    assert.deepEqual(found.map((config) => config.businessId).sort(), [a, b].sort());
    assert.deepEqual(await repository.findByOperatorEmail('nobody@x.co'), []);
  });

  it('keeps each business apart', async () => {
    const [a, b] = [newId(), newId()];
    await repository.insert(fresh(a));
    assert.equal(await repository.find(b), null);
    assert.equal((await repository.find(a))?.businessId, a);
  });
});
