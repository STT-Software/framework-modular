import type { AdministeredBusiness } from "@/modules/business-access/public";

/**
 * Types for the Business Administrator Orders configuration module.
 * Mirrors the modular route structure of Turnos:
 * /business/pedidos/:businessId?/:step?
 */

export type OrdersProfileId = "food" | "fashion" | "general" | "services";
export type ModalityType = "pickup" | "delivery" | "on_site";
export type OnSiteMode = "table_or_zone" | "counter";
export type ConfirmationMode = "manual" | "automatic" | "agent";
export type CarrierId = "servientrega" | "coordinadora" | "interrapidisimo" | "envia" | "tcc" | "deprisa" | "domina";
export type PickupScheduleMode = "eventual" | "fixed";
export type ShippingPricingMode = "fixed" | "free_from" | "to_confirm";
export type PaymentMethodId = "cash_on_delivery" | "bank_transfer" | "payment_link" | "in_store";
export type ConfirmationExpiryAction = "alert_only" | "auto_cancel";
export type CancellationStage = "before_confirmation" | "before_preparation" | "before_dispatch" | "never";
export type OutOfHoursPolicy = "reject" | "schedule";
export type OrderOperatorStage = "confirmation" | "preparation" | "dispatch";
export type OrdersConfigStep =
  | "profile"
  | "modalities"
  | "fulfillment"
  | "payments"
  | "sla"
  | "operators"
  | "review";

export const ORDERS_CONFIG_STEPS: readonly OrdersConfigStep[] = [
  "profile",
  "modalities",
  "fulfillment",
  "payments",
  "sla",
  "operators",
  "review",
];

export const ALL_OPERATOR_STAGES: readonly OrderOperatorStage[] = [
  "confirmation",
  "preparation",
  "dispatch",
];

export interface OrdersBusiness extends AdministeredBusiness {
  currency?: string;
  timezone?: string;
}

export type OrdersDirtySection = "modalities" | "fulfillment" | "payments" | "sla";

export interface PedidosScheduleRange {
  start: string;
  end: string;
}

export interface PedidosScheduleDay {
  open: boolean;
  ranges: PedidosScheduleRange[];
}

export interface PedidosScheduleSummary {
  timezone: string;
  inherit: boolean;
  openNow: boolean | null;
  days?: Record<string, PedidosScheduleDay>;
}

export interface PedidosApiBusiness {
  id: string;
  name: string;
  category: string;
  categoryOther: string | null;
  currency: string;
  timezone: string;
}

export interface PedidosApiOperator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  stages: OrderOperatorStage[];
  createdAt: string;
}

export interface PedidosOperatorCandidate {
  name: string;
  email: string;
  phone: string | null;
  sources: string[];
}

export interface PedidosApiResponse {
  business: PedidosApiBusiness;
  profile: {
    id: OrdersProfileId;
    suggested: OrdersProfileId;
  };
  schedule: PedidosScheduleSummary;
  modalities: ModalityType[];
  onSiteMode: OnSiteMode;
  fulfillment: FulfillmentSettings;
  payments: PaymentPoliciesSettings;
  sla: SlaSettings;
  operators: PedidosApiOperator[];
  candidateOperators?: PedidosOperatorCandidate[];
  progress: {
    currentStep: OrdersConfigStep | null;
    visitedSteps: OrdersConfigStep[];
    ready: boolean;
    readyAt: string | null;
    touched: boolean;
  };
  created?: { id: string };
}

export interface PedidosOperatorView {
  business: {
    id: string;
    name: string;
  };
  operator: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    stages: OrderOperatorStage[];
  };
  schedule: {
    timezone: string;
    inherit: boolean;
    openNow: boolean | null;
  };
  modalities: ModalityType[];
  confirmationMode: ConfirmationMode;
}

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

export interface OrderOperator {
  id: string;
  name: string;
  email: string;
  phone?: string;
  stages: OrderOperatorStage[];
  role: "operator";
}

export interface OperatorInput {
  name: string;
  email: string;
  phone?: string;
  stages?: OrderOperatorStage[];
}

export interface OrdersValidationIssue {
  step: OrdersConfigStep;
  field: string;
  message: string;
}

export type OperatorMutationResult =
  | { ok: true; operator: OrderOperator }
  | { ok: false; field: "name" | "email" | "phone" | "stages" | "operator"; message: string };

export type ToggleModalityResult =
  | { ok: true }
  | { ok: false; message: string };

export type TogglePaymentMethodResult =
  | { ok: true }
  | { ok: false; message: string };

export type CompleteSetupResult =
  | { ok: true }
  | { ok: false; issues: OrdersValidationIssue[]; error?: string };

export interface OrdersConfigState {
  businessId: string;
  version: number;
  step: OrdersConfigStep;
  visitedSteps: OrdersConfigStep[];
  touched: boolean;
  status: "pending" | "ready";
  profile: OrdersProfileId;
  modalities: ModalityType[];
  onSiteMode: OnSiteMode;
  fulfillment: FulfillmentSettings;
  payments: PaymentPoliciesSettings;
  sla: SlaSettings;
  operators: OrderOperator[];
  updatedAt: string;
}
