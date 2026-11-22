import type { PedidosState } from '../application/pedidos-configuration.service';
import type { PedidosOperatorView } from '../application/pedidos-operator.service';

/**
 * Public JSON view of a business's Pedidos configuration.
 * Dates are ISO strings; internal persistence fields (`version`, `seeded`) are never exposed.
 */
export function toPedidosResponse(state: PedidosState) {
  const { configuration: config } = state;
  return {
    business: {
      id: state.business.id,
      name: state.business.name,
      category: state.business.category,
      categoryOther: state.business.categoryOther,
      currency: state.business.currency,
      timezone: state.business.timezone,
    },
    profile: {
      id: config.profile,
      suggested: state.suggestedProfile,
    },
    schedule: {
      timezone: state.schedule.timezone,
      inherit: state.schedule.inherit,
      openNow: state.schedule.openNow,
      days: state.schedule.days,
    },
    modalities: [...config.modalities],
    onSiteMode: config.onSiteMode,
    fulfillment: {
      hasOwnCourier: config.fulfillment.hasOwnCourier,
      carriers: config.fulfillment.carriers.map((carrier) => ({
        id: carrier.id,
        name: carrier.name,
        enabled: carrier.enabled,
        isDefault: carrier.isDefault,
      })),
      pickupMode: config.fulfillment.pickupMode,
      confirmationMode: config.fulfillment.confirmationMode,
      whatsappNumber: config.fulfillment.whatsappNumber,
      riskThresholdActive: config.fulfillment.riskThresholdActive,
      maxShippingCostRisk: config.fulfillment.maxShippingCostRisk,
      shippingPricingMode: config.fulfillment.shippingPricingMode,
      flatShippingFee: config.fulfillment.flatShippingFee,
      freeShippingThreshold: config.fulfillment.freeShippingThreshold,
      minimumOrderActive: config.fulfillment.minimumOrderActive,
      minimumOrderAmount: config.fulfillment.minimumOrderAmount,
    },
    payments: {
      methods: [...config.payments.methods],
      requireTransferReceipt: config.payments.requireTransferReceipt,
      requirePrepaymentBeforePrep: config.payments.requirePrepaymentBeforePrep,
      confirmationExpiryAction: config.payments.confirmationExpiryAction,
      cancellationLimit: config.payments.cancellationLimit,
    },
    sla: {
      confirmationMinutes: config.sla.confirmationMinutes,
      preparationMinutes: config.sla.preparationMinutes,
      dispatchMinutes: config.sla.dispatchMinutes,
      urgencyThresholdMinutes: config.sla.urgencyThresholdMinutes,
      outOfHoursPolicy: config.sla.outOfHoursPolicy,
      outOfHoursAutoReply: config.sla.outOfHoursAutoReply,
      outOfHoursMessage: config.sla.outOfHoursMessage,
    },
    operators: config.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      stages: [...operator.stages],
      createdAt: operator.createdAt.toISOString(),
    })),
    progress: {
      currentStep: config.currentStep,
      visitedSteps: [...config.visitedSteps],
      ready: config.readyAt !== null,
      readyAt: config.readyAt?.toISOString() ?? null,
      touched: config.touched,
    },
    ...(state.created ? { created: state.created } : {}),
  };
}

/** Strictly scoped operator response: never exposes administrative configuration or sibling operators. */
export function toPedidosOperatorResponse(view: PedidosOperatorView) {
  return {
    business: { id: view.business.id, name: view.business.name },
    operator: {
      id: view.operator.id,
      name: view.operator.name,
      email: view.operator.email,
      phone: view.operator.phone,
      stages: [...view.operator.stages],
    },
    schedule: {
      timezone: view.schedule.timezone,
      inherit: view.schedule.inherit,
      openNow: view.schedule.openNow,
    },
    modalities: [...view.modalities],
    confirmationMode: view.confirmationMode,
  };
}
