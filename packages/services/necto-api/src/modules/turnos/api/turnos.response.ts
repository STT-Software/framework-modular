import { LIMITS, PREFIX_MODES, QUEUE_COLORS, QUEUE_MODES, SETUP_STEPS, TURNOS_PROFILES } from '../domain/catalog';
import type { Queue, TurnosConfiguration } from '../domain/configuration';
import { effectiveOf, ticketExample } from '../domain/rules';
import type { OperatorView } from '../application/turnos-operator.service';
import type { TurnosState } from '../application/turnos-configuration.service';

function queueResponse(queue: Queue, config: TurnosConfiguration) {
  return {
    id: queue.id,
    name: queue.name,
    color: queue.color,
    mode: queue.mode,
    averageMinutes: queue.averageMinutes,
    /** "custom" when the person created it, otherwise the id of the profile that suggested it. */
    source: queue.source,
    /** What the queue sets on its own; `null` is "uses the general rule". */
    overrides: { ...queue.overrides },
    /** What the queue really uses, whether its own or inherited. */
    effective: effectiveOf(queue, config.rules),
    ticketExample: ticketExample(queue, config.rules),
  };
}

/** What the API shows of the Turnos configuration of a business. Dates are ISO strings. */
export function toTurnosResponse(state: TurnosState) {
  const { configuration: config } = state;
  return {
    business: state.business,
    profile: { id: config.profile, suggested: state.suggestedProfile },
    queues: config.queues.map((queue) => queueResponse(queue, config)),
    rules: { ...config.rules },
    operators: config.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      queueIds: operator.queueIds,
      createdAt: operator.createdAt.toISOString(),
    })),
    progress: {
      currentStep: config.currentStep,
      visitedSteps: config.visitedSteps,
      ready: config.readyAt !== null,
      readyAt: config.readyAt?.toISOString() ?? null,
    },
    ...(state.created ? { created: state.created } : {}),
    catalog: {
      profiles: TURNOS_PROFILES.map((profile) => ({ id: profile.id, name: profile.name, description: profile.description, suggestedQueues: profile.queues })),
      colors: QUEUE_COLORS,
      modes: QUEUE_MODES,
      prefixModes: PREFIX_MODES,
      steps: SETUP_STEPS,
      limits: LIMITS,
    },
  };
}

/** What an operator is shown: themselves and their own queues, nothing administrative. */
export function toOperatorResponse(view: OperatorView) {
  return { business: view.business, operator: view.operator, queues: view.queues };
}
