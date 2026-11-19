import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../platform/errors/validation-exception.factory';
import { ChangeProfileDto, DeleteQueueDto, OperatorDto, ProgressDto, QueueDto, RulesDto } from './turnos.dto';

/** Runs the same validation the API runs (the global ValidationPipe options) and returns the problems by field. */
async function check<T extends object>(type: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const fields = (validationExceptionFactory(errors).getResponse() as { fields: Record<string, string[]> }).fields;
  return { dto, errors, fields };
}

describe('Turnos request bodies (shape only; the rules are the domain\'s)', () => {
  it('profile: a known profile and an optional flag', async () => {
    assert.deepEqual((await check(ChangeProfileDto, { profile: 'bank' })).errors, []);
    assert.deepEqual((await check(ChangeProfileDto, { profile: 'bank', addSuggestedQueues: true })).errors, []);
    assert.ok((await check(ChangeProfileDto, { profile: 'spaceship' })).fields.profile);
    assert.ok((await check(ChangeProfileDto, {})).fields.profile);
    assert.ok((await check(ChangeProfileDto, { profile: 'bank', addSuggestedQueues: 'yes' })).fields.addSuggestedQueues);
  });

  it('queue: name, mode and a whole average are required; color and own values are optional and may be null', async () => {
    assert.deepEqual((await check(QueueDto, { name: 'Caja', mode: 'auto', averageMinutes: 10 })).errors, []);
    assert.deepEqual((await check(QueueDto, { name: 'Caja', mode: 'auto', averageMinutes: 10, color: null, overrides: { prefix: null, urgentMinutes: null, busyLimit: 3, fullLimit: 9 } })).errors, []);
    assert.ok((await check(QueueDto, { mode: 'auto', averageMinutes: 10 })).fields.name);
    assert.ok((await check(QueueDto, { name: 'Caja', averageMinutes: 10 })).fields.mode);
    assert.ok((await check(QueueDto, { name: 'Caja', mode: 'auto', averageMinutes: '10' })).fields.averageMinutes);
    assert.ok((await check(QueueDto, { name: 'Caja', mode: 'auto', averageMinutes: 10.5 })).fields.averageMinutes);
    assert.ok((await check(QueueDto, { name: 'Caja', mode: 'auto', averageMinutes: 10, overrides: { busyLimit: 'x' } })).fields['overrides.busyLimit']);
  });

  it('refuses fields nobody should send: an id, a source, the business, or unknown own values', async () => {
    for (const extra of [{ id: 'x' }, { source: 'bank' }, { businessId: 'other' }, { overrides: { priority: 1 } }]) {
      const { errors } = await check(QueueDto, { name: 'Caja', mode: 'auto', averageMinutes: 10, ...extra });
      assert.ok(errors.length > 0, JSON.stringify(extra));
    }
  });

  it('rules: every field required with its type; the prefix only as text', async () => {
    const ok = { prefixMode: 'initial', dailyReset: true, urgentMinutes: 10, busyLimit: 4, fullLimit: 8 };
    assert.deepEqual((await check(RulesDto, ok)).errors, []);
    assert.deepEqual((await check(RulesDto, { ...ok, prefixMode: 'fixed', fixedPrefix: 'T' })).errors, []);
    assert.deepEqual((await check(RulesDto, { ...ok, fixedPrefix: null })).errors, []);
    for (const key of ['prefixMode', 'dailyReset', 'urgentMinutes', 'busyLimit', 'fullLimit']) {
      const { [key]: _omitted, ...rest } = ok as Record<string, unknown>;
      assert.ok((await check(RulesDto, rest)).fields[key], `${key} is required`);
    }
    assert.ok((await check(RulesDto, { ...ok, fullLimit: 8.5 })).fields.fullLimit);
    assert.ok((await check(RulesDto, { ...ok, dailyReset: 'si' })).fields.dailyReset);
    assert.ok((await check(RulesDto, { ...ok, fixedPrefix: 7 })).fields.fixedPrefix);
  });

  it('operator: name, email and a list of queue ids; the phone is optional', async () => {
    assert.deepEqual((await check(OperatorDto, { name: 'Laura', email: 'laura@x.co', queueIds: ['q1'] })).errors, []);
    assert.deepEqual((await check(OperatorDto, { name: 'Laura', email: 'laura@x.co', phone: null, queueIds: [] })).errors, [], 'an empty list is the domain\'s problem, reported by field');
    assert.ok((await check(OperatorDto, { email: 'laura@x.co', queueIds: ['q1'] })).fields.name);
    assert.ok((await check(OperatorDto, { name: 'Laura', queueIds: ['q1'] })).fields.email);
    assert.ok((await check(OperatorDto, { name: 'Laura', email: 'laura@x.co', queueIds: 'q1' })).fields.queueIds);
    assert.ok((await check(OperatorDto, { name: 'Laura', email: 'laura@x.co', queueIds: [1] })).fields.queueIds);
    assert.ok((await check(OperatorDto, { name: 'Laura', email: 'laura@x.co', queueIds: ['q1'], role: 'admin' })).errors.length > 0);
  });

  it('delete queue: optional list of reassignments, each with an operator and a queue', async () => {
    assert.deepEqual((await check(DeleteQueueDto, {})).errors, []);
    assert.deepEqual((await check(DeleteQueueDto, { reassignments: [{ operatorId: 'o1', queueId: 'q2' }] })).errors, []);
    assert.ok((await check(DeleteQueueDto, { reassignments: 'o1' })).fields.reassignments);
    assert.ok((await check(DeleteQueueDto, { reassignments: [{ operatorId: 'o1' }] })).fields['reassignments.0.queueId']);
  });

  it('progress: only the five known steps', async () => {
    for (const step of ['profile', 'queues', 'rules', 'operators', 'review']) assert.deepEqual((await check(ProgressDto, { step })).errors, []);
    assert.ok((await check(ProgressDto, { step: 'payments' })).fields.step);
    assert.ok((await check(ProgressDto, {})).fields.step);
  });
});
