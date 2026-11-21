/**
 * Tipos para la configuración de Pedidos del Administrador de Negocio.
 * Espejo de la arquitectura modular de turnos:
 * /business/pedidos/:businessId/:step
 */

export type OrdersProfileId = "food" | "fashion" | "general" | "services";
export type ModalityType = "pickup" | "delivery" | "on_site";
export type ConfirmationMode = "manual" | "automatic" | "agent";
export type CarrierId = "servientrega" | "coordinadora" | "interrapidisimo" | "envia" | "tcc" | "deprisa" | "domina";
export type PickupScheduleMode = "eventual" | "fixed";
export type OrdersConfigStep = "profile" | "modalities" | "fulfillment" | "sla" | "operators" | "review";

export const ORDERS_CONFIG_STEPS: readonly OrdersConfigStep[] = [
  "profile",
  "modalities",
  "fulfillment",
  "sla",
  "operators",
  "review",
];

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
  riskThresholdActive: boolean;
  maxShippingCostRisk: number;
}

export interface SlaSettings {
  confirmationMinutes: number;
  preparationMinutes: number;
  dispatchMinutes: number;
  urgencyThresholdMinutes: number;
  outOfHoursAutoReply: boolean;
  outOfHoursMessage: string;
}

export interface OrderOperator {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "operator";
}

export interface OrdersConfigState {
  businessId: string;
  version: number;
  step: OrdersConfigStep;
  status: "pending" | "ready";
  profile: OrdersProfileId;
  modalities: ModalityType[];
  fulfillment: FulfillmentSettings;
  sla: SlaSettings;
  operators: OrderOperator[];
  updatedAt: string;
}

export interface OrdersConfigForm {
  profile: OrdersProfileId;
  modalities: ModalityType[];
  fulfillment: FulfillmentSettings;
  sla: SlaSettings;
  operators: OrderOperator[];
}
