import type {
  CarrierConfig,
  FulfillmentSettings,
  ModalityType,
  OnSiteMode,
  OrdersConfigState,
  OrdersProfileId,
  PaymentPoliciesSettings,
  SlaSettings,
} from "./types";

export const DEFAULT_CARRIERS: CarrierConfig[] = [
  { id: "servientrega", name: "Servientrega", enabled: true, isDefault: true },
  { id: "coordinadora", name: "Coordinadora", enabled: true, isDefault: false },
  { id: "interrapidisimo", name: "Inter Rapidísimo", enabled: true, isDefault: false },
  { id: "envia", name: "Envía", enabled: false, isDefault: false },
  { id: "tcc", name: "TCC", enabled: false, isDefault: false },
  { id: "deprisa", name: "Deprisa", enabled: false, isDefault: false },
  { id: "domina", name: "Domina", enabled: false, isDefault: false },
];

export const PROFILE_DEFAULTS: Record<
  OrdersProfileId,
  {
    name: string;
    description: string;
    modalities: ModalityType[];
    onSiteMode: OnSiteMode;
    fulfillment: Omit<FulfillmentSettings, "carriers">;
    payments: PaymentPoliciesSettings;
    sla: SlaSettings;
  }
> = {
  food: {
    name: "Alimentos y Bebidas",
    description: "Restaurantes, dark kitchens, cafés y panaderías con cocina o preparación inmediata.",
    modalities: ["delivery", "pickup", "on_site"],
    onSiteMode: "table_or_zone",
    fulfillment: {
      hasOwnCourier: true,
      pickupMode: "eventual",
      confirmationMode: "manual",
      whatsappNumber: "",
      riskThresholdActive: false,
      maxShippingCostRisk: 15000,
      shippingPricingMode: "fixed",
      flatShippingFee: 6000,
      freeShippingThreshold: 60000,
      minimumOrderActive: true,
      minimumOrderAmount: 20000,
    },
    payments: {
      methods: ["cash_on_delivery", "bank_transfer", "in_store"],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: false,
      confirmationExpiryAction: "alert_only",
      cancellationLimit: "before_preparation",
    },
    sla: {
      confirmationMinutes: 5,
      preparationMinutes: 25,
      dispatchMinutes: 30,
      urgencyThresholdMinutes: 15,
      outOfHoursPolicy: "reject",
      outOfHoursAutoReply: true,
      outOfHoursMessage: "Hola, nuestro horario de atención ha finalizado. Te responderemos a primera hora.",
    },
  },
  fashion: {
    name: "Moda y Calzado",
    description: "Tiendas de ropa, accesorios y calzado con envíos con guía, tallas y devoluciones.",
    modalities: ["delivery", "pickup"],
    onSiteMode: "counter",
    fulfillment: {
      hasOwnCourier: false,
      pickupMode: "fixed",
      confirmationMode: "manual",
      whatsappNumber: "",
      riskThresholdActive: true,
      maxShippingCostRisk: 25000,
      shippingPricingMode: "free_from",
      flatShippingFee: 14000,
      freeShippingThreshold: 150000,
      minimumOrderActive: false,
      minimumOrderAmount: 50000,
    },
    payments: {
      methods: ["bank_transfer", "payment_link", "cash_on_delivery"],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: true,
      confirmationExpiryAction: "alert_only",
      cancellationLimit: "before_dispatch",
    },
    sla: {
      confirmationMinutes: 15,
      preparationMinutes: 120,
      dispatchMinutes: 240,
      urgencyThresholdMinutes: 60,
      outOfHoursPolicy: "schedule",
      outOfHoursAutoReply: true,
      outOfHoursMessage: "Hola, tu mensaje ha sido recibido. Te contactaremos en horario laboral para tu pedido.",
    },
  },
  general: {
    name: "Comercio General / Retail",
    description: "Venta de productos físicos estándar, tecnología, papelería o artículos de hogar.",
    modalities: ["delivery", "pickup"],
    onSiteMode: "counter",
    fulfillment: {
      hasOwnCourier: true,
      pickupMode: "eventual",
      confirmationMode: "automatic",
      whatsappNumber: "",
      riskThresholdActive: true,
      maxShippingCostRisk: 20000,
      shippingPricingMode: "free_from",
      flatShippingFee: 10000,
      freeShippingThreshold: 100000,
      minimumOrderActive: false,
      minimumOrderAmount: 30000,
    },
    payments: {
      methods: ["bank_transfer", "payment_link", "cash_on_delivery", "in_store"],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: false,
      confirmationExpiryAction: "alert_only",
      cancellationLimit: "before_preparation",
    },
    sla: {
      confirmationMinutes: 10,
      preparationMinutes: 60,
      dispatchMinutes: 120,
      urgencyThresholdMinutes: 30,
      outOfHoursPolicy: "schedule",
      outOfHoursAutoReply: true,
      outOfHoursMessage: "Hola, atenderemos tu solicitud de despacho a primera hora en nuestro horario habitual.",
    },
  },
  services: {
    name: "Encargos y servicios a pedido",
    description: "Trabajos personalizados, talleres, arreglos, impresiones y entregas bajo encargo.",
    modalities: ["on_site"],
    onSiteMode: "counter",
    fulfillment: {
      hasOwnCourier: false,
      pickupMode: "eventual",
      confirmationMode: "manual",
      whatsappNumber: "",
      riskThresholdActive: false,
      maxShippingCostRisk: 0,
      shippingPricingMode: "to_confirm",
      flatShippingFee: 0,
      freeShippingThreshold: 100000,
      minimumOrderActive: false,
      minimumOrderAmount: 20000,
    },
    payments: {
      methods: ["bank_transfer", "in_store"],
      requireTransferReceipt: true,
      requirePrepaymentBeforePrep: false,
      confirmationExpiryAction: "alert_only",
      cancellationLimit: "before_confirmation",
    },
    sla: {
      confirmationMinutes: 10,
      preparationMinutes: 15,
      dispatchMinutes: 0,
      urgencyThresholdMinutes: 10,
      outOfHoursPolicy: "schedule",
      outOfHoursAutoReply: false,
      outOfHoursMessage: "",
    },
  },
};

export function createInitialConfigState(businessId: string, profile: OrdersProfileId = "food"): OrdersConfigState {
  const defaults = PROFILE_DEFAULTS[profile];
  return {
    businessId,
    version: 1,
    step: "profile",
    visitedSteps: ["profile"],
    touched: false,
    status: "pending",
    profile,
    modalities: [...defaults.modalities],
    onSiteMode: defaults.onSiteMode,
    fulfillment: {
      ...defaults.fulfillment,
      carriers: DEFAULT_CARRIERS.map((c) => ({ ...c })),
    },
    payments: {
      ...defaults.payments,
      methods: [...defaults.payments.methods],
    },
    sla: { ...defaults.sla },
    operators: [],
    updatedAt: new Date().toISOString(),
  };
}
