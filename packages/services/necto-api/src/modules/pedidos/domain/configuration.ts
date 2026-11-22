import {
  DEFAULT_CARRIERS,
  PROFILE_DEFAULTS,
  type CancellationStage,
  type CarrierId,
  type ConfirmationExpiryAction,
  type ConfirmationMode,
  type OnSiteMode,
  type OperatorStage,
  type OutOfHoursPolicy,
  type PaymentMethodId,
  type PedidosModality,
  type PedidosProfileId,
  type PedidosStep,
  type PickupScheduleMode,
  type ShippingPricingMode,
} from './catalog';

export interface CarrierConfig {
  id: CarrierId;
  name: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface FulfillmentSettings {
  hasOwnCourier: boolean;
  carriers: CarrierConfig[];
  pickupMode: PickupScheduleMode;
  confirmationMode: ConfirmationMode;
  whatsappNumber: string;
  riskThresholdActive: boolean;
  maxShippingCostRisk: number;
  shippingPricingMode: ShippingPricingMode;
  flatShippingFee: number;
  freeShippingThreshold: number;
  minimumOrderActive: boolean;
  minimumOrderAmount: number;
}

export interface PaymentPoliciesSettings {
  methods: PaymentMethodId[];
  requireTransferReceipt: boolean;
  requirePrepaymentBeforePrep: boolean;
  confirmationExpiryAction: ConfirmationExpiryAction;
  cancellationLimit: CancellationStage;
}

export interface SlaSettings {
  confirmationMinutes: number;
  preparationMinutes: number;
  dispatchMinutes: number;
  urgencyThresholdMinutes: number;
  outOfHoursPolicy: OutOfHoursPolicy;
  outOfHoursAutoReply: boolean;
  outOfHoursMessage: string;
}

/**
 * A person assigned to operate Pedidos in this business. Only the assignment lives here: the person signs in through
 * `business-access` with the same normalized email, and removing them never deletes their identity or other accesses.
 */
export interface PedidosOperator {
  id: string;
  name: string;
  /** Normalized: trimmed and lowercase. Unique among the operators of the business. */
  email: string;
  phone: string | null;
  /** At least one operational stage. */
  stages: OperatorStage[];
  createdAt: Date;
}

/** Whole Pedidos configuration of ONE business, stored as a single atomically versioned document. */
export interface PedidosConfiguration {
  businessId: string;
  profile: PedidosProfileId;
  /** Whether the initial category-suggested defaults have been applied. Applied once on first open. */
  seeded: boolean;
  /** True after any content mutation (modalities, fulfillment, payments, SLA, or operators); cleared when resetting to a profile preset. */
  touched: boolean;
  modalities: PedidosModality[];
  onSiteMode: OnSiteMode;
  fulfillment: FulfillmentSettings;
  payments: PaymentPoliciesSettings;
  sla: SlaSettings;
  operators: PedidosOperator[];
  currentStep: PedidosStep | null;
  visitedSteps: PedidosStep[];
  /** When the configuration was marked ready. Cleared on any content edit. */
  readyAt: Date | null;
  /** Optimistic concurrency version incremented on every write. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function cloneDefaultCarriers(): CarrierConfig[] {
  return DEFAULT_CARRIERS.map((carrier) => ({ ...carrier }));
}

export function defaultsForProfile(profile: PedidosProfileId): {
  modalities: PedidosModality[];
  onSiteMode: OnSiteMode;
  fulfillment: FulfillmentSettings;
  payments: PaymentPoliciesSettings;
  sla: SlaSettings;
} {
  const preset = PROFILE_DEFAULTS[profile];
  return {
    modalities: [...preset.modalities],
    onSiteMode: preset.onSiteMode,
    fulfillment: {
      ...preset.fulfillment,
      carriers: cloneDefaultCarriers(),
    },
    payments: {
      ...preset.payments,
      methods: [...preset.payments.methods],
    },
    sla: { ...preset.sla },
  };
}

/** Creates an unseeded configuration shell for a business; `ensureSeeded` populates the category-suggested preset once. */
export function newPedidosConfiguration(businessId: string, now: Date, profile: PedidosProfileId = 'general'): PedidosConfiguration {
  const defaults = defaultsForProfile(profile);
  return {
    businessId,
    profile,
    seeded: false,
    touched: false,
    modalities: defaults.modalities,
    onSiteMode: defaults.onSiteMode,
    fulfillment: defaults.fulfillment,
    payments: defaults.payments,
    sla: defaults.sla,
    operators: [],
    currentStep: null,
    visitedSteps: [],
    readyAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
