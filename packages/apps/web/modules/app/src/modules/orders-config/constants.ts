import type { CarrierConfig, FulfillmentSettings, OrdersConfigState, OrdersProfileId, SlaSettings } from "./types";

export const DEFAULT_CARRIERS: CarrierConfig[] = [
  { id: "servientrega", name: "Servientrega", enabled: true, isDefault: true },
  { id: "coordinadora", name: "Coordinadora", enabled: true, isDefault: false },
  { id: "interrapidisimo", name: "Inter Rapidísimo", enabled: true, isDefault: false },
  { id: "envia", name: "Envía", enabled: false, isDefault: false },
  { id: "tcc", name: "TCC", enabled: false, isDefault: false },
  { id: "deprisa", name: "Deprisa", enabled: false, isDefault: false },
  { id: "domina", name: "Domina", enabled: false, isDefault: false },
];

export const PROFILE_DEFAULTS: Record<OrdersProfileId, {
  name: string;
  description: string;
  modalities: ("pickup" | "delivery" | "on_site")[];
  fulfillment: Partial<FulfillmentSettings>;
  sla: SlaSettings;
}> = {
  food: {
    name: "Alimentos y Bebidas",
    description: "Restaurantes, dark kitchens, cafés y panaderías con cocina o preparación inmediata.",
    modalities: ["delivery", "pickup", "on_site"],
    fulfillment: {
      hasOwnCourier: true,
      pickupMode: "eventual",
      confirmationMode: "manual",
      riskThresholdActive: false,
      maxShippingCostRisk: 15000,
    },
    sla: {
      confirmationMinutes: 5,
      preparationMinutes: 25,
      dispatchMinutes: 30,
      urgencyThresholdMinutes: 15,
      outOfHoursAutoReply: true,
      outOfHoursMessage: "Hola, nuestro horario de atención ha finalizado. Te responderemos a primera hora.",
    },
  },
  fashion: {
    name: "Moda y Calzado",
    description: "Tiendas de ropa, accesorios y calzado con envíos con guía, tallas y devoluciones.",
    modalities: ["delivery", "pickup"],
    fulfillment: {
      hasOwnCourier: false,
      pickupMode: "fixed",
      confirmationMode: "manual",
      riskThresholdActive: true,
      maxShippingCostRisk: 25000,
    },
    sla: {
      confirmationMinutes: 15,
      preparationMinutes: 120,
      dispatchMinutes: 240,
      urgencyThresholdMinutes: 60,
      outOfHoursAutoReply: true,
      outOfHoursMessage: "Hola, tu mensaje ha sido recibido. Te contactaremos en horario laboral para tu pedido.",
    },
  },
  general: {
    name: "Comercio General / Retail",
    description: "Venta de productos físicos estándar, tecnología, papelería o artículos de hogar.",
    modalities: ["delivery", "pickup"],
    fulfillment: {
      hasOwnCourier: true,
      pickupMode: "eventual",
      confirmationMode: "automatic",
      riskThresholdActive: true,
      maxShippingCostRisk: 20000,
    },
    sla: {
      confirmationMinutes: 10,
      preparationMinutes: 60,
      dispatchMinutes: 120,
      urgencyThresholdMinutes: 30,
      outOfHoursAutoReply: true,
      outOfHoursMessage: "Hola, atenderemos tu solicitud de despacho a primera hora en nuestro horario habitual.",
    },
  },
  services: {
    name: "Servicios y Citas",
    description: "Atención profesional, consultorios, barberías y talleres con agendamiento.",
    modalities: ["on_site"],
    fulfillment: {
      hasOwnCourier: false,
      pickupMode: "eventual",
      confirmationMode: "manual",
      riskThresholdActive: false,
      maxShippingCostRisk: 0,
    },
    sla: {
      confirmationMinutes: 10,
      preparationMinutes: 15,
      dispatchMinutes: 0,
      urgencyThresholdMinutes: 10,
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
    status: "pending",
    profile,
    modalities: [...defaults.modalities],
    fulfillment: {
      hasOwnCourier: defaults.fulfillment.hasOwnCourier ?? true,
      carriers: DEFAULT_CARRIERS.map((c) => ({ ...c })),
      pickupMode: defaults.fulfillment.pickupMode ?? "eventual",
      confirmationMode: defaults.fulfillment.confirmationMode ?? "manual",
      riskThresholdActive: defaults.fulfillment.riskThresholdActive ?? false,
      maxShippingCostRisk: defaults.fulfillment.maxShippingCostRisk ?? 20000,
    },
    sla: { ...defaults.sla },
    operators: [],
    updatedAt: new Date().toISOString(),
  };
}
