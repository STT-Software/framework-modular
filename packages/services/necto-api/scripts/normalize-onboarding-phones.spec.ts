import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maskPhone, planPhoneMigration, type StoredProfile } from './normalize-onboarding-phones';

const profile = (id: string, phone: unknown): StoredProfile => ({ id, userId: `user-${id}`, phone });

describe('phone migration plan', () => {
  it('rewrites non canonical numbers and leaves canonical ones alone', () => {
    const plan = planPhoneMigration([profile('1', '+57 300 123 4567'), profile('2', '+573009998877')]);
    assert.deepEqual(plan.updates, [{ id: '1', userId: 'user-1', from: '+57 300 123 4567', to: '+573001234567' }]);
    assert.equal(plan.unchanged, 1);
    assert.deepEqual(plan.collisions, []);
    assert.deepEqual(plan.unparseable, []);
  });

  it('is idempotent: once applied, a second plan has nothing to do', () => {
    const first = planPhoneMigration([profile('1', '+57 (300) 123-4567'), profile('2', '+34 612 34 56 78')]);
    const applied = first.updates.map((update) => profile(update.id, update.to));
    const second = planPhoneMigration(applied);
    assert.deepEqual(second.updates, []);
    assert.equal(second.unchanged, 2);
  });

  it('reports a collision without rewriting or merging any profile of the group', () => {
    const plan = planPhoneMigration([
      profile('1', '+573001234567'),
      profile('2', '+57 300 123 4567'),
      profile('3', '+57-300-123-4567'),
      profile('4', '+573009998877'),
    ]);
    assert.deepEqual(plan.updates, []);
    assert.equal(plan.unchanged, 1);
    assert.equal(plan.collisions.length, 1);
    assert.equal(plan.collisions[0].phone, '+573001234567');
    assert.deepEqual(
      plan.collisions[0].profiles.map((p) => p.userId),
      ['user-1', 'user-2', 'user-3'],
    );
  });

  it('reports numbers it cannot read and leaves them as they are', () => {
    const plan = planPhoneMigration([
      profile('1', '3001234567'),
      profile('2', '+5716012345'),
      profile('3', null),
      profile('4', 573001234567),
    ]);
    assert.deepEqual(plan.updates, []);
    assert.deepEqual(
      plan.unparseable.map((p) => p.userId),
      ['user-1', 'user-2', 'user-3', 'user-4'],
    );
  });

  it('masks phones in the report', () => {
    assert.equal(maskPhone('+573001234567'), '+57*******567');
    assert.equal(maskPhone(null), '<null>');
    assert.equal(maskPhone(42), '<number>');
  });
});
