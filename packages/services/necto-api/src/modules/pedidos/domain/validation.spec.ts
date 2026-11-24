import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CARRIERS, PEDIDOS_PROFILE_IDS, PROFILE_DEFAULTS } from './catalog';
import { newPedidosConfiguration } from './configuration';
import {
  isValidEmail,
  isValidPhone,
  normalizeCarriers,
  normalizeEmail,
  normalizePhone,
  validateFulfillment,
  validateModalities,
  validateOperatorInput,
  validatePayments,
  validateReadiness,
  validateSla,
} from './validation';

const NOW = new Date('2026-03-04T15:00:00.000Z');

describe('pedidos validation primitives', () => {
  it('normalizes and validates emails and phones', () => {
    assert.equal(normalizeEmail('  Laura.Gomez@Cafe.CO  '), 'laura.gomez@cafe.co');
    assert.equal(isValidEmail('laura@cafe.co'), true);
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidEmail(`${'a'.repeat(250)}@x.co`), false);

    assert.equal(normalizePhone('  +57   300 123 4567  '), '+57 300 123 4567');
    assert.equal(normalizePhone('   '), null);
    assert.equal(normalizePhone(null), null);
    assert.equal(isValidPhone('+57 (300) 123-4567'), true);
    assert.equal(isValidPhone('123456'), false);
    assert.equal(isValidPhone('+1234567890123456'), false);
  });

  it('normalizes carriers while preserving canonical names and enforcing the single default invariant', () => {
    const normalized = normalizeCarriers([
      { id: 'servientrega', name: 'Tampered', enabled: false, isDefault: true },
      { id: 'coordinadora', enabled: true, isDefault: false },
      { id: 'tcc', enabled: true, isDefault: false },
    ]);
    assert.equal(normalized.length, DEFAULT_CARRIERS.length);
    assert.equal(normalized.find((c) => c.id === 'servientrega')!.name, 'Servientrega');
    assert.equal(normalized.find((c) => c.id === 'servientrega')!.isDefault, false);
    assert.equal(normalized.find((c) => c.id === 'coordinadora')!.isDefault, true, 'first enabled promoted to default');
    assert.equal(normalized.find((c) => c.id === 'tcc')!.isDefault, false);

    const doubleDefault = normalizeCarriers([
      { id: 'servientrega', enabled: true, isDefault: true },
      { id: 'tcc', enabled: true, isDefault: true },
    ]);
    assert.equal(doubleDefault.filter((c) => c.isDefault).length, 1);
  });
});

