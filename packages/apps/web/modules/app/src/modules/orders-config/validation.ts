import { createInitialConfigState, DEFAULT_CARRIERS, PROFILE_DEFAULTS } from "./constants";
import {
  ALL_OPERATOR_STAGES,
  ORDERS_CONFIG_STEPS,
  type CancellationStage,
  type CarrierConfig,
  type ConfirmationExpiryAction,
  type ConfirmationMode,
  type FulfillmentSettings,
  type ModalityType,
  type OnSiteMode,
  type OperatorInput,
  type OrderOperator,
  type OrderOperatorStage,
  type OrdersConfigState,
  type OrdersConfigStep,
  type OrdersProfileId,
  type OrdersValidationIssue,
  type OutOfHoursPolicy,
  type PaymentMethodId,
  type PaymentPoliciesSettings,
  type PickupScheduleMode,
  type ShippingPricingMode,
} from "./types";

export const ORDERS_CONFIG_LIMITS = {
  maxShippingCostRisk: { min: 0, max: 100_000_000 },
  flatShippingFee: { min: 0, max: 100_000_000 },
  freeShippingThreshold: { min: 1, max: 100_000_000 },
  minimumOrderAmount: { min: 1, max: 100_000_000 },
  preparationMinutes: { min: 1, max: 10_080 },
  urgencyThresholdMinutes: { min: 1, max: 10_080 },
  confirmationMinutes: { min: 1, max: 1_440 },
  dispatchMinutes: { min: 1, max: 10_080 },
  outOfHoursMessage: { min: 1, max: 500 },
  operatorName: { min: 2, max: 80 },
  operatorEmail: { max: 254 },
  operatorPhoneDigits: { min: 7, max: 15 },
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_STRIP_PATTERN = /[\s().-]/g;
const PHONE_VALID_PATTERN = new RegExp(
  `^\\+?\\d{${ORDERS_CONFIG_LIMITS.operatorPhoneDigits.min},${ORDERS_CONFIG_LIMITS.operatorPhoneDigits.max}}$`,
);

const VALID_PROFILES = new Set<OrdersProfileId>(["food", "fashion", "general", "services"]);
const VALID_MODALITIES = new Set<ModalityType>(["pickup", "delivery", "on_site"]);
const VALID_ON_SITE_MODES = new Set<OnSiteMode>(["table_or_zone", "counter"]);
const VALID_CONFIRMATION_MODES = new Set<ConfirmationMode>(["manual", "automatic", "agent"]);
const VALID_PICKUP_MODES = new Set<PickupScheduleMode>(["eventual", "fixed"]);
const VALID_SHIPPING_PRICING_MODES = new Set<ShippingPricingMode>(["fixed", "free_from", "to_confirm"]);
const VALID_PAYMENT_METHODS = new Set<PaymentMethodId>([
  "cash_on_delivery",
  "bank_transfer",
  "payment_link",
  "in_store",
]);
const VALID_CONFIRMATION_EXPIRY_ACTIONS = new Set<ConfirmationExpiryAction>(["alert_only", "auto_cancel"]);
const VALID_CANCELLATION_STAGES = new Set<CancellationStage>([
  "before_confirmation",
  "before_preparation",
  "before_dispatch",
  "never",
]);
const VALID_OUT_OF_HOURS_POLICIES = new Set<OutOfHoursPolicy>(["reject", "schedule"]);
const VALID_OPERATOR_STAGES = new Set<OrderOperatorStage>(ALL_OPERATOR_STAGES);
const VALID_STEPS = new Set<OrdersConfigStep>(ORDERS_CONFIG_STEPS);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string): string | undefined {
  if (typeof phone !== "string") return undefined;
  const trimmed = phone.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && normalized.length <= ORDERS_CONFIG_LIMITS.operatorEmail.max && EMAIL_PATTERN.test(normalized);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(PHONE_STRIP_PATTERN, "");
  return PHONE_VALID_PATTERN.test(cleaned);
}

export function isFiniteIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max;
}

export function isOnSiteModeApplicable(state: Pick<OrdersConfigState, "modalities">): boolean {
  return state.modalities.includes("on_site");
}

