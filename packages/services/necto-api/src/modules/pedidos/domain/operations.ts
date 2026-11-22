import { randomUUID } from 'node:crypto';
import {
  PEDIDOS_LIMITS,
  PEDIDOS_PROFILE_IDS,
  PEDIDOS_STEPS,
  type PedidosProfileId,
  type PedidosStep,
} from './catalog';
import { defaultsForProfile, type PedidosConfiguration } from './configuration';
import {
  DuplicatePedidosOperatorError,
  InvalidPedidosDataError,
  PedidosIncompleteError,
  PedidosOperatorNotFoundError,
} from './errors';
import {
  normalizeEmail,
  validateFulfillment,
  validateModalities,
  validateOperatorInput,
  validatePayments,
  validateReadiness,
  validateSla,
  type FulfillmentInput,
  type PaymentsInput,
  type PedidosOperatorInput,
  type SlaInput,
} from './validation';

export type IdGenerator = () => string;

function hasErrors(errors: Record<string, string[]>): boolean {
  return Object.keys(errors).length > 0;
}

function edited(config: PedidosConfiguration, now: Date): PedidosConfiguration {
  return { ...config, touched: true, readyAt: null, updatedAt: now };
}

/**
 * Seeds the configuration once on first open using the business category's suggested profile.
 * Keeps `touched: false` and `readyAt: null`; subsequent calls are a no-op returning the exact same reference.
 */
export function ensureSeeded(
  config: PedidosConfiguration,
  suggestedProfile: PedidosProfileId,
  now: Date,
): PedidosConfiguration {
  if (config.seeded) return config;
  const defaults = defaultsForProfile(suggestedProfile);
  return {
    ...config,
    profile: suggestedProfile,
    seeded: true,
    touched: false,
    readyAt: null,
    modalities: defaults.modalities,
    onSiteMode: defaults.onSiteMode,
    fulfillment: defaults.fulfillment,
    payments: defaults.payments,
    sla: defaults.sla,
    updatedAt: now,
  };
}

/**
 * Switches the operational profile: resets modalities, onSiteMode, fulfillment (with fresh DEFAULT_CARRIERS), payments,
 * and SLA to the new profile's preset, preserves existing operators, sets `touched: false` and clears `readyAt`.
 * Returns `config` unchanged when already cleanly seeded on that profile with `touched === false` and `readyAt === null`.
 */
export function changeProfile(config: PedidosConfiguration, profile: string, now: Date): PedidosConfiguration {
  const chosen = PEDIDOS_PROFILE_IDS.find((candidate) => candidate === profile);
  if (!chosen) {
    throw new InvalidPedidosDataError({ profile: [`profile must be one of: ${PEDIDOS_PROFILE_IDS.join(', ')}`] });
  }
  if (config.seeded && config.profile === chosen && !config.touched && config.readyAt === null) {
    return config;
  }
  const defaults = defaultsForProfile(chosen);
  return {
    ...config,
    profile: chosen,
    seeded: true,
    touched: false,
    readyAt: null,
    modalities: defaults.modalities,
    onSiteMode: defaults.onSiteMode,
    fulfillment: defaults.fulfillment,
    payments: defaults.payments,
    sla: defaults.sla,
    updatedAt: now,
  };
}

export function updateModalities(
  config: PedidosConfiguration,
  modalities: readonly string[],
  onSiteMode: string,
  now: Date,
): PedidosConfiguration {
  const result = validateModalities(modalities, onSiteMode);
  if (hasErrors(result.errors)) throw new InvalidPedidosDataError(result.errors);
  return edited({ ...config, modalities: result.modalities, onSiteMode: result.onSiteMode }, now);
}

export function updateFulfillment(
  config: PedidosConfiguration,
  input: FulfillmentInput,
  now: Date,
): PedidosConfiguration {
  const result = validateFulfillment(input, config.modalities);
  if (hasErrors(result.errors)) throw new InvalidPedidosDataError(result.errors);
  return edited({ ...config, fulfillment: result.value }, now);
}

export function updatePayments(
  config: PedidosConfiguration,
  input: PaymentsInput,
  now: Date,
): PedidosConfiguration {
  const result = validatePayments(input);
  if (hasErrors(result.errors)) throw new InvalidPedidosDataError(result.errors);
  return edited({ ...config, payments: result.value }, now);
}

export function updateSla(config: PedidosConfiguration, input: SlaInput, now: Date): PedidosConfiguration {
  const result = validateSla(input, config.modalities, config.fulfillment.confirmationMode);
  if (hasErrors(result.errors)) throw new InvalidPedidosDataError(result.errors);
  return edited({ ...config, sla: result.value }, now);
}