describe('pedidos section validators', () => {
  it('validateModalities requires at least one known modality and a valid onSiteMode', () => {
    assert.deepEqual(validateModalities(['delivery', 'delivery', 'pickup'], 'counter'), {
      modalities: ['delivery', 'pickup'],
      onSiteMode: 'counter',
      errors: {},
    });
    assert.ok(validateModalities([], 'counter').errors.modalities);
    assert.ok(validateModalities(['teleport'], 'table_or_zone').errors.modalities);
    assert.ok(validateModalities(['on_site'], 'drive_thru').errors.onSiteMode);
  });

  it('validateFulfillment enforces WhatsApp for agent mode, delivery channel for delivery, and conditional pricing bounds', () => {
    const base = { ...PROFILE_DEFAULTS.food.fulfillment, carriers: DEFAULT_CARRIERS.map((c) => ({ ...c })) };
    assert.deepEqual(validateFulfillment(base, ['delivery']).errors, {});

    // Agent mode requires a valid WhatsApp phone number.
    const badAgent = validateFulfillment({ ...base, confirmationMode: 'agent', whatsappNumber: '123' }, ['delivery']);
    assert.ok(badAgent.errors.whatsappNumber);
    const okAgent = validateFulfillment(
      { ...base, confirmationMode: 'agent', whatsappNumber: '+57 300 555 0199' },
      ['delivery'],
    );
    assert.deepEqual(okAgent.errors, {});

    // Delivery requires own courier or at least one enabled carrier.
    const noChannel = validateFulfillment(
      {
        ...base,
        hasOwnCourier: false,
        carriers: DEFAULT_CARRIERS.map((c) => ({ ...c, enabled: false, isDefault: false })),
      },
      ['delivery'],
    );
    assert.ok(noChannel.errors.deliveryChannel);

    // Without delivery, no courier/carrier is allowed.
    const onSiteOnly = validateFulfillment(
      {
        ...base,
        hasOwnCourier: false,
        carriers: DEFAULT_CARRIERS.map((c) => ({ ...c, enabled: false, isDefault: false })),
      },
      ['on_site'],
    );
    assert.deepEqual(onSiteOnly.errors, {});

    // Conditional bounds: freeShippingThreshold >= 1 when free_from + delivery, minimumOrderAmount >= 1 when active + delivery.
    const badPricing = validateFulfillment(
      {
        ...base,
        shippingPricingMode: 'free_from',
        freeShippingThreshold: 0,
        minimumOrderActive: true,
        minimumOrderAmount: 0,
      },
      ['delivery'],
    );
    assert.ok(badPricing.errors.freeShippingThreshold);
    assert.ok(badPricing.errors.minimumOrderAmount);
  });

  it('validatePayments enforces at least one method and upfront payment when prepayment is required', () => {
    assert.ok(
      validatePayments({
        methods: [],
        requireTransferReceipt: true,
        requirePrepaymentBeforePrep: false,
        confirmationExpiryAction: 'alert_only',
        cancellationLimit: 'before_preparation',
      }).errors.methods,
    );

    const invalidPrepay = validatePayments({
      methods: ['cash_on_delivery', 'in_store'],
      requireTransferReceipt: false,
      requirePrepaymentBeforePrep: true,
      confirmationExpiryAction: 'alert_only',
      cancellationLimit: 'before_preparation',
    });
    assert.ok(invalidPrepay.errors.requirePrepaymentBeforePrep);

    const validPrepay = validatePayments({
      methods: ['payment_link'],
      requireTransferReceipt: false,
      requirePrepaymentBeforePrep: true,
      confirmationExpiryAction: 'auto_cancel',
      cancellationLimit: 'never',
    });
    assert.deepEqual(validPrepay.errors, {});
  });

  it('validateSla honors conditional applicability for confirmationMinutes and dispatchMinutes and auto-reply copy', () => {
    // Services preset has dispatchMinutes = 0 and modalities = ['on_site']: valid!
    assert.deepEqual(validateSla(PROFILE_DEFAULTS.services.sla, ['on_site'], 'manual').errors, {});

    // Enabling delivery with dispatchMinutes = 0 fails validation.
    assert.ok(validateSla(PROFILE_DEFAULTS.services.sla, ['delivery'], 'manual').errors.dispatchMinutes);

    // Automatic confirmation skips confirmationMinutes >= 1 requirement, manual requires >= 1.
    assert.deepEqual(
      validateSla({ ...PROFILE_DEFAULTS.general.sla, confirmationMinutes: 0 }, ['delivery'], 'automatic').errors,
      {},
    );
    assert.ok(
      validateSla({ ...PROFILE_DEFAULTS.general.sla, confirmationMinutes: 0 }, ['delivery'], 'manual').errors
        .confirmationMinutes,
    );

    // Out-of-hours message is required when auto-reply is enabled and capped at 500 characters.
    assert.ok(
      validateSla(
        { ...PROFILE_DEFAULTS.food.sla, outOfHoursAutoReply: true, outOfHoursMessage: '   ' },
        ['delivery'],
        'manual',
      ).errors.outOfHoursMessage,
    );
    assert.ok(
      validateSla(
        { ...PROFILE_DEFAULTS.food.sla, outOfHoursAutoReply: true, outOfHoursMessage: 'x'.repeat(501) },
        ['delivery'],
        'manual',
      ).errors.outOfHoursMessage,
    );
  });

  it('validateOperatorInput validates name, email, optional phone and stages', () => {
    const ok = validateOperatorInput({
      name: '  Laura Gómez  ',
      email: '  LAURA@Cafe.CO ',
      phone: '+57 300 123 4567',
      stages: ['dispatch', 'confirmation', 'dispatch'],
    });
    assert.deepEqual(ok.errors, {});
    assert.deepEqual(ok.value, {
      name: 'Laura Gómez',
      email: 'laura@cafe.co',
      phone: '+57 300 123 4567',
      stages: ['confirmation', 'dispatch'],
    });

    const bad = validateOperatorInput({ name: 'A', email: 'bad', phone: '12', stages: [] });
    assert.ok(bad.errors.name);
    assert.ok(bad.errors.email);
    assert.ok(bad.errors.phone);
    assert.ok(bad.errors.stages);
  });

  it('validateReadiness accepts every built-in profile default and catches cross-step inconsistencies', () => {
    for (const profile of PEDIDOS_PROFILE_IDS) {
      const config = newPedidosConfiguration('biz-1', NOW, profile);
      assert.deepEqual(validateReadiness(config), {}, `profile ${profile} defaults must pass readiness`);
    }

    // Adding delivery to a services preset without updating fulfillment or SLA must fail readiness.
    const broken = newPedidosConfiguration('biz-1', NOW, 'services');
    broken.modalities = ['delivery'];
    broken.fulfillment.carriers = broken.fulfillment.carriers.map((c) => ({ ...c, enabled: false, isDefault: false }));
    const issues = validateReadiness(broken);
    assert.ok(issues['fulfillment.deliveryChannel']);
    assert.ok(issues['sla.dispatchMinutes']);
  });
});