export function isWhatsappChannelApplicable(state: Pick<OrdersConfigState, "fulfillment">): boolean {
  return state.fulfillment.confirmationMode === "agent";
}

export function isFreightRiskThresholdApplicable(state: Pick<OrdersConfigState, "modalities" | "fulfillment">): boolean {
  return state.modalities.includes("delivery") && state.fulfillment.confirmationMode !== "manual";
}

export function isDeliveryPricingApplicable(state: Pick<OrdersConfigState, "modalities">): boolean {
  return state.modalities.includes("delivery");
}

export function isFlatShippingFeeApplicable(state: Pick<OrdersConfigState, "modalities" | "fulfillment">): boolean {
  return (
    state.modalities.includes("delivery") &&
    (state.fulfillment.shippingPricingMode === "fixed" || state.fulfillment.shippingPricingMode === "free_from")
  );
}

export function isFreeShippingThresholdApplicable(
  state: Pick<OrdersConfigState, "modalities" | "fulfillment">,
): boolean {
  return state.modalities.includes("delivery") && state.fulfillment.shippingPricingMode === "free_from";
}

export function isTransferReceiptApplicable(state: Pick<OrdersConfigState, "payments">): boolean {
  return state.payments.methods.includes("bank_transfer");
}

export function isConfirmationExpiryApplicable(state: Pick<OrdersConfigState, "fulfillment">): boolean {
  return state.fulfillment.confirmationMode !== "automatic";
}

export function hasUpfrontPaymentMethod(methods: readonly PaymentMethodId[]): boolean {
  return methods.includes("bank_transfer") || methods.includes("payment_link");
}

export function isConfirmationSlaApplicable(state: Pick<OrdersConfigState, "fulfillment">): boolean {
  return state.fulfillment.confirmationMode !== "automatic";
}

export function isDispatchSlaApplicable(state: Pick<OrdersConfigState, "modalities">): boolean {
  return state.modalities.includes("delivery");
}

export function hasActiveDeliveryChannel(fulfillment: Pick<FulfillmentSettings, "hasOwnCourier" | "carriers">): boolean {
  return fulfillment.hasOwnCourier || fulfillment.carriers.some((carrier) => carrier.enabled);
}

export function normalizeOperatorStages(stages?: readonly OrderOperatorStage[]): OrderOperatorStage[] {
  if (stages === undefined) return [...ALL_OPERATOR_STAGES];
  const seen = new Set<OrderOperatorStage>();
  for (const stage of stages) {
    if (VALID_OPERATOR_STAGES.has(stage)) {
      seen.add(stage);
    }
  }
  return ALL_OPERATOR_STAGES.filter((stage) => seen.has(stage));
}

export function generateOperatorId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `op_${randomUuid}`;
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "N"
  );
}

export type OperatorValidationResult =
  | { ok: true; value: { name: string; email: string; phone?: string; stages: OrderOperatorStage[] } }
  | { ok: false; field: "name" | "email" | "phone" | "stages"; message: string };

export function validateOperatorInput(
  input: OperatorInput,
  existingOperators: readonly OrderOperator[],
  editingOperatorId?: string | null,
): OperatorValidationResult {
  const name = input.name.trim();
  if (name.length < ORDERS_CONFIG_LIMITS.operatorName.min) {
    return {
      ok: false,
      field: "name",
      message: `Escribe un nombre de al menos ${ORDERS_CONFIG_LIMITS.operatorName.min} caracteres.`,
    };
  }
  if (name.length > ORDERS_CONFIG_LIMITS.operatorName.max) {
    return {
      ok: false,
      field: "name",
      message: `El nombre admite hasta ${ORDERS_CONFIG_LIMITS.operatorName.max} caracteres.`,
    };
  }

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return {
      ok: false,
      field: "email",
      message: "Escribe un correo electrónico válido.",
    };
  }

  const duplicate = existingOperators.some(
    (other) => other.id !== editingOperatorId && normalizeEmail(other.email) === email,
  );
  if (duplicate) {
    return {
      ok: false,
      field: "email",
      message: "Este correo ya pertenece a otro operador registrado.",
    };
  }

  const phone = normalizePhone(input.phone);
  if (phone !== undefined && !isValidPhone(phone)) {
    return {
      ok: false,
      field: "phone",
      message: `Escribe un número de teléfono válido (entre ${ORDERS_CONFIG_LIMITS.operatorPhoneDigits.min} y ${ORDERS_CONFIG_LIMITS.operatorPhoneDigits.max} dígitos).`,
    };
  }

  const stages = normalizeOperatorStages(input.stages);
  if (stages.length === 0) {
    return {
      ok: false,
      field: "stages",
      message: "Selecciona al menos una etapa operativa para este operador.",
    };
  }

  return {
    ok: true,
    value: phone !== undefined ? { name, email, phone, stages } : { name, email, stages },
  };
}

