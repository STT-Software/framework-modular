export const PEDIDOS_MODULE_ID = 'pedidos';

export const PEDIDOS_PROFILE_IDS = ['food', 'fashion', 'general', 'services'] as const;
export type PedidosProfileId = (typeof PEDIDOS_PROFILE_IDS)[number];

export const PEDIDOS_MODALITIES = ['delivery', 'pickup', 'on_site'] as const;
export type PedidosModality = (typeof PEDIDOS_MODALITIES)[number];

export const ON_SITE_MODES = ['table_or_zone', 'counter'] as const;
export type OnSiteMode = (typeof ON_SITE_MODES)[number];

export const CONFIRMATION_MODES = ['manual', 'automatic', 'agent'] as const;
export type ConfirmationMode = (typeof CONFIRMATION_MODES)[number];

export const CARRIER_IDS = [
  'servientrega',
  'coordinadora',
  'interrapidisimo',
  'envia',
  'tcc',
  'deprisa',
  'domina',
] as const;
export type CarrierId = (typeof CARRIER_IDS)[number];

export const PICKUP_MODES = ['eventual', 'fixed'] as const;
export type PickupScheduleMode = (typeof PICKUP_MODES)[number];

export const SHIPPING_PRICING_MODES = ['fixed', 'free_from', 'to_confirm'] as const;
export type ShippingPricingMode = (typeof SHIPPING_PRICING_MODES)[number];

export const PAYMENT_METHOD_IDS = ['cash_on_delivery', 'bank_transfer', 'payment_link', 'in_store'] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export const CONFIRMATION_EXPIRY_ACTIONS = ['alert_only', 'auto_cancel'] as const;
export type ConfirmationExpiryAction = (typeof CONFIRMATION_EXPIRY_ACTIONS)[number];

export const CANCELLATION_STAGES = [
  'before_confirmation',
  'before_preparation',
  'before_dispatch',
  'never',
] as const;
export type CancellationStage = (typeof CANCELLATION_STAGES)[number];

export const OUT_OF_HOURS_POLICIES = ['reject', 'schedule'] as const;
export type OutOfHoursPolicy = (typeof OUT_OF_HOURS_POLICIES)[number];

export const OPERATOR_STAGES = ['confirmation', 'preparation', 'dispatch'] as const;
export type OperatorStage = (typeof OPERATOR_STAGES)[number];

export const PEDIDOS_STEPS = [
  'profile',
  'modalities',
  'fulfillment',
  'payments',
  'sla',
  'operators',
  'review',
] as const;
export type PedidosStep = (typeof PEDIDOS_STEPS)[number];

/** Numeric and length bounds enforced by the Pedidos configuration domain. */
export const PEDIDOS_LIMITS = {
  maxShippingCostRisk: { min: 0, max: 100_000_000 },
  flatShippingFee: { min: 0, max: 100_000_000 },
  freeShippingThreshold: { min: 1, max: 100_000_000 },
  minimumOrderAmount: { min: 1, max: 100_000_000 },
  confirmationMinutes: { min: 1, max: 1_440 },
  preparationMinutes: { min: 1, max: 10_080 },
  dispatchMinutes: { min: 1, max: 10_080 },
  urgencyThresholdMinutes: { min: 1, max: 10_080 },
  outOfHoursMessageMaxLength: 500,
  operatorNameMinLength: 2,
  operatorNameMaxLength: 80,
  operatorEmailMaxLength: 254,
  maxOperators: 50,
  phoneDigitsMin: 7,
  phoneDigitsMax: 15,
} as const;

export interface DefaultCarrier {
  readonly id: CarrierId;
  readonly name: string;
  readonly enabled: boolean;
  readonly isDefault: boolean;
}

/** Canonical list of supported Colombian carriers and their initial enabled/default flags. */
export const DEFAULT_CARRIERS: readonly DefaultCarrier[] = [
  { id: 'servientrega', name: 'Servientrega', enabled: true, isDefault: true },
  { id: 'coordinadora', name: 'Coordinadora', enabled: true, isDefault: false },
  { id: 'interrapidisimo', name: 'Inter Rapidísimo', enabled: true, isDefault: false },
  { id: 'envia', name: 'Envía', enabled: false, isDefault: false },
  { id: 'tcc', name: 'TCC', enabled: false, isDefault: false },
  { id: 'deprisa', name: 'Deprisa', enabled: false, isDefault: false },
  { id: 'domina', name: 'Domina', enabled: false, isDefault: false },
];

export interface PedidosProfileDefault {
  readonly modalities: readonly PedidosModality[];
  readonly onSiteMode: OnSiteMode;
  readonly fulfillment: {
    readonly hasOwnCourier: boolean;
    readonly pickupMode: PickupScheduleMode;
    readonly confirmationMode: ConfirmationMode;
    readonly whatsappNumber: string;
    readonly riskThresholdActive: boolean;
    readonly maxShippingCostRisk: number;
    readonly shippingPricingMode: ShippingPricingMode;
    readonly flatShippingFee: number;
    readonly freeShippingThreshold: number;
    readonly minimumOrderActive: boolean;
    readonly minimumOrderAmount: number;
  };
  readonly payments: {
    readonly methods: readonly PaymentMethodId[];
    readonly requireTransferReceipt: boolean;
    readonly requirePrepaymentBeforePrep: boolean;
    readonly confirmationExpiryAction: ConfirmationExpiryAction;
    readonly cancellationLimit: CancellationStage;
  };
  readonly sla: {
    readonly confirmationMinutes: number;
    readonly preparationMinutes: number;
    readonly dispatchMinutes: number;
    readonly urgencyThresholdMinutes: number;
    readonly outOfHoursPolicy: OutOfHoursPolicy;
    readonly outOfHoursAutoReply: boolean;
    readonly outOfHoursMessage: string;
  };
}

