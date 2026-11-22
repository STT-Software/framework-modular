import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../platform/errors/validation-exception.factory';
import { DEFAULT_CARRIERS, PROFILE_DEFAULTS } from '../../domain/catalog';
import {
  ChangePedidosProfileDto,
  SavePedidosProgressDto,
  UpdatePedidosFulfillmentDto,
  UpdatePedidosModalitiesDto,
  UpdatePedidosPaymentsDto,
  UpdatePedidosSlaDto,
  UpsertPedidosOperatorDto,
} from './pedidos.dto';

async function check<T extends object>(type: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const fields = (validationExceptionFactory(errors).getResponse() as { fields: Record<string, string[]> }).fields;
  return { dto, errors, fields };
}

describe('Pedidos request DTO validation', () => {
  it('ChangePedidosProfileDto validates profile enum and rejects extra fields', async () => {
    assert.deepEqual((await check(ChangePedidosProfileDto, { profile: 'food' })).errors, []);
    assert.deepEqual((await check(ChangePedidosProfileDto, { profile: 'services' })).errors, []);
    assert.ok((await check(ChangePedidosProfileDto, { profile: 'unknown' })).fields.profile);
    assert.ok((await check(ChangePedidosProfileDto, {})).fields.profile);
    assert.ok((await check(ChangePedidosProfileDto, { profile: 'food', extra: true })).errors.length > 0);
  });

  it('UpdatePedidosModalitiesDto validates modalities and onSiteMode', async () => {
    assert.deepEqual(
      (await check(UpdatePedidosModalitiesDto, { modalities: ['delivery', 'pickup'], onSiteMode: 'table_or_zone' }))
        .errors,
      [],
    );
    assert.ok(
      (await check(UpdatePedidosModalitiesDto, { modalities: ['drone'], onSiteMode: 'counter' })).fields.modalities,
    );
    assert.ok(
      (await check(UpdatePedidosModalitiesDto, { modalities: ['delivery'], onSiteMode: 'booth' })).fields.onSiteMode,
    );
    assert.ok(
      (await check(UpdatePedidosModalitiesDto, { modalities: ['delivery'], onSiteMode: 'counter', businessId: 'x' }))
        .errors.length > 0,
    );
  });

  it('UpdatePedidosFulfillmentDto validates all fields and accepts carriers with or without name', async () => {
    const valid = {
      ...PROFILE_DEFAULTS.food.fulfillment,
      carriers: DEFAULT_CARRIERS.map((c) => ({ ...c })),
    };
    assert.deepEqual((await check(UpdatePedidosFulfillmentDto, valid)).errors, []);

    const withoutCarrierNames = {
      ...PROFILE_DEFAULTS.food.fulfillment,
      carriers: DEFAULT_CARRIERS.map(({ id, enabled, isDefault }) => ({ id, enabled, isDefault })),
    };
    assert.deepEqual((await check(UpdatePedidosFulfillmentDto, withoutCarrierNames)).errors, []);

    assert.ok((await check(UpdatePedidosFulfillmentDto, { ...valid, flatShippingFee: 12.5 })).fields.flatShippingFee);
    assert.ok(
      (await check(UpdatePedidosFulfillmentDto, { ...valid, confirmationMode: 'telepathy' })).fields.confirmationMode,
    );
    assert.ok(
      (
        await check(UpdatePedidosFulfillmentDto, {
          ...valid,
          carriers: [{ id: 'unknown_carrier', enabled: true, isDefault: true }],
        })
      ).fields['carriers.0.id'],
    );
    assert.ok((await check(UpdatePedidosFulfillmentDto, { ...valid, unknownField: 1 })).errors.length > 0);
  });

  it('UpdatePedidosPaymentsDto validates methods and policies', async () => {
    const valid = { ...PROFILE_DEFAULTS.fashion.payments, methods: [...PROFILE_DEFAULTS.fashion.payments.methods] };
    assert.deepEqual((await check(UpdatePedidosPaymentsDto, valid)).errors, []);
    assert.ok((await check(UpdatePedidosPaymentsDto, { ...valid, methods: ['crypto'] })).fields.methods);
    assert.ok(
      (await check(UpdatePedidosPaymentsDto, { ...valid, cancellationLimit: 'after_delivery' })).fields
        .cancellationLimit,
    );
    assert.ok(
      (await check(UpdatePedidosPaymentsDto, { ...valid, requireTransferReceipt: 'yes' })).fields
        .requireTransferReceipt,
    );
  });

  it('UpdatePedidosSlaDto validates integer durations (including 0 for services profile) and policy enum', async () => {
    assert.deepEqual((await check(UpdatePedidosSlaDto, { ...PROFILE_DEFAULTS.services.sla })).errors, []);
    assert.deepEqual((await check(UpdatePedidosSlaDto, { ...PROFILE_DEFAULTS.food.sla })).errors, []);
    assert.ok(
      (await check(UpdatePedidosSlaDto, { ...PROFILE_DEFAULTS.food.sla, preparationMinutes: 15.5 })).fields
        .preparationMinutes,
    );
    assert.ok(
      (await check(UpdatePedidosSlaDto, { ...PROFILE_DEFAULTS.food.sla, outOfHoursPolicy: 'ignore' })).fields
        .outOfHoursPolicy,
    );
  });

  it('UpsertPedidosOperatorDto validates name, email, optional nullable phone, and stages', async () => {
    assert.deepEqual(
      (
        await check(UpsertPedidosOperatorDto, {
          name: 'Laura Gómez',
          email: 'laura@cafe.co',
          phone: '+57 300 123 4567',
          stages: ['confirmation', 'dispatch'],
        })
      ).errors,
      [],
    );
    assert.deepEqual(
      (
        await check(UpsertPedidosOperatorDto, {
          name: 'Laura Gómez',
          email: 'laura@cafe.co',
          phone: null,
          stages: ['preparation'],
        })
      ).errors,
      [],
    );
    assert.ok(
      (await check(UpsertPedidosOperatorDto, { name: 'Laura', email: 'l@x.co', stages: ['billing'] })).fields.stages,
    );
    assert.ok(
      (await check(UpsertPedidosOperatorDto, { name: 'Laura', email: 'l@x.co', stages: ['dispatch'], role: 'admin' }))
        .errors.length > 0,
    );
  });

  it('SavePedidosProgressDto validates currentStep and optional visitedSteps', async () => {
    assert.deepEqual((await check(SavePedidosProgressDto, { currentStep: 'fulfillment' })).errors, []);
    assert.deepEqual(
      (
        await check(SavePedidosProgressDto, {
          currentStep: 'sla',
          visitedSteps: ['profile', 'modalities', 'fulfillment', 'payments', 'sla'],
        })
      ).errors,
      [],
    );
    assert.ok((await check(SavePedidosProgressDto, { currentStep: 'queues' })).fields.currentStep);
    assert.ok(
      (await check(SavePedidosProgressDto, { currentStep: 'sla', visitedSteps: ['invalid'] })).fields.visitedSteps,
    );
  });
});