export function validateStep(state: OrdersConfigState, step: OrdersConfigStep): OrdersValidationIssue[] {
  const issues: OrdersValidationIssue[] = [];

  switch (step) {
    case "profile": {
      if (!(state.profile in PROFILE_DEFAULTS)) {
        issues.push({
          step: "profile",
          field: "profile",
          message: "Selecciona un perfil de pedidos válido.",
        });
      }
      break;
    }

    case "modalities": {
      if (state.modalities.length === 0) {
        issues.push({
          step: "modalities",
          field: "modalities",
          message: "Debes mantener al menos una modalidad de entrega activa.",
        });
      }
      break;
    }

    case "fulfillment": {
      if (isWhatsappChannelApplicable(state)) {
        const whatsapp = normalizePhone(state.fulfillment.whatsappNumber);
        if (!whatsapp || !isValidPhone(whatsapp)) {
          issues.push({
            step: "fulfillment",
            field: "whatsappNumber",
            message: `Ingresa un número de WhatsApp válido (entre ${ORDERS_CONFIG_LIMITS.operatorPhoneDigits.min} y ${ORDERS_CONFIG_LIMITS.operatorPhoneDigits.max} dígitos) para el agente.`,
          });
        }
      }

      if (state.modalities.includes("delivery") && !hasActiveDeliveryChannel(state.fulfillment)) {
        issues.push({
          step: "fulfillment",
          field: "deliveryChannel",
          message: "Activa mensajería propia o al menos una transportadora para entregas a domicilio.",
        });
      }

      if (isFreightRiskThresholdApplicable(state) && state.fulfillment.riskThresholdActive) {
        const { min, max } = ORDERS_CONFIG_LIMITS.maxShippingCostRisk;
        if (!isFiniteIntegerInRange(state.fulfillment.maxShippingCostRisk, min, max)) {
          issues.push({
            step: "fulfillment",
            field: "maxShippingCostRisk",
            message: "El tope máximo de envío debe ser un número entero entre 0 y 100.000.000.",
          });
        }
      }

      if (isFlatShippingFeeApplicable(state)) {
        const { min, max } = ORDERS_CONFIG_LIMITS.flatShippingFee;
        if (!isFiniteIntegerInRange(state.fulfillment.flatShippingFee, min, max)) {
          issues.push({
            step: "fulfillment",
            field: "flatShippingFee",
            message: "La tarifa de envío debe ser un número entero entre 0 y 100.000.000.",
          });
        }
      }

      if (isFreeShippingThresholdApplicable(state)) {
        const { min, max } = ORDERS_CONFIG_LIMITS.freeShippingThreshold;
        if (!isFiniteIntegerInRange(state.fulfillment.freeShippingThreshold, min, max)) {
          issues.push({
            step: "fulfillment",
            field: "freeShippingThreshold",
            message: "El monto para envío gratis debe ser un número entero entre 1 y 100.000.000.",
          });
        }
      }

      if (isDeliveryPricingApplicable(state) && state.fulfillment.minimumOrderActive) {
        const { min, max } = ORDERS_CONFIG_LIMITS.minimumOrderAmount;
        if (!isFiniteIntegerInRange(state.fulfillment.minimumOrderAmount, min, max)) {
          issues.push({
            step: "fulfillment",
            field: "minimumOrderAmount",
            message: "El monto mínimo de pedido debe ser un número entero entre 1 y 100.000.000.",
          });
        }
      }
      break;
    }

    case "payments": {
      if (state.payments.methods.length === 0) {
        issues.push({
          step: "payments",
          field: "methods",
          message: "Debes mantener al menos un método de pago habilitado.",
        });
      }

      if (state.payments.requirePrepaymentBeforePrep && !hasUpfrontPaymentMethod(state.payments.methods)) {
        issues.push({
          step: "payments",
          field: "requirePrepaymentBeforePrep",
          message:
            "Para exigir pago confirmado antes de preparar, habilita Transferencia bancaria o Link de pago.",
        });
      }
      break;
    }

    case "sla": {
      const prepLimits = ORDERS_CONFIG_LIMITS.preparationMinutes;
      if (!isFiniteIntegerInRange(state.sla.preparationMinutes, prepLimits.min, prepLimits.max)) {
        issues.push({
          step: "sla",
          field: "preparationMinutes",
          message: "El tiempo objetivo de preparación debe ser un número entero entre 1 y 10.080 minutos.",
        });
      }

      const urgencyLimits = ORDERS_CONFIG_LIMITS.urgencyThresholdMinutes;
      if (!isFiniteIntegerInRange(state.sla.urgencyThresholdMinutes, urgencyLimits.min, urgencyLimits.max)) {
        issues.push({
          step: "sla",
          field: "urgencyThresholdMinutes",
          message: "El umbral de urgencia debe ser un número entero entre 1 y 10.080 minutos.",
        });
      }

      if (isConfirmationSlaApplicable(state)) {
        const confirmLimits = ORDERS_CONFIG_LIMITS.confirmationMinutes;
        if (!isFiniteIntegerInRange(state.sla.confirmationMinutes, confirmLimits.min, confirmLimits.max)) {
          issues.push({
            step: "sla",
            field: "confirmationMinutes",
            message: "El tiempo máximo de confirmación debe ser un número entero entre 1 y 1.440 minutos.",
          });
        }
      }

      if (isDispatchSlaApplicable(state)) {
        const dispatchLimits = ORDERS_CONFIG_LIMITS.dispatchMinutes;
        if (!isFiniteIntegerInRange(state.sla.dispatchMinutes, dispatchLimits.min, dispatchLimits.max)) {
          issues.push({
            step: "sla",
            field: "dispatchMinutes",
            message: "El tiempo estimado de despacho debe ser un número entero entre 1 y 10.080 minutos.",
          });
        }
      }

      if (state.sla.outOfHoursAutoReply) {
        const trimmed = state.sla.outOfHoursMessage.trim();
        if (trimmed.length < ORDERS_CONFIG_LIMITS.outOfHoursMessage.min) {
          issues.push({
            step: "sla",
            field: "outOfHoursMessage",
            message: "Escribe el mensaje de respuesta automática fuera de horario.",
          });
        } else if (trimmed.length > ORDERS_CONFIG_LIMITS.outOfHoursMessage.max) {
          issues.push({
            step: "sla",
            field: "outOfHoursMessage",
            message: `El mensaje fuera de horario admite hasta ${ORDERS_CONFIG_LIMITS.outOfHoursMessage.max} caracteres.`,
          });
        }
      }
      break;
    }

    case "operators": {
      const seenEmails = new Set<string>();
      for (const operator of state.operators) {
        const result = validateOperatorInput(
          {
            name: operator.name,
            email: operator.email,
            phone: operator.phone,
            stages: operator.stages,
          },
          state.operators,
          operator.id,
        );
        if (!result.ok) {
          issues.push({
            step: "operators",
            field: `operator:${operator.id}:${result.field}`,
            message: `Operador «${operator.name.trim() || operator.email || operator.id}»: ${result.message}`,
          });
          continue;
        }
        const normalized = result.value.email;
        if (seenEmails.has(normalized)) {
          issues.push({
            step: "operators",
            field: `operator:${operator.id}:email`,
            message: `El correo ${normalized} está duplicado en la lista de operadores.`,
          });
        } else {
          seenEmails.add(normalized);
        }
      }
      break;
    }

    case "review":
      break;
  }

  return issues;
}

