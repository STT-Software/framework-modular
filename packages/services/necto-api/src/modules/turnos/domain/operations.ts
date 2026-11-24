import { randomUUID } from 'node:crypto';
import {
  LIMITS,
  QUEUE_COLORS,
  SETUP_STEPS,
  TURNOS_PROFILE_IDS,
  profileById,
  type QueueColor,
  type QueueStatus,
  type SetupStep,
  type TurnosProfileId,
} from './catalog';
import type { Operator, Queue, TurnosConfiguration } from './configuration';
import {
  OnlyQueueWithOperatorsError,
  OperatorNotFoundError,
  QueueNotFoundError,
  ReassignmentRequiredError,
  TurnosIncompleteError,
  TurnosInvalidError,
} from './errors';
import { Issues } from './issues';
import { parseOperator, type OperatorInput } from './operators';
import { parseQueue, type QueueInput } from './queues';
import { parseRoomScreen, parseSurveyConfig, DEFAULT_ROOM_SCREEN, DEFAULT_SURVEY, type RoomScreenInput, type SurveyInput } from './settings';
import { DEFAULT_RULES, parseRules, queuesWithCrossedLimits, type RulesInput } from './rules';

export type IdGenerator = () => string;

/**
 * Every change to the configuration is a pure function: it takes the current configuration and returns the next one (or throws
 * a domain error and changes nothing). The application saves the result in ONE write that only succeeds if nobody changed the
 * configuration in between, so a change that touches several parts (deleting a queue and moving its operators) can never be
 * half done. Changes to the content clear "ready" and mark the configuration as edited; moving between steps does neither.
 */

