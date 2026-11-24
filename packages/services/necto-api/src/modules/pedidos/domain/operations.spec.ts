import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CARRIERS, PEDIDOS_LIMITS, PROFILE_DEFAULTS, suggestedProfileFor } from './catalog';
import { newPedidosConfiguration } from './configuration';
import {
  DuplicatePedidosOperatorError,
  InvalidPedidosDataError,
  PedidosIncompleteError,
  PedidosOperatorNotFoundError,
} from './errors';
import {
  addOperator,
  changeProfile,
  completeConfiguration,
  ensureSeeded,
  removeOperator,
  saveProgress,
  updateFulfillment,
  updateModalities,
  updateOperator,
  updatePayments,
  updateSla,
} from './operations';

const T1 = new Date('2026-03-04T15:00:00.000Z');
const T2 = new Date('2026-03-04T15:05:00.000Z');
const T3 = new Date('2026-03-04T15:10:00.000Z');

describe('suggestedProfileFor', () => {
  it('maps business categories to Pedidos profiles deterministically', () => {
    assert.equal(suggestedProfileFor('gastronomy'), 'food');
    assert.equal(suggestedProfileFor('retail'), 'general');
    assert.equal(suggestedProfileFor('professional-services'), 'services');
    assert.equal(suggestedProfileFor('health-wellness'), 'services');
    assert.equal(suggestedProfileFor('other'), 'general');
    assert.equal(suggestedProfileFor('unknown'), 'general');
  });
});

