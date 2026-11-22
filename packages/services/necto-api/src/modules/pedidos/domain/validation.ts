import {
  CANCELLATION_STAGES,
  CARRIER_IDS,
  CONFIRMATION_EXPIRY_ACTIONS,
  CONFIRMATION_MODES,
  DEFAULT_CARRIERS,
  ON_SITE_MODES,
  OPERATOR_STAGES,
  OUT_OF_HOURS_POLICIES,
  PAYMENT_METHOD_IDS,
  PEDIDOS_LIMITS,
  PEDIDOS_MODALITIES,
  PEDIDOS_PROFILE_IDS,
  PICKUP_MODES,
  SHIPPING_PRICING_MODES,
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
  type PickupScheduleMode,
  type ShippingPricingMode,
} from './catalog';
import type {
  CarrierConfig,
  FulfillmentSettings,
  PaymentPoliciesSettings,
  PedidosConfiguration,
  SlaSettings,
} from './configuration';

export type FieldErrors = Record<string, string[]>;

export interface CarrierInput {
  id: string;
  name?: string;
  enabled: boolean;
  isDefault: boolean;
}

export interface FulfillmentInput {
  hasOwnCourier: boolean;
  carriers: readonly CarrierInput[];
  pickupMode: string;
  confirmationMode: string;
  whatsappNumber: string;
  riskThresholdActive: boolean;
  maxShippingCostRisk: number;
  shippingPricingMode: string;
  flatShippingFee: number;
  freeShippingThreshold: number;
  minimumOrderActive: boolean;
  minimumOrderAmount: number;
}

export interface PaymentsInput {
  methods: readonly string[];
  requireTransferReceipt: boolean;
  requirePrepaymentBeforePrep: boolean;
  confirmationExpiryAction: string;
  cancellationLimit: string;
}

export interface SlaInput {
  confirmationMinutes: number;
  preparationMinutes: number;
  dispatchMinutes: number;
  urgencyThresholdMinutes: number;
  outOfHoursPolicy: string;
  outOfHoursAutoReply: boolean;
  outOfHoursMessage: string;
}