/**
 * Default configuration templates per operational profile, matching the frontend `orders-config` presets.
 * `outOfHoursMessage` holds the customer-facing Spanish auto-reply copy for Colombian businesses.
 */
export const PROFILE_DEFAULTS: Readonly<Record<PedidosProfileId, PedidosProfileDefault>> = {
  food: {
    modalities: ['delivery', 'pickup', 'on_site'],
    onSiteMode: 'table_or_zone',
    fulfillment: {
      hasOwnCourier: true,
      pickupMode: 'eventual',
      confirmationMode: 'manual',
      whatsappNumber: '',
      riskThresholdActive: false,
      maxShippingCostRisk: 15000,
      shippingPricingMode: 'fixed',
      flatShippingFee: 6000,
      freeShippingThreshold: 60000,
      minimumOrderActive: true,
      minimumOrderAmount: 20000,
    },
    payments: {
      methods: ['cash_on_delivery', 'bank_transfer', 'in_store'],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: false,
      confirmationExpiryAction: 'alert_only',
      cancellationLimit: 'before_preparation',
    },
    sla: {
      confirmationMinutes: 5,
      preparationMinutes: 25,
      dispatchMinutes: 30,
      urgencyThresholdMinutes: 15,
      outOfHoursPolicy: 'reject',
      outOfHoursAutoReply: true,
      outOfHoursMessage: 'Hola, nuestro horario de atención ha finalizado. Te responderemos a primera hora.',
    },
  },
  fashion: {
    modalities: ['delivery', 'pickup'],
    onSiteMode: 'counter',
    fulfillment: {
      hasOwnCourier: false,
      pickupMode: 'fixed',
      confirmationMode: 'manual',
      whatsappNumber: '',
      riskThresholdActive: true,
      maxShippingCostRisk: 25000,
      shippingPricingMode: 'free_from',
      flatShippingFee: 14000,
      freeShippingThreshold: 150000,
      minimumOrderActive: false,
      minimumOrderAmount: 50000,
    },
    payments: {
      methods: ['bank_transfer', 'payment_link', 'cash_on_delivery'],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: true,
      confirmationExpiryAction: 'alert_only',
      cancellationLimit: 'before_dispatch',
    },
    sla: {
      confirmationMinutes: 15,
      preparationMinutes: 120,
      dispatchMinutes: 240,
      urgencyThresholdMinutes: 60,
      outOfHoursPolicy: 'schedule',
      outOfHoursAutoReply: true,
      outOfHoursMessage: 'Hola, tu mensaje ha sido recibido. Te contactaremos en horario laboral para tu pedido.',
    },
  },
  general: {
    modalities: ['delivery', 'pickup'],
    onSiteMode: 'counter',
    fulfillment: {
      hasOwnCourier: true,
      pickupMode: 'eventual',
      confirmationMode: 'automatic',
      whatsappNumber: '',
      riskThresholdActive: true,
      maxShippingCostRisk: 20000,
      shippingPricingMode: 'free_from',
      flatShippingFee: 10000,
      freeShippingThreshold: 100000,
      minimumOrderActive: false,
      minimumOrderAmount: 30000,
    },
    payments: {
      methods: ['bank_transfer', 'payment_link', 'cash_on_delivery', 'in_store'],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: false,
      confirmationExpiryAction: 'alert_only',
      cancellationLimit: 'before_preparation',
    },
    sla: {
      confirmationMinutes: 10,
      preparationMinutes: 60,
      dispatchMinutes: 120,
      urgencyThresholdMinutes: 30,
      outOfHoursPolicy: 'schedule',
      outOfHoursAutoReply: true,
      outOfHoursMessage: 'Hola, atenderemos tu solicitud de despacho a primera hora en nuestro horario habitual.',
    },
  },
  services: {
    modalities: ['on_site'],
    onSiteMode: 'counter',
    fulfillment: {
      hasOwnCourier: false,
      pickupMode: 'eventual',
      confirmationMode: 'manual',
      whatsappNumber: '',
      riskThresholdActive: false,
      maxShippingCostRisk: 0,
      shippingPricingMode: 'to_confirm',
      flatShippingFee: 0,
      freeShippingThreshold: 100000,
      minimumOrderActive: false,
      minimumOrderAmount: 20000,
    },
    payments: {
      methods: ['bank_transfer', 'in_store'],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: false,
      confirmationExpiryAction: 'alert_only',
      cancellationLimit: 'before_confirmation',
    },
    sla: {
      confirmationMinutes: 10,
      preparationMinutes: 15,
      dispatchMinutes: 0,
      urgencyThresholdMinutes: 10,
      outOfHoursPolicy: 'schedule',
      outOfHoursAutoReply: false,
      outOfHoursMessage: '',
    },
  },
};

const PROFILE_BY_CATEGORY: Readonly<Record<string, PedidosProfileId>> = {
  gastronomy: 'food',
  retail: 'general',
  'professional-services': 'services',
  'health-wellness': 'services',
  other: 'general',
};

/** Maps a business category to its recommended Pedidos operational profile. */
export function suggestedProfileFor(category: string): PedidosProfileId {
  return PROFILE_BY_CATEGORY[category] ?? 'general';
}
