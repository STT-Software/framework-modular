import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConcurrentPedidosChangeError,
  DuplicatePedidosOperatorError,
  InvalidPedidosDataError,
  PedidosBusinessNotFoundError,
  PedidosIncompleteError,
  PedidosNotEnabledError,
} from '../domain/errors';
import { BOSS, BUSINESS_ID, OTHER_BOSS, OTHER_BUSINESS_ID, aBusiness, setupPedidos } from '../fakes.spec';

describe('PedidosConfigurationService', () => {
  it('seeds category defaults on first open and includes currency, timezone and effective schedule', async () => {
    const { service, profiles, scheduleReader } = setupPedidos();
    profiles.currencies.set(BUSINESS_ID, 'USD');
    scheduleReader.inherit = false;
    scheduleReader.openNow = false;

    const state = await service.get(BOSS, BUSINESS_ID);
    assert.equal(state.business.id, BUSINESS_ID);
    assert.equal(state.business.currency, 'USD');
    assert.equal(state.business.timezone, 'America/Bogota');
    assert.equal(state.suggestedProfile, 'food');
    assert.equal(state.configuration.profile, 'food');
    assert.equal(state.configuration.seeded, true);
    assert.equal(state.configuration.touched, false);
    assert.equal(state.configuration.readyAt, null);
    assert.equal(state.schedule.inherit, false);
    assert.equal(state.schedule.openNow, false);
  });

  it('enforces business ownership (404) and module enablement (403 module-not-enabled)', async () => {
    const { service, directory, repository } = setupPedidos();

    await assert.rejects(service.get(OTHER_BOSS, BUSINESS_ID), PedidosBusinessNotFoundError);
    await assert.rejects(service.get(BOSS, OTHER_BUSINESS_ID), PedidosBusinessNotFoundError);
    await assert.rejects(service.get(BOSS, 'f'.repeat(24)), PedidosBusinessNotFoundError);

    directory.set(aBusiness({ status: 'paused' }));
    await assert.rejects(service.get(BOSS, BUSINESS_ID), PedidosBusinessNotFoundError);

    directory.set(aBusiness({ status: 'active', modules: ['turnos'] }));
    await assert.rejects(service.get(BOSS, BUSINESS_ID), (error: unknown) => {
      assert.ok(error instanceof PedidosNotEnabledError);
      assert.equal(error.code, 'module-not-enabled');
      return true;
    });

    assert.equal(repository.items.size, 0, 'rejected requests write nothing');
  });

  it('persists profile changes, section updates, operator CRUD, progress and completion end to end', async () => {
    const { service, clock } = setupPedidos();

    const created = await service.createOperator(BOSS, BUSINESS_ID, {
      name: 'Laura Gómez',
      email: '  LAURA@CafeCentral.CO ',
      phone: '+57 300 123 4567',
      stages: ['confirmation', 'dispatch'],
    });
    assert.ok(created.created?.id);
    assert.equal(created.configuration.operators[0].email, 'laura@cafecentral.co');

    // Duplicate email fails with 409.
    await assert.rejects(
      service.createOperator(BOSS, BUSINESS_ID, {
        name: 'Laura Copy',
        email: 'laura@cafecentral.co',
        stages: ['preparation'],
      }),
      DuplicatePedidosOperatorError,
    );

    // Switching profile resets settings while keeping operators and resetting touched to false.
    const fashion = await service.changeProfile(BOSS, BUSINESS_ID, 'fashion');
    assert.equal(fashion.configuration.profile, 'fashion');
    assert.equal(fashion.configuration.operators.length, 1);
    assert.equal(fashion.configuration.touched, false);
    assert.equal(fashion.configuration.readyAt, null);

    // Update modalities, fulfillment, payments, SLA.
    await service.updateModalities(BOSS, BUSINESS_ID, ['delivery', 'pickup', 'on_site'], 'table_or_zone');
    const afterFulfillment = await service.updateFulfillment(BOSS, BUSINESS_ID, {
      ...fashion.configuration.fulfillment,
      confirmationMode: 'agent',
      whatsappNumber: '+57 310 555 0199',
      hasOwnCourier: true,
    });
    assert.equal(afterFulfillment.configuration.fulfillment.confirmationMode, 'agent');

    await service.updatePayments(BOSS, BUSINESS_ID, {
      methods: ['bank_transfer', 'payment_link'],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: true,
      confirmationExpiryAction: 'auto_cancel',
      cancellationLimit: 'before_preparation',
    });

    await service.updateSla(BOSS, BUSINESS_ID, {
      confirmationMinutes: 8,
      preparationMinutes: 30,
      dispatchMinutes: 45,
      urgencyThresholdMinutes: 20,
      outOfHoursPolicy: 'schedule',
      outOfHoursAutoReply: true,
      outOfHoursMessage: 'Estamos cerrados, te atendemos mañana.',
    });

    // Complete marks ready.
    const completed = await service.complete(BOSS, BUSINESS_ID);
    assert.ok(completed.configuration.readyAt);
    assert.equal(completed.configuration.currentStep, 'review');

    // Progress navigation does NOT invalidate readyAt.
    clock.advance(60_000);
    const navigated = await service.saveProgress(BOSS, BUSINESS_ID, 'sla', ['profile', 'modalities']);
    assert.deepEqual(navigated.configuration.readyAt, completed.configuration.readyAt);
    assert.equal(navigated.configuration.currentStep, 'sla');

    // Operator update and deletion work and invalidate readyAt.
    const opId = created.created!.id;
    const updated = await service.updateOperator(BOSS, BUSINESS_ID, opId, {
      name: 'Laura Updated',
      email: 'laura@cafecentral.co',
      phone: null,
      stages: ['preparation'],
    });
    assert.equal(updated.configuration.operators[0].name, 'Laura Updated');
    assert.equal(updated.configuration.operators[0].phone, null);
    assert.equal(updated.configuration.readyAt, null);

    const removed = await service.deleteOperator(BOSS, BUSINESS_ID, opId);
    assert.equal(removed.configuration.operators.length, 0);
  });

  it('rejects invalid fulfillment and incomplete completion with structured field errors', async () => {
    const { service } = setupPedidos();
    const initial = await service.get(BOSS, BUSINESS_ID);

    await assert.rejects(
      service.updateFulfillment(BOSS, BUSINESS_ID, {
        ...initial.configuration.fulfillment,
        confirmationMode: 'agent',
        whatsappNumber: '',
      }),
      (error: unknown) => {
        assert.ok(error instanceof InvalidPedidosDataError);
        assert.ok(error.fields.whatsappNumber);
        return true;
      },
    );

    // Switch to services (dispatchMinutes = 0), then enable delivery without updating SLA -> complete must fail 409.
    await service.changeProfile(BOSS, BUSINESS_ID, 'services');
    await service.updateModalities(BOSS, BUSINESS_ID, ['delivery'], 'counter');
    await assert.rejects(service.complete(BOSS, BUSINESS_ID), (error: unknown) => {
      assert.ok(error instanceof PedidosIncompleteError);
      assert.ok(error.fields['sla.dispatchMinutes']);
      return true;
    });
  });

  it('retries optimistic version conflicts and throws ConcurrentPedidosChangeError when retries exhaust', async () => {
    const { service, repository } = setupPedidos();
    await service.get(BOSS, BUSINESS_ID);

    repository.raceTimes = 2;
    const beforeCalls = repository.replaceCalls;
    const updated = await service.updateModalities(BOSS, BUSINESS_ID, ['pickup'], 'counter');
    assert.deepEqual(updated.configuration.modalities, ['pickup']);
    assert.equal(repository.replaceCalls - beforeCalls, 3);

    repository.raceTimes = 10;
    await assert.rejects(
      service.updateModalities(BOSS, BUSINESS_ID, ['on_site'], 'counter'),
      ConcurrentPedidosChangeError,
    );
  });

  it('collects candidateOperators from the business boss and operators registered in other modules', async () => {
    const { store, profiles, scheduleReader } = setupPedidos();
    const fakeRegistry = {
      membersOfBusiness: async (businessId: string) =>
        businessId === BUSINESS_ID
          ? [
              { moduleId: 'turnos', name: 'Ana Gómez', email: BOSS, phone: '+57 314 537 6069' },
              { moduleId: 'turnos', name: 'Carlos Ruiz', email: 'carlos@cafecentral.co', phone: '+57 300 999 8877' },
            ]
          : [],
    };
    const serviceWithRegistry = new (await import('./pedidos-configuration.service')).PedidosConfigurationService(
      store,
      profiles,
      scheduleReader,
      fakeRegistry as never,
    );

    const state = await serviceWithRegistry.get(BOSS, BUSINESS_ID);
    assert.deepEqual(state.candidateOperators, [
      {
        name: 'Ana Gómez',
        email: BOSS,
        phone: '+57 314 537 6069',
        sources: ['admin', 'turnos'],
      },
      {
        name: 'Carlos Ruiz',
        email: 'carlos@cafecentral.co',
        phone: '+57 300 999 8877',
        sources: ['turnos'],
      },
    ]);
  });
});