export function newConfiguration(businessId: string, now: Date): TurnosConfiguration {
  return {
    businessId,
    profile: null,
    seeded: false,
    touched: false,
    rules: { ...DEFAULT_RULES },
    queues: [],
    operators: [],
    roomScreen: { ...DEFAULT_ROOM_SCREEN },
    survey: { ...DEFAULT_SURVEY, channels: { ...DEFAULT_SURVEY.channels } },
    currentStep: null,
    visitedSteps: [],
    readyAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

const colorAt = (index: number): QueueColor => QUEUE_COLORS[index % QUEUE_COLORS.length];

function suggestionsOf(profile: TurnosProfileId, ids: IdGenerator): Queue[] {
  return profileById(profile).queues.map((suggested, index) => ({
    id: ids(),
    name: suggested.name,
    color: colorAt(index),
    mode: suggested.mode,
    averageMinutes: suggested.averageMinutes,
    source: profile,
    overrides: { prefix: null, urgentMinutes: null, busyLimit: null, fullLimit: null },
    status: 'active' as const,
    fields: [],
  }));
}

function edited(config: TurnosConfiguration, now: Date): TurnosConfiguration {
  return { ...config, touched: true, readyAt: null, updatedAt: now };
}

/** Generates the suggested queues of the profile, once. Without a profile chosen yet, `fallback` (the one the category suggests) is used. */
export function ensureSeeded(config: TurnosConfiguration, fallback: TurnosProfileId, now: Date, ids: IdGenerator = randomUUID): TurnosConfiguration {
  if (config.seeded) return config;
  const profile = config.profile ?? fallback;
  return { ...config, profile, seeded: true, queues: suggestionsOf(profile, ids), updatedAt: now };
}

/**
 * Changes the attention profile without losing anything the person did:
 * - suggestions nobody touched (nothing edited, no operators) are replaced by the new profile's suggestions;
 * - otherwise queues, rules and operators stay exactly as they are, and only if `addSuggestedQueues` the new profile's suggestions
 *   are added, skipping the names that already exist (so there are no duplicates).
 */
export function changeProfile(config: TurnosConfiguration, profile: string, addSuggestedQueues: boolean, now: Date, ids: IdGenerator = randomUUID): TurnosConfiguration {
  const chosen = TURNOS_PROFILE_IDS.find((candidate) => candidate === profile);
  if (!chosen) throw new TurnosInvalidError('invalid-profile', { profile: [`profile must be one of: ${TURNOS_PROFILE_IDS.join(', ')}`] });
  if (chosen === config.profile && !addSuggestedQueues) return config;
  if (!config.seeded) return { ...config, profile: chosen, updatedAt: now };
  if (!config.touched && config.operators.length === 0) {
    return { ...config, profile: chosen, queues: suggestionsOf(chosen, ids), readyAt: null, updatedAt: now };
  }
  const next: TurnosConfiguration = { ...config, profile: chosen, queues: [...config.queues] };
  if (addSuggestedQueues) {
    for (const suggested of suggestionsOf(chosen, ids)) {
      if (next.queues.length >= LIMITS.queuesPerBusiness) break;
      if (!next.queues.some((queue) => queue.name.toLocaleLowerCase() === suggested.name.toLocaleLowerCase())) {
        next.queues.push({ ...suggested, color: colorAt(next.queues.length) });
      }
    }
  }
  return edited(next, now);
}

export function setRules(config: TurnosConfiguration, input: RulesInput, now: Date): TurnosConfiguration {
  const rules = parseRules(input);
  const crossed = queuesWithCrossedLimits(rules, config.queues);
  if (crossed.length > 0) {
    throw new TurnosInvalidError('invalid-rules', {
      fullLimit: [`These rules cross with the own values of: ${crossed.map((queue) => `«${queue.name}»`).join(', ')}. Adjust the general limits or edit those queues`],
    });
  }
  return edited({ ...config, rules }, now);
}

export function addQueue(config: TurnosConfiguration, input: QueueInput, now: Date, ids: IdGenerator = randomUUID): TurnosConfiguration {
  if (config.queues.length >= LIMITS.queuesPerBusiness) {
    throw new TurnosInvalidError('invalid-queue', { name: [`A business can have at most ${LIMITS.queuesPerBusiness} queues`] });
  }
  const parsed = parseQueue(input, { rules: config.rules, others: config.queues, defaultColor: colorAt(config.queues.length) });
  return edited({ ...config, queues: [...config.queues, { id: ids(), source: 'custom', ...parsed, status: 'active' as const }] }, now);
}

export function updateQueue(config: TurnosConfiguration, queueId: string, input: QueueInput, now: Date): TurnosConfiguration {
  const current = config.queues.find((queue) => queue.id === queueId);
  if (!current) throw new QueueNotFoundError();
  const parsed = parseQueue(input, {
    rules: config.rules,
    others: config.queues.filter((queue) => queue.id !== queueId),
    defaultColor: current.color,
    currentFields: current.fields,
  });
  return edited({ ...config, queues: config.queues.map((queue) => (queue.id === queueId ? { ...queue, ...parsed } : queue)) }, now);
}

export interface Reassignment {
  operatorId: string;
  queueId: string;
}

/**
 * Deletes a queue. An operator whose ONLY queue it is would be left with none, so the request must say which other queue each of
 * them goes to; everyone else just loses this queue. Queue and operators change in the same result, so the configuration never
 * holds an operator without a queue.
 */
export function removeQueue(config: TurnosConfiguration, queueId: string, reassignments: readonly Reassignment[], now: Date): TurnosConfiguration {
  if (!config.queues.some((queue) => queue.id === queueId)) throw new QueueNotFoundError();
  const remaining = config.queues.filter((queue) => queue.id !== queueId);
  const stranded = config.operators.filter((operator) => operator.queueIds.every((id) => id === queueId));
  if (stranded.length > 0 && remaining.length === 0) throw new OnlyQueueWithOperatorsError();

  const issues = new Issues();
  const target = new Map<string, string>();
  reassignments.forEach((item, index) => {
    const path = `reassignments.${index}`;
    if (!stranded.some((operator) => operator.id === item.operatorId)) {
      issues.add(`${path}.operatorId`, 'That operator does not need a new queue');
    } else if (target.has(item.operatorId)) {
      issues.add(`${path}.operatorId`, 'That operator appears more than once');
    } else if (!remaining.some((queue) => queue.id === item.queueId)) {
      issues.add(`${path}.queueId`, 'The new queue must be another existing queue of this business');
    } else {
      target.set(item.operatorId, item.queueId);
    }
  });
  if (issues.any) throw new TurnosInvalidError('invalid-request', issues.fields);

  const missing = stranded.filter((operator) => !target.has(operator.id));
  if (missing.length > 0) {
    throw new ReassignmentRequiredError(
      Object.fromEntries(missing.map((operator) => [`reassignments.${operator.id}`, [`${operator.name} would be left without a queue: choose another one`]])),
    );
  }
  const operators = config.operators.map((operator) => {
    const kept = operator.queueIds.filter((id) => id !== queueId);
    return { ...operator, queueIds: kept.length > 0 ? kept : [target.get(operator.id)!] };
  });
  // A queue that is gone is also taken out of the room screen and survey selections; a selection left empty goes back to "all".
  const keep = (ids: string[] | null) => {
    const left = ids?.filter((id) => id !== queueId) ?? null;
    return left && left.length > 0 ? left : null;
  };
  return edited(
    {
      ...config,
      queues: remaining,
      operators,
      roomScreen: { ...config.roomScreen, queueIds: keep(config.roomScreen.queueIds) },
      survey: { ...config.survey, queueIds: keep(config.survey.queueIds) },
    },
    now,
  );
}

export function addOperator(config: TurnosConfiguration, input: OperatorInput, now: Date, ids: IdGenerator = randomUUID): TurnosConfiguration {
  if (config.operators.length >= LIMITS.operatorsPerBusiness) {
    throw new TurnosInvalidError('invalid-operator', { email: [`A business can have at most ${LIMITS.operatorsPerBusiness} operators`] });
  }
  const parsed = parseOperator(input, { queues: config.queues, others: config.operators });
  const activatedAt = parsed.status === 'active' ? now : null;
  return edited({ ...config, operators: [...config.operators, { id: ids(), createdAt: now, ...parsed, activatedAt }] }, now);
}

export function updateOperator(config: TurnosConfiguration, operatorId: string, input: OperatorInput, now: Date): TurnosConfiguration {
  const current = config.operators.find((operator) => operator.id === operatorId);
  if (!current) throw new OperatorNotFoundError();
  const parsed = parseOperator(input, { queues: config.queues, others: config.operators.filter((operator) => operator.id !== operatorId), current });
  const activatedAt = current.activatedAt ?? (parsed.status === 'active' ? now : null);
  return edited({ ...config, operators: config.operators.map((operator) => (operator.id === operatorId ? { ...operator, ...parsed, activatedAt } : operator)) }, now);
}

/** Removes only the assignment to Turnos of this business. The person, their email and their other accesses are not touched. */
export function removeOperator(config: TurnosConfiguration, operatorId: string, now: Date): TurnosConfiguration {
  if (!config.operators.some((operator) => operator.id === operatorId)) throw new OperatorNotFoundError();
  return edited({ ...config, operators: config.operators.filter((operator) => operator.id !== operatorId) }, now);
}

/** Remembers the step the person is on. It does not change the content, so it does not clear "ready". */
export function recordStep(config: TurnosConfiguration, step: SetupStep, now: Date): TurnosConfiguration {
  if (!SETUP_STEPS.includes(step)) throw new TurnosInvalidError('invalid-request', { step: [`step must be one of: ${SETUP_STEPS.join(', ')}`] });
  const visitedSteps = config.visitedSteps.includes(step) ? config.visitedSteps : [...config.visitedSteps, step];
  return { ...config, currentStep: step, visitedSteps, updatedAt: now };
}

/** What stops the configuration from being saved as ready, by field. Empty when it can be. Operators are optional. */
export function readinessProblems(config: TurnosConfiguration): Record<string, string[]> {
  const issues = new Issues();
  if (config.queues.length === 0) issues.add('queues', 'Create at least one queue to prepare Turnos');
  try {
    parseRules(config.rules);
  } catch (error) {
    if (!(error instanceof TurnosInvalidError)) throw error;
    for (const [path, messages] of Object.entries(error.fields)) for (const message of messages) issues.add(`rules.${path}`, message);
  }
  for (const queue of queuesWithCrossedLimits(config.rules, config.queues)) {
    issues.add(`queues.${queue.id}.overrides.fullLimit`, `«${queue.name}» must be full after being busy`);
  }
  for (const operator of config.operators) {
    if (operator.queueIds.length === 0 || operator.queueIds.some((id) => !config.queues.some((queue) => queue.id === id))) {
      issues.add(`operators.${operator.id}.queueIds`, `${operator.name} needs at least one existing queue`);
    }
  }
  return issues.fields;
}

/** Saves the configuration as ready once it meets the minimum. Repeating it keeps the original date. */
export function markReady(config: TurnosConfiguration, now: Date): TurnosConfiguration {
  const problems = readinessProblems(config);
  if (Object.keys(problems).length > 0) throw new TurnosIncompleteError(problems);
  if (config.readyAt) return config;
  return { ...config, readyAt: now, currentStep: 'review', visitedSteps: config.visitedSteps.includes('review') ? config.visitedSteps : [...config.visitedSteps, 'review'], updatedAt: now };
}

/**
 * The first sign-in of an email makes every operator of this business that was still pending active. It is not an edit of the
 * configuration (it does not clear "ready"); an operator who is already active or was switched off is left as is.
 * Returns the same object when there was nothing to activate.
 */
export function activatePendingOperator(config: TurnosConfiguration, email: string, now: Date): TurnosConfiguration {
  if (!config.operators.some((operator) => operator.email === email && operator.status === 'pending')) return config;
  const operators = config.operators.map((operator) =>
    operator.email === email && operator.status === 'pending' ? { ...operator, status: 'active' as const, activatedAt: now } : operator,
  );
  return { ...config, operators, updatedAt: now };
}
/**
 * Pauses or resumes a queue. A paused queue takes no new turns and keeps the ones it has. It is an operational switch, not a change
 * of the configuration: it does not clear "ready". Repeating it changes nothing.
 */
export function setQueueStatus(config: TurnosConfiguration, queueId: string, status: QueueStatus, now: Date): TurnosConfiguration {
  const queue = config.queues.find((candidate) => candidate.id === queueId);
  if (!queue) throw new QueueNotFoundError();
  if (queue.status === status) return config;
  return { ...config, queues: config.queues.map((candidate) => (candidate.id === queueId ? { ...candidate, status } : candidate)), updatedAt: now };
}
export function setRoomScreen(config: TurnosConfiguration, input: RoomScreenInput, now: Date): TurnosConfiguration {
  return { ...config, roomScreen: parseRoomScreen(input, config.queues), updatedAt: now };
}
export function setSurveyConfig(config: TurnosConfiguration, input: SurveyInput, now: Date): TurnosConfiguration {
  return { ...config, survey: parseSurveyConfig(input, config.queues), updatedAt: now };
}