export function validateOrdersConfig(state: OrdersConfigState): OrdersValidationIssue[] {
  const stepsToValidate: readonly OrdersConfigStep[] = [
    "profile",
    "modalities",
    "fulfillment",
    "payments",
    "sla",
    "operators",
  ];
  return stepsToValidate.flatMap((step) => validateStep(state, step));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCarriers(rawCarriers: unknown): CarrierConfig[] {
  const storedById = new Map<string, { enabled?: boolean; isDefault?: boolean }>();
  if (Array.isArray(rawCarriers)) {
    for (const item of rawCarriers) {
      if (!isRecord(item) || typeof item.id !== "string") continue;
      storedById.set(item.id, {
        enabled: typeof item.enabled === "boolean" ? item.enabled : undefined,
        isDefault: typeof item.isDefault === "boolean" ? item.isDefault : undefined,
      });
    }
  }

  const carriers: CarrierConfig[] = DEFAULT_CARRIERS.map((defaults) => {
    const stored = storedById.get(defaults.id);
    const enabled = stored?.enabled ?? defaults.enabled;
    const isDefault = enabled ? (stored?.isDefault ?? defaults.isDefault) : false;
    return { ...defaults, enabled, isDefault };
  });

  // Enforce carrier default invariant: at most one enabled default, and if any enabled exists, ensure one is default.
  let hasDefault = false;
  for (const carrier of carriers) {
    if (!carrier.enabled) {
      carrier.isDefault = false;
    } else if (carrier.isDefault) {
      if (hasDefault) carrier.isDefault = false;
      else hasDefault = true;
    }
  }
  if (!hasDefault) {
    const firstEnabled = carriers.find((carrier) => carrier.enabled);
    if (firstEnabled) firstEnabled.isDefault = true;
  }

  return carriers;
}

/**
 * Defensively hydrates an orders config state from untrusted or legacy v1 localStorage JSON.
 */
export function hydrateOrdersConfigState(raw: unknown, businessId: string): OrdersConfigState {
  if (!isRecord(raw)) {
    return createInitialConfigState(businessId);
  }

  const profile: OrdersProfileId =
    typeof raw.profile === "string" && VALID_PROFILES.has(raw.profile as OrdersProfileId)
      ? (raw.profile as OrdersProfileId)
      : "food";

  const base = createInitialConfigState(businessId, profile);

  const step: OrdersConfigStep =
    typeof raw.step === "string" && VALID_STEPS.has(raw.step as OrdersConfigStep)
      ? (raw.step as OrdersConfigStep)
      : base.step;

  const stepIdx = ORDERS_CONFIG_STEPS.indexOf(step);
  let visitedSteps: OrdersConfigStep[];
  if (Array.isArray(raw.visitedSteps)) {
    const seen = new Set<OrdersConfigStep>();
    for (const item of raw.visitedSteps) {
      if (typeof item === "string" && VALID_STEPS.has(item as OrdersConfigStep)) {
        seen.add(item as OrdersConfigStep);
      }
    }
    seen.add(step);
    visitedSteps = [...seen];
  } else {
    // Legacy payloads lacked visitedSteps; backfill steps up to the saved step.
    visitedSteps = ORDERS_CONFIG_STEPS.slice(0, Math.max(stepIdx + 1, 1));
  }

  let modalities = base.modalities;
  if (Array.isArray(raw.modalities)) {
    const unique: ModalityType[] = [];
    for (const item of raw.modalities) {
      if (
        typeof item === "string" &&
        VALID_MODALITIES.has(item as ModalityType) &&
        !unique.includes(item as ModalityType)
      ) {
        unique.push(item as ModalityType);
      }
    }
    if (unique.length > 0) modalities = unique;
  }

  const onSiteMode: OnSiteMode =
    typeof raw.onSiteMode === "string" && VALID_ON_SITE_MODES.has(raw.onSiteMode as OnSiteMode)
      ? (raw.onSiteMode as OnSiteMode)
      : base.onSiteMode;

  const rawFulfillment = isRecord(raw.fulfillment) ? raw.fulfillment : {};
  const fulfillment: FulfillmentSettings = {
    hasOwnCourier:
      typeof rawFulfillment.hasOwnCourier === "boolean"
        ? rawFulfillment.hasOwnCourier
        : base.fulfillment.hasOwnCourier,
    carriers: normalizeCarriers(rawFulfillment.carriers),
    pickupMode:
      typeof rawFulfillment.pickupMode === "string" &&
      VALID_PICKUP_MODES.has(rawFulfillment.pickupMode as PickupScheduleMode)
        ? (rawFulfillment.pickupMode as PickupScheduleMode)
        : base.fulfillment.pickupMode,
    confirmationMode:
      typeof rawFulfillment.confirmationMode === "string" &&
      VALID_CONFIRMATION_MODES.has(rawFulfillment.confirmationMode as ConfirmationMode)
        ? (rawFulfillment.confirmationMode as ConfirmationMode)
        : base.fulfillment.confirmationMode,
    whatsappNumber:
      typeof rawFulfillment.whatsappNumber === "string"
        ? rawFulfillment.whatsappNumber
        : base.fulfillment.whatsappNumber,
    riskThresholdActive:
      typeof rawFulfillment.riskThresholdActive === "boolean"
        ? rawFulfillment.riskThresholdActive
        : base.fulfillment.riskThresholdActive,
    maxShippingCostRisk:
      typeof rawFulfillment.maxShippingCostRisk === "number" && Number.isFinite(rawFulfillment.maxShippingCostRisk)
        ? rawFulfillment.maxShippingCostRisk
        : base.fulfillment.maxShippingCostRisk,
    shippingPricingMode:
      typeof rawFulfillment.shippingPricingMode === "string" &&
      VALID_SHIPPING_PRICING_MODES.has(rawFulfillment.shippingPricingMode as ShippingPricingMode)
        ? (rawFulfillment.shippingPricingMode as ShippingPricingMode)
        : base.fulfillment.shippingPricingMode,
    flatShippingFee:
      typeof rawFulfillment.flatShippingFee === "number" && Number.isFinite(rawFulfillment.flatShippingFee)
        ? rawFulfillment.flatShippingFee
        : base.fulfillment.flatShippingFee,
    freeShippingThreshold:
      typeof rawFulfillment.freeShippingThreshold === "number" && Number.isFinite(rawFulfillment.freeShippingThreshold)
        ? rawFulfillment.freeShippingThreshold
        : base.fulfillment.freeShippingThreshold,
    minimumOrderActive:
      typeof rawFulfillment.minimumOrderActive === "boolean"
        ? rawFulfillment.minimumOrderActive
        : base.fulfillment.minimumOrderActive,
    minimumOrderAmount:
      typeof rawFulfillment.minimumOrderAmount === "number" && Number.isFinite(rawFulfillment.minimumOrderAmount)
        ? rawFulfillment.minimumOrderAmount
        : base.fulfillment.minimumOrderAmount,
  };

  const rawPayments = isRecord(raw.payments) ? raw.payments : {};
  let paymentMethods = base.payments.methods;
  if (Array.isArray(rawPayments.methods)) {
    const unique: PaymentMethodId[] = [];
    for (const item of rawPayments.methods) {
      if (
        typeof item === "string" &&
        VALID_PAYMENT_METHODS.has(item as PaymentMethodId) &&
        !unique.includes(item as PaymentMethodId)
      ) {
        unique.push(item as PaymentMethodId);
      }
    }
    if (unique.length > 0) paymentMethods = unique;
  }

  const payments: PaymentPoliciesSettings = {
    methods: paymentMethods,
    requireTransferReceipt:
      typeof rawPayments.requireTransferReceipt === "boolean"
        ? rawPayments.requireTransferReceipt
        : base.payments.requireTransferReceipt,
    requirePrepaymentBeforePrep:
      typeof rawPayments.requirePrepaymentBeforePrep === "boolean"
        ? rawPayments.requirePrepaymentBeforePrep
        : base.payments.requirePrepaymentBeforePrep,
    confirmationExpiryAction:
      typeof rawPayments.confirmationExpiryAction === "string" &&
      VALID_CONFIRMATION_EXPIRY_ACTIONS.has(rawPayments.confirmationExpiryAction as ConfirmationExpiryAction)
        ? (rawPayments.confirmationExpiryAction as ConfirmationExpiryAction)
        : base.payments.confirmationExpiryAction,
    cancellationLimit:
      typeof rawPayments.cancellationLimit === "string" &&
      VALID_CANCELLATION_STAGES.has(rawPayments.cancellationLimit as CancellationStage)
        ? (rawPayments.cancellationLimit as CancellationStage)
        : base.payments.cancellationLimit,
  };

  const rawSla = isRecord(raw.sla) ? raw.sla : {};
  const sla = {
    confirmationMinutes:
      typeof rawSla.confirmationMinutes === "number" && Number.isFinite(rawSla.confirmationMinutes)
        ? rawSla.confirmationMinutes
        : base.sla.confirmationMinutes,
    preparationMinutes:
      typeof rawSla.preparationMinutes === "number" && Number.isFinite(rawSla.preparationMinutes)
        ? rawSla.preparationMinutes
        : base.sla.preparationMinutes,
    dispatchMinutes:
      typeof rawSla.dispatchMinutes === "number" && Number.isFinite(rawSla.dispatchMinutes)
        ? rawSla.dispatchMinutes
        : base.sla.dispatchMinutes,
    urgencyThresholdMinutes:
      typeof rawSla.urgencyThresholdMinutes === "number" && Number.isFinite(rawSla.urgencyThresholdMinutes)
        ? rawSla.urgencyThresholdMinutes
        : base.sla.urgencyThresholdMinutes,
    outOfHoursPolicy:
      typeof rawSla.outOfHoursPolicy === "string" &&
      VALID_OUT_OF_HOURS_POLICIES.has(rawSla.outOfHoursPolicy as OutOfHoursPolicy)
        ? (rawSla.outOfHoursPolicy as OutOfHoursPolicy)
        : base.sla.outOfHoursPolicy,
    outOfHoursAutoReply:
      typeof rawSla.outOfHoursAutoReply === "boolean"
        ? rawSla.outOfHoursAutoReply
        : base.sla.outOfHoursAutoReply,
    outOfHoursMessage:
      typeof rawSla.outOfHoursMessage === "string" ? rawSla.outOfHoursMessage : base.sla.outOfHoursMessage,
  };

  const operators: OrderOperator[] = [];
  if (Array.isArray(raw.operators)) {
    for (const entry of raw.operators) {
      if (!isRecord(entry)) continue;
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const email = typeof entry.email === "string" ? normalizeEmail(entry.email) : "";
      if (!name && !email) continue;
      const id = typeof entry.id === "string" && entry.id.trim().length > 0 ? entry.id.trim() : generateOperatorId();
      const phone = normalizePhone(typeof entry.phone === "string" ? entry.phone : undefined);
      let stages: OrderOperatorStage[] = [...ALL_OPERATOR_STAGES];
      if (Array.isArray(entry.stages)) {
        const filtered = normalizeOperatorStages(
          entry.stages.filter((item): item is OrderOperatorStage => typeof item === "string" && VALID_OPERATOR_STAGES.has(item as OrderOperatorStage)),
        );
        if (filtered.length > 0) stages = filtered;
      }
      operators.push({
        id,
        name,
        email,
        ...(phone !== undefined ? { phone } : {}),
        stages,
        role: "operator",
      });
    }
  }

  const version =
    typeof raw.version === "number" && Number.isInteger(raw.version) && raw.version >= 1
      ? raw.version
      : base.version;
  const status = raw.status === "ready" ? "ready" : "pending";
  const touched = typeof raw.touched === "boolean" ? raw.touched : status === "ready" || version > 1;

  return {
    businessId,
    version,
    step,
    visitedSteps,
    touched,
    status,
    profile,
    modalities,
    onSiteMode,
    fulfillment,
    payments,
    sla,
    operators,
    updatedAt: typeof raw.updatedAt === "string" && raw.updatedAt.trim().length > 0 ? raw.updatedAt : base.updatedAt,
  };
}