describe('pedidos domain operations', () => {
  it('ensureSeeded applies suggested defaults once while keeping touched=false and readyAt=null', () => {
    const fresh = newPedidosConfiguration('biz-1', T1);
    const seeded = ensureSeeded(fresh, 'food', T1);
    assert.equal(seeded.seeded, true);
    assert.equal(seeded.profile, 'food');
    assert.equal(seeded.touched, false);
    assert.equal(seeded.readyAt, null);
    assert.deepEqual(seeded.modalities, PROFILE_DEFAULTS.food.modalities);
    assert.equal(ensureSeeded(seeded, 'fashion', T2), seeded, 'already seeded returns exact same reference');
  });

  it('changeProfile resets settings with fresh carriers, preserves operators, sets touched=false and clears readyAt', () => {
    let config = ensureSeeded(newPedidosConfiguration('biz-1', T1), 'food', T1);
    config = addOperator(
      config,
      { name: 'Laura Gómez', email: 'LAURA@cafe.co', phone: '+57 300 555 0101', stages: ['confirmation'] },
      T1,
      () => 'op-1',
    );
    config = completeConfiguration(config, T1);
    assert.ok(config.readyAt);

    const switched = changeProfile(config, 'fashion', T2);
    assert.equal(switched.profile, 'fashion');
    assert.equal(switched.touched, false);
    assert.equal(switched.readyAt, null);
    assert.deepEqual(switched.modalities, PROFILE_DEFAULTS.fashion.modalities);
    assert.equal(switched.onSiteMode, PROFILE_DEFAULTS.fashion.onSiteMode);
    assert.deepEqual(switched.fulfillment.carriers, DEFAULT_CARRIERS);
    assert.deepEqual(switched.payments.methods, PROFILE_DEFAULTS.fashion.payments.methods);
    assert.equal(switched.sla.preparationMinutes, PROFILE_DEFAULTS.fashion.sla.preparationMinutes);
    assert.equal(switched.operators.length, 1);
    assert.equal(switched.operators[0].id, 'op-1');

    // Selecting the same untouched, unready preset is a no-op returning the same reference.
    assert.equal(changeProfile(switched, 'fashion', T3), switched);

    // Re-selecting the same profile after customizing resets fields back to the preset with touched=false.
    const customized = updateModalities(switched, ['on_site'], 'table_or_zone', T2);
    assert.equal(customized.touched, true);
    const resetSame = changeProfile(customized, 'fashion', T3);
    assert.equal(resetSame.touched, false);
    assert.equal(resetSame.readyAt, null);
    assert.deepEqual(resetSame.modalities, PROFILE_DEFAULTS.fashion.modalities);

    assert.throws(() => changeProfile(switched, 'invalid', T3), InvalidPedidosDataError);
  });

  it('section updates mark touched=true and invalidate readyAt', () => {
    let config = completeConfiguration(ensureSeeded(newPedidosConfiguration('biz-1', T1), 'food', T1), T1);
    assert.ok(config.readyAt);

    config = updateModalities(config, ['delivery', 'pickup'], 'counter', T2);
    assert.equal(config.touched, true);
    assert.equal(config.readyAt, null);

    config = completeConfiguration(config, T2);
    config = updateFulfillment(config, { ...config.fulfillment, flatShippingFee: 8500 }, T3);
    assert.equal(config.fulfillment.flatShippingFee, 8500);
    assert.equal(config.readyAt, null);

    config = completeConfiguration(config, T3);
    config = updatePayments(config, { ...config.payments, cancellationLimit: 'never' }, T3);
    assert.equal(config.payments.cancellationLimit, 'never');
    assert.equal(config.readyAt, null);

    config = completeConfiguration(config, T3);
    config = updateSla(config, { ...config.sla, preparationMinutes: 40 }, T3);
    assert.equal(config.sla.preparationMinutes, 40);
    assert.equal(config.readyAt, null);
  });

  it('operators CRUD normalizes emails, rejects duplicates with 409, enforces maxOperators, and handles 404s', () => {
    let config = ensureSeeded(newPedidosConfiguration('biz-1', T1), 'food', T1);
    config = addOperator(
      config,
      { name: 'Laura Gómez', email: '  LAURA@Cafe.CO ', stages: ['confirmation', 'dispatch'] },
      T1,
      () => 'op-1',
    );
    assert.equal(config.operators[0].email, 'laura@cafe.co');

    // Duplicate email throws 409 conflict with code duplicate-operator-email.
    assert.throws(
      () =>
        addOperator(
          config,
          { name: 'Other Laura', email: 'laura@cafe.co', stages: ['preparation'] },
          T2,
          () => 'op-2',
        ),
      (error: unknown) => {
        assert.ok(error instanceof DuplicatePedidosOperatorError);
        assert.equal(error.code, 'duplicate-operator-email');
        assert.equal(error.kind, 'conflict');
        assert.ok(error.fields.email);
        return true;
      },
    );

    config = addOperator(
      config,
      { name: 'Mateo Ruiz', email: 'mateo@cafe.co', stages: ['preparation'] },
      T2,
      () => 'op-2',
    );

    // Updating keeping own email works.
    config = updateOperator(
      config,
      'op-1',
      { name: 'Laura M. Gómez', email: 'LAURA@cafe.co', phone: '+57 300 222 3344', stages: ['confirmation'] },
      T3,
    );
    assert.equal(config.operators[0].name, 'Laura M. Gómez');
    assert.equal(config.operators[0].phone, '+57 300 222 3344');

    // Updating to another operator's email fails with 409.
    assert.throws(
      () =>
        updateOperator(
          config,
          'op-1',
          { name: 'Laura M. Gómez', email: 'MATEO@cafe.co', stages: ['confirmation'] },
          T3,
        ),
      DuplicatePedidosOperatorError,
    );

    // Unknown operator throws 404.
    assert.throws(
      () => updateOperator(config, 'missing', { name: 'X Y', email: 'x@y.co', stages: ['dispatch'] }, T3),
      PedidosOperatorNotFoundError,
    );
    assert.throws(() => removeOperator(config, 'missing', T3), PedidosOperatorNotFoundError);

    // Remove works.
    config = removeOperator(config, 'op-2', T3);
    assert.deepEqual(
      config.operators.map((o) => o.id),
      ['op-1'],
    );

    // Max operators cap.
    let full = ensureSeeded(newPedidosConfiguration('biz-full', T1), 'food', T1);
    for (let i = 0; i < PEDIDOS_LIMITS.maxOperators; i++) {
      full = addOperator(
        full,
        { name: `Operator ${i}`, email: `op${i}@cafe.co`, stages: ['confirmation'] },
        T1,
        () => `op-${i}`,
      );
    }
    assert.throws(
      () =>
        addOperator(
          full,
          { name: 'Overflow Op', email: 'overflow@cafe.co', stages: ['confirmation'] },
          T2,
        ),
      InvalidPedidosDataError,
    );
  });

  it('saveProgress tracks currentStep and visitedSteps without setting touched or clearing readyAt', () => {
    const seeded = ensureSeeded(newPedidosConfiguration('biz-1', T1), 'food', T1);
    const p1 = saveProgress(seeded, 'modalities', ['profile'], T2);
    assert.equal(p1.touched, false);
    assert.equal(p1.currentStep, 'modalities');
    assert.deepEqual(p1.visitedSteps, ['profile', 'modalities']);

    // No-op returns exact same reference.
    assert.equal(saveProgress(p1, 'modalities', ['profile'], T3), p1);

    // Preserves readyAt when already completed.
    const completed = completeConfiguration(p1, T2);
    const moved = saveProgress(completed, 'payments', undefined, T3);
    assert.deepEqual(moved.readyAt, completed.readyAt);
    assert.equal(moved.currentStep, 'payments');
    assert.ok(moved.visitedSteps.includes('payments'));
  });

  it('completeConfiguration rejects incomplete configs with 409 and is idempotent once ready', () => {
    let config = ensureSeeded(newPedidosConfiguration('biz-1', T1), 'services', T1);
    config = updateModalities(config, ['delivery'], 'counter', T1);
    // Still has services dispatchMinutes = 0, so readiness fails!
    assert.throws(
      () => completeConfiguration(config, T2),
      (error: unknown) => {
        assert.ok(error instanceof PedidosIncompleteError);
        assert.equal(error.code, 'pedidos-incomplete');
        assert.equal(error.kind, 'conflict');
        assert.ok(error.fields['sla.dispatchMinutes']);
        return true;
      },
    );

    const ready = completeConfiguration(ensureSeeded(newPedidosConfiguration('biz-2', T1), 'food', T1), T2);
    assert.deepEqual(ready.readyAt, T2);
    assert.equal(ready.currentStep, 'review');
    assert.ok(ready.visitedSteps.includes('review'));

    const repeated = completeConfiguration(ready, T3);
    assert.equal(repeated, ready);
    assert.deepEqual(repeated.readyAt, T2);
  });
});