export interface PedidosOperatorInput {
  name: string;
  email: string;
  phone?: string | null;
  stages: readonly string[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_STRIP_PATTERN = /[\s().-]/g;
const PHONE_VALID_PATTERN = new RegExp(
  `^\\+?\\d{${PEDIDOS_LIMITS.phoneDigitsMin},${PEDIDOS_LIMITS.phoneDigitsMax}}$`,
);

function addError(errors: FieldErrors, field: string, message: string): void {
  (errors[field] ??= []).push(message);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string | null): string | null {
  if (typeof phone !== 'string') return null;
  const trimmed = phone.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return (
    normalized.length > 0 &&
    normalized.length <= PEDIDOS_LIMITS.operatorEmailMaxLength &&
    EMAIL_PATTERN.test(normalized)
  );
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.trim().replace(PHONE_STRIP_PATTERN, '');
  return PHONE_VALID_PATTERN.test(cleaned);
}

export function isFiniteIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max;
}

export function hasActiveDeliveryChannel(fulfillment: Pick<FulfillmentSettings, 'hasOwnCourier' | 'carriers'>): boolean {
  return fulfillment.hasOwnCourier || fulfillment.carriers.some((carrier) => carrier.enabled);
}

export function hasUpfrontPaymentMethod(methods: readonly PaymentMethodId[]): boolean {
  return methods.includes('bank_transfer') || methods.includes('payment_link');
}

export function isWhatsappChannelApplicable(confirmationMode: ConfirmationMode): boolean {
  return confirmationMode === 'agent';
}

export function isFreightRiskThresholdApplicable(
  modalities: readonly PedidosModality[],
  confirmationMode: ConfirmationMode,
): boolean {
  return modalities.includes('delivery') && confirmationMode !== 'manual';
}

export function isFlatShippingFeeApplicable(
  modalities: readonly PedidosModality[],
  shippingPricingMode: ShippingPricingMode,
): boolean {
  return modalities.includes('delivery') && (shippingPricingMode === 'fixed' || shippingPricingMode === 'free_from');
}

export function isFreeShippingThresholdApplicable(
  modalities: readonly PedidosModality[],
  shippingPricingMode: ShippingPricingMode,
): boolean {
  return modalities.includes('delivery') && shippingPricingMode === 'free_from';
}

export function isConfirmationSlaApplicable(confirmationMode: ConfirmationMode): boolean {
  return confirmationMode !== 'automatic';
}

export function isDispatchSlaApplicable(modalities: readonly PedidosModality[]): boolean {
  return modalities.includes('delivery');
}

/**
 * Normalizes a carrier list against `DEFAULT_CARRIERS`, preserving canonical carrier names and enforcing the default
 * carrier invariant: disabled carriers cannot be default, at most one enabled carrier is default, and when at least one
 * carrier is enabled, one enabled carrier is always marked default.
 */
export function normalizeCarriers(rawCarriers: readonly CarrierInput[]): CarrierConfig[] {
  const byId = new Map<CarrierId, { enabled: boolean; isDefault: boolean }>();
  for (const item of rawCarriers) {
    if ((CARRIER_IDS as readonly string[]).includes(item.id)) {
      byId.set(item.id as CarrierId, { enabled: Boolean(item.enabled), isDefault: Boolean(item.isDefault) });
    }
  }

  const carriers: CarrierConfig[] = DEFAULT_CARRIERS.map((canonical) => {
    const provided = byId.get(canonical.id);
    const enabled = provided ? provided.enabled : false;
    const isDefault = enabled && provided ? provided.isDefault : false;
    return { id: canonical.id, name: canonical.name, enabled, isDefault };
  });

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

export function normalizeModalities(rawModalities: readonly string[]): { modalities: PedidosModality[]; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const unique: PedidosModality[] = [];
  for (const item of rawModalities) {
    if (!(PEDIDOS_MODALITIES as readonly string[]).includes(item)) {
      addError(errors, 'modalities', `Unknown modality "${item}"`);
      continue;
    }
    const modality = item as PedidosModality;
    if (!unique.includes(modality)) unique.push(modality);
  }
  if (unique.length === 0 && !errors.modalities) {
    addError(errors, 'modalities', 'At least one delivery modality must be active');
  }
  return { modalities: unique, errors };
}

export function validateModalities(
  modalities: readonly string[],
  onSiteMode: string,
): { modalities: PedidosModality[]; onSiteMode: OnSiteMode; errors: FieldErrors } {
  const { modalities: normalized, errors } = normalizeModalities(modalities);
  if (!(ON_SITE_MODES as readonly string[]).includes(onSiteMode)) {
    addError(errors, 'onSiteMode', `onSiteMode must be one of: ${ON_SITE_MODES.join(', ')}`);
  }
  return { modalities: normalized, onSiteMode: onSiteMode as OnSiteMode, errors };
}

export function validateFulfillment(
  input: FulfillmentInput,
  modalities: readonly PedidosModality[],
): { value: FulfillmentSettings; errors: FieldErrors } {
  const errors: FieldErrors = {};

  if (!(PICKUP_MODES as readonly string[]).includes(input.pickupMode)) {
    addError(errors, 'pickupMode', `pickupMode must be one of: ${PICKUP_MODES.join(', ')}`);
  }
  if (!(CONFIRMATION_MODES as readonly string[]).includes(input.confirmationMode)) {
    addError(errors, 'confirmationMode', `confirmationMode must be one of: ${CONFIRMATION_MODES.join(', ')}`);
  }
  if (!(SHIPPING_PRICING_MODES as readonly string[]).includes(input.shippingPricingMode)) {
    addError(errors, 'shippingPricingMode', `shippingPricingMode must be one of: ${SHIPPING_PRICING_MODES.join(', ')}`);
  }

  const seenCarriers = new Set<string>();
  for (let i = 0; i < input.carriers.length; i++) {
    const carrier = input.carriers[i];
    if (!(CARRIER_IDS as readonly string[]).includes(carrier.id)) {
      addError(errors, `carriers.${i}.id`, `Unknown carrier "${carrier.id}"`);
    } else if (seenCarriers.has(carrier.id)) {
      addError(errors, `carriers.${i}.id`, `Duplicate carrier "${carrier.id}"`);
    } else {
      seenCarriers.add(carrier.id);
    }
  }

  const carriers = normalizeCarriers(input.carriers);
  const confirmationMode = input.confirmationMode as ConfirmationMode;
  const shippingPricingMode = input.shippingPricingMode as ShippingPricingMode;
  const trimmedWhatsapp = typeof input.whatsappNumber === 'string' ? input.whatsappNumber.trim() : '';

  if (isWhatsappChannelApplicable(confirmationMode)) {
    const normalizedWhatsapp = normalizePhone(trimmedWhatsapp);
    if (!normalizedWhatsapp || !isValidPhone(normalizedWhatsapp)) {
      addError(
        errors,
        'whatsappNumber',
        `Enter a valid WhatsApp phone number (${PEDIDOS_LIMITS.phoneDigitsMin} to ${PEDIDOS_LIMITS.phoneDigitsMax} digits)`,
      );
    }
  }

  if (modalities.includes('delivery') && !hasActiveDeliveryChannel({ hasOwnCourier: input.hasOwnCourier, carriers })) {
    addError(errors, 'deliveryChannel', 'Enable own courier or at least one carrier for delivery orders');
  }

  if (isFreightRiskThresholdApplicable(modalities, confirmationMode) && input.riskThresholdActive) {
    const { min, max } = PEDIDOS_LIMITS.maxShippingCostRisk;
    if (!isFiniteIntegerInRange(input.maxShippingCostRisk, min, max)) {
      addError(errors, 'maxShippingCostRisk', `maxShippingCostRisk must be an integer between ${min} and ${max}`);
    }
  } else if (!isFiniteIntegerInRange(input.maxShippingCostRisk, 0, PEDIDOS_LIMITS.maxShippingCostRisk.max)) {
    addError(
      errors,
      'maxShippingCostRisk',
      `maxShippingCostRisk must be an integer between 0 and ${PEDIDOS_LIMITS.maxShippingCostRisk.max}`,
    );
  }

  if (isFlatShippingFeeApplicable(modalities, shippingPricingMode)) {
    const { min, max } = PEDIDOS_LIMITS.flatShippingFee;
    if (!isFiniteIntegerInRange(input.flatShippingFee, min, max)) {
      addError(errors, 'flatShippingFee', `flatShippingFee must be an integer between ${min} and ${max}`);
    }
  } else if (!isFiniteIntegerInRange(input.flatShippingFee, 0, PEDIDOS_LIMITS.flatShippingFee.max)) {
    addError(
      errors,
      'flatShippingFee',
      `flatShippingFee must be an integer between 0 and ${PEDIDOS_LIMITS.flatShippingFee.max}`,
    );
  }

  if (isFreeShippingThresholdApplicable(modalities, shippingPricingMode)) {
    const { min, max } = PEDIDOS_LIMITS.freeShippingThreshold;
    if (!isFiniteIntegerInRange(input.freeShippingThreshold, min, max)) {
      addError(errors, 'freeShippingThreshold', `freeShippingThreshold must be an integer between ${min} and ${max}`);
    }
  } else if (!isFiniteIntegerInRange(input.freeShippingThreshold, 0, PEDIDOS_LIMITS.freeShippingThreshold.max)) {
    addError(
      errors,
      'freeShippingThreshold',
      `freeShippingThreshold must be an integer between 0 and ${PEDIDOS_LIMITS.freeShippingThreshold.max}`,
    );
  }

  if (modalities.includes('delivery') && input.minimumOrderActive) {
    const { min, max } = PEDIDOS_LIMITS.minimumOrderAmount;
    if (!isFiniteIntegerInRange(input.minimumOrderAmount, min, max)) {
      addError(errors, 'minimumOrderAmount', `minimumOrderAmount must be an integer between ${min} and ${max}`);
    }
  } else if (!isFiniteIntegerInRange(input.minimumOrderAmount, 0, PEDIDOS_LIMITS.minimumOrderAmount.max)) {
    addError(
      errors,
      'minimumOrderAmount',
      `minimumOrderAmount must be an integer between 0 and ${PEDIDOS_LIMITS.minimumOrderAmount.max}`,
    );
  }

  const value: FulfillmentSettings = {
    hasOwnCourier: input.hasOwnCourier,
    carriers,
    pickupMode: input.pickupMode as PickupScheduleMode,
    confirmationMode,
    whatsappNumber: trimmedWhatsapp,
    riskThresholdActive: input.riskThresholdActive,
    maxShippingCostRisk: input.maxShippingCostRisk,
    shippingPricingMode,
    flatShippingFee: input.flatShippingFee,
    freeShippingThreshold: input.freeShippingThreshold,
    minimumOrderActive: input.minimumOrderActive,
    minimumOrderAmount: input.minimumOrderAmount,
  };

  return { value, errors };
}

export function validatePayments(input: PaymentsInput): { value: PaymentPoliciesSettings; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const uniqueMethods: PaymentMethodId[] = [];
  for (const item of input.methods) {
    if (!(PAYMENT_METHOD_IDS as readonly string[]).includes(item)) {
      addError(errors, 'methods', `Unknown payment method "${item}"`);
      continue;
    }
    const method = item as PaymentMethodId;
    if (!uniqueMethods.includes(method)) uniqueMethods.push(method);
  }
  if (uniqueMethods.length === 0 && !errors.methods) {
    addError(errors, 'methods', 'At least one payment method must be enabled');
  }
  if (input.requirePrepaymentBeforePrep && !hasUpfrontPaymentMethod(uniqueMethods)) {
    addError(
      errors,
      'requirePrepaymentBeforePrep',
      'Enable bank transfer or payment link to require confirmed payment before preparation',
    );
  }
  if (!(CONFIRMATION_EXPIRY_ACTIONS as readonly string[]).includes(input.confirmationExpiryAction)) {
    addError(
      errors,
      'confirmationExpiryAction',
      `confirmationExpiryAction must be one of: ${CONFIRMATION_EXPIRY_ACTIONS.join(', ')}`,
    );
  }
  if (!(CANCELLATION_STAGES as readonly string[]).includes(input.cancellationLimit)) {
    addError(errors, 'cancellationLimit', `cancellationLimit must be one of: ${CANCELLATION_STAGES.join(', ')}`);
  }

  const value: PaymentPoliciesSettings = {
    methods: uniqueMethods,
    requireTransferReceipt: input.requireTransferReceipt,
    requirePrepaymentBeforePrep: input.requirePrepaymentBeforePrep,
    confirmationExpiryAction: input.confirmationExpiryAction as ConfirmationExpiryAction,
    cancellationLimit: input.cancellationLimit as CancellationStage,
  };
  return { value, errors };
}

export function validateSla(
  input: SlaInput,
  modalities: readonly PedidosModality[],
  confirmationMode: ConfirmationMode,
): { value: SlaSettings; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const prep = PEDIDOS_LIMITS.preparationMinutes;
  if (!isFiniteIntegerInRange(input.preparationMinutes, prep.min, prep.max)) {
    addError(errors, 'preparationMinutes', `preparationMinutes must be an integer between ${prep.min} and ${prep.max}`);
  }

  const urgency = PEDIDOS_LIMITS.urgencyThresholdMinutes;
  if (!isFiniteIntegerInRange(input.urgencyThresholdMinutes, urgency.min, urgency.max)) {
    addError(
      errors,
      'urgencyThresholdMinutes',
      `urgencyThresholdMinutes must be an integer between ${urgency.min} and ${urgency.max}`,
    );
  }

  const confirm = PEDIDOS_LIMITS.confirmationMinutes;
  if (isConfirmationSlaApplicable(confirmationMode)) {
    if (!isFiniteIntegerInRange(input.confirmationMinutes, confirm.min, confirm.max)) {
      addError(
        errors,
        'confirmationMinutes',
        `confirmationMinutes must be an integer between ${confirm.min} and ${confirm.max}`,
      );
    }
  } else if (!isFiniteIntegerInRange(input.confirmationMinutes, 0, confirm.max)) {
    addError(errors, 'confirmationMinutes', `confirmationMinutes must be an integer between 0 and ${confirm.max}`);
  }

  const dispatch = PEDIDOS_LIMITS.dispatchMinutes;
  if (isDispatchSlaApplicable(modalities)) {
    if (!isFiniteIntegerInRange(input.dispatchMinutes, dispatch.min, dispatch.max)) {
      addError(
        errors,
        'dispatchMinutes',
        `dispatchMinutes must be an integer between ${dispatch.min} and ${dispatch.max}`,
      );
    }
  } else if (!isFiniteIntegerInRange(input.dispatchMinutes, 0, dispatch.max)) {
    addError(errors, 'dispatchMinutes', `dispatchMinutes must be an integer between 0 and ${dispatch.max}`);
  }

  if (!(OUT_OF_HOURS_POLICIES as readonly string[]).includes(input.outOfHoursPolicy)) {
    addError(errors, 'outOfHoursPolicy', `outOfHoursPolicy must be one of: ${OUT_OF_HOURS_POLICIES.join(', ')}`);
  }

  const trimmedMessage = typeof input.outOfHoursMessage === 'string' ? input.outOfHoursMessage.trim() : '';
  if (input.outOfHoursAutoReply && trimmedMessage.length === 0) {
    addError(errors, 'outOfHoursMessage', 'An out-of-hours message is required when auto-reply is enabled');
  } else if (trimmedMessage.length > PEDIDOS_LIMITS.outOfHoursMessageMaxLength) {
    addError(
      errors,
      'outOfHoursMessage',
      `outOfHoursMessage must be at most ${PEDIDOS_LIMITS.outOfHoursMessageMaxLength} characters`,
    );
  }

  const value: SlaSettings = {
    confirmationMinutes: input.confirmationMinutes,
    preparationMinutes: input.preparationMinutes,
    dispatchMinutes: input.dispatchMinutes,
    urgencyThresholdMinutes: input.urgencyThresholdMinutes,
    outOfHoursPolicy: input.outOfHoursPolicy as OutOfHoursPolicy,
    outOfHoursAutoReply: input.outOfHoursAutoReply,
    outOfHoursMessage: trimmedMessage,
  };
  return { value, errors };
}

export function validateOperatorInput(input: PedidosOperatorInput): {
  value: { name: string; email: string; phone: string | null; stages: OperatorStage[] };
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < PEDIDOS_LIMITS.operatorNameMinLength) {
    addError(errors, 'name', `name must be at least ${PEDIDOS_LIMITS.operatorNameMinLength} characters`);
  } else if (name.length > PEDIDOS_LIMITS.operatorNameMaxLength) {
    addError(errors, 'name', `name must be at most ${PEDIDOS_LIMITS.operatorNameMaxLength} characters`);
  }

  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : '';
  if (!isValidEmail(email)) {
    addError(errors, 'email', 'email must be a valid email address');
  }

  const phone = normalizePhone(input.phone);
  if (phone !== null && !isValidPhone(phone)) {
    addError(
      errors,
      'phone',
      `phone must have between ${PEDIDOS_LIMITS.phoneDigitsMin} and ${PEDIDOS_LIMITS.phoneDigitsMax} digits`,
    );
  }

  const stageSet = new Set<OperatorStage>();
  if (Array.isArray(input.stages)) {
    for (const rawStage of input.stages) {
      if (!(OPERATOR_STAGES as readonly string[]).includes(rawStage)) {
        addError(errors, 'stages', `Unknown operational stage "${rawStage}"`);
      } else {
        stageSet.add(rawStage as OperatorStage);
      }
    }
  }
  const stages = OPERATOR_STAGES.filter((stage) => stageSet.has(stage));
  if (stages.length === 0 && !errors.stages) {
    addError(errors, 'stages', 'At least one operational stage is required');
  }

  return { value: { name, email, phone, stages }, errors };
}

function mergePrefixed(target: FieldErrors, prefix: string, source: FieldErrors): void {
  for (const [field, messages] of Object.entries(source)) {
    const key = prefix ? `${prefix}.${field}` : field;
    for (const message of messages) addError(target, key, message);
  }
}

/** Validates the full Pedidos configuration across every section before marking it ready. Operators are optional. */
export function validateReadiness(config: PedidosConfiguration): FieldErrors {
  const errors: FieldErrors = {};

  if (!(PEDIDOS_PROFILE_IDS as readonly string[]).includes(config.profile as PedidosProfileId)) {
    addError(errors, 'profile', `profile must be one of: ${PEDIDOS_PROFILE_IDS.join(', ')}`);
  }

  const modalitiesResult = validateModalities(config.modalities, config.onSiteMode);
  mergePrefixed(errors, '', modalitiesResult.errors);

  const fulfillmentResult = validateFulfillment(config.fulfillment, config.modalities);
  mergePrefixed(errors, 'fulfillment', fulfillmentResult.errors);

  const paymentsResult = validatePayments(config.payments);
  mergePrefixed(errors, 'payments', paymentsResult.errors);

  const slaResult = validateSla(config.sla, config.modalities, config.fulfillment.confirmationMode);
  mergePrefixed(errors, 'sla', slaResult.errors);

  const seenEmails = new Set<string>();
  for (const operator of config.operators) {
    const opResult = validateOperatorInput({
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      stages: operator.stages,
    });
    mergePrefixed(errors, `operators.${operator.id}`, opResult.errors);
    const normalized = opResult.value.email;
    if (normalized) {
      if (seenEmails.has(normalized)) {
        addError(errors, `operators.${operator.id}.email`, `Duplicate operator email "${normalized}"`);
      } else {
        seenEmails.add(normalized);
      }
    }
  }

  return errors;
}