export function addOperator(
  config: PedidosConfiguration,
  input: PedidosOperatorInput,
  now: Date,
  ids: IdGenerator = randomUUID,
): PedidosConfiguration {
  if (config.operators.length >= PEDIDOS_LIMITS.maxOperators) {
    throw new InvalidPedidosDataError({
      operators: [`A business can have at most ${PEDIDOS_LIMITS.maxOperators} operators`],
    });
  }
  const result = validateOperatorInput(input);
  if (hasErrors(result.errors)) throw new InvalidPedidosDataError(result.errors);

  if (config.operators.some((existing) => normalizeEmail(existing.email) === result.value.email)) {
    throw new DuplicatePedidosOperatorError(result.value.email);
  }

  return edited(
    {
      ...config,
      operators: [
        ...config.operators,
        {
          id: ids(),
          name: result.value.name,
          email: result.value.email,
          phone: result.value.phone,
          stages: result.value.stages,
          createdAt: now,
        },
      ],
    },
    now,
  );
}

export function updateOperator(
  config: PedidosConfiguration,
  operatorId: string,
  input: PedidosOperatorInput,
  now: Date,
): PedidosConfiguration {
  if (!config.operators.some((operator) => operator.id === operatorId)) {
    throw new PedidosOperatorNotFoundError();
  }
  const result = validateOperatorInput(input);
  if (hasErrors(result.errors)) throw new InvalidPedidosDataError(result.errors);

  const collides = config.operators.some(
    (other) => other.id !== operatorId && normalizeEmail(other.email) === result.value.email,
  );
  if (collides) {
    throw new DuplicatePedidosOperatorError(result.value.email);
  }

  return edited(
    {
      ...config,
      operators: config.operators.map((operator) =>
        operator.id === operatorId
          ? {
              ...operator,
              name: result.value.name,
              email: result.value.email,
              phone: result.value.phone,
              stages: result.value.stages,
            }
          : operator,
      ),
    },
    now,
  );
}

export function removeOperator(config: PedidosConfiguration, operatorId: string, now: Date): PedidosConfiguration {
  if (!config.operators.some((operator) => operator.id === operatorId)) {
    throw new PedidosOperatorNotFoundError();
  }
  return edited(
    {
      ...config,
      operators: config.operators.filter((operator) => operator.id !== operatorId),
    },
    now,
  );
}

/**
 * Records wizard navigation progress (`currentStep` and `visitedSteps`).
 * Does NOT mark the configuration as `touched` and does NOT clear `readyAt`.
 */
export function saveProgress(
  config: PedidosConfiguration,
  currentStep: string,
  visitedSteps: readonly string[] | undefined,
  now: Date,
): PedidosConfiguration {
  const errors: Record<string, string[]> = {};
  if (!(PEDIDOS_STEPS as readonly string[]).includes(currentStep)) {
    errors.currentStep = [`currentStep must be one of: ${PEDIDOS_STEPS.join(', ')}`];
  }
  const merged = new Set<PedidosStep>(config.visitedSteps);
  if (visitedSteps !== undefined) {
    for (const step of visitedSteps) {
      if (!(PEDIDOS_STEPS as readonly string[]).includes(step)) {
        (errors.visitedSteps ??= []).push(`Unknown step "${step}"`);
      } else {
        merged.add(step as PedidosStep);
      }
    }
  }
  if (hasErrors(errors)) throw new InvalidPedidosDataError(errors);

  const validStep = currentStep as PedidosStep;
  merged.add(validStep);
  const nextVisited = [...merged];

  const sameStep = config.currentStep === validStep;
  const sameVisited =
    nextVisited.length === config.visitedSteps.length &&
    nextVisited.every((step, index) => config.visitedSteps[index] === step);
  if (sameStep && sameVisited) return config;

  return {
    ...config,
    currentStep: validStep,
    visitedSteps: nextVisited,
    updatedAt: now,
  };
}

/**
 * Validates the entire configuration and marks it ready. Idempotent when already ready (keeps the original `readyAt`).
 */
export function completeConfiguration(config: PedidosConfiguration, now: Date): PedidosConfiguration {
  const problems = validateReadiness(config);
  if (hasErrors(problems)) throw new PedidosIncompleteError(problems);
  if (config.readyAt !== null) return config;
  const visitedSteps = config.visitedSteps.includes('review')
    ? config.visitedSteps
    : [...config.visitedSteps, 'review' as PedidosStep];
  return {
    ...config,
    readyAt: now,
    currentStep: 'review',
    visitedSteps,
    updatedAt: now,
  };
}
