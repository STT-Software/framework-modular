import { FIELD_TYPES, LIMITS, OPERATOR_STATUSES, OPERATOR_VIEWS, PREFIX_MODES, QUEUE_COLORS, QUEUE_MODES, QUEUE_STATUSES, ROOM_NAME_DISPLAYS, SETUP_STEPS, TICKET_STATUSES, TURNOS_PROFILES } from '../domain/catalog';
import { RANGE_PRESETS } from '../domain/range';
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
    /** `paused`: the queue takes no new turns and keeps the ones it has. */
    status: queue.status,
    /** What the queue asks when a turn is created. */
    fields: queue.fields.map((field) => ({ id: field.id, label: field.label, type: field.type, required: field.required, options: [...field.options] })),
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
    profile: {
      id: config.profile,
      suggested: state.suggestedProfile,
      /**
       * True while the queues are still the untouched suggestions and there are no operators: changing the profile then REPLACES
       * them. False: changing it keeps everything, and the interface should offer to add the new suggestions (`addSuggestedQueues`).
       */
      suggestionsUntouched: !config.touched && config.operators.length === 0,
    },
    queues: config.queues.map((queue) => queueResponse(queue, config)),
    rules: { ...config.rules },
    operators: config.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      queueIds: operator.queueIds,
      /** The views of the workspace the operator may use; none means they cannot operate. */
      views: operator.views,
      /** `pending` until their first sign-in, then `active`; `inactive` when the administrator switched them off. */
      status: operator.status,
      activatedAt: operator.activatedAt?.toISOString() ?? null,
      createdAt: operator.createdAt.toISOString(),
    })),
    roomScreen: { ...config.roomScreen },
    survey: { ...config.survey, channels: { ...config.survey.channels } },
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
      operatorViews: OPERATOR_VIEWS,
      operatorStatuses: OPERATOR_STATUSES,
      queueStatuses: QUEUE_STATUSES,
      fieldTypes: FIELD_TYPES,
      ticketStatuses: TICKET_STATUSES,
      roomNameDisplays: ROOM_NAME_DISPLAYS,
      ranges: RANGE_PRESETS,
    },
  };
}

/** What an operator is shown: themselves and their own queues, nothing administrative. */
export function toOperatorResponse(view: OperatorView) {
  return {
    business: view.business,
    operator: view.operator,
    views: view.views,
    firstView: view.firstView,
    queues: view.queues.map((queue) => ({ ...queue, fields: queue.fields.map((field) => ({ id: field.id, label: field.label, type: field.type, required: field.required, options: [...field.options] })) })),
    catalog: { fieldTypes: FIELD_TYPES, ticketStatuses: TICKET_STATUSES, limits: LIMITS },
  };
}
