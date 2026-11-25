import { LIMITS, QUEUE_COLORS, QUEUE_MODES, type QueueColor } from './catalog';
import type { Queue, QueueField, TurnosRules } from './configuration';
import { TurnosInvalidError } from './errors';
import { isInt, isRecord, Issues } from './issues';
import { parseFields, type QueueFieldInput } from './queue-fields';
import { effectiveOf, isValidPrefix, normalizePrefix } from './rules';

export interface QueueInput {
  name: string;
  color?: string | null;
  mode: string;
  averageMinutes: number;
  overrides?: {
    prefix?: string | null;
    urgentMinutes?: number | null;
    busyLimit?: number | null;
    fullLimit?: number | null;
  } | null;
  /** What the queue asks when a turn is created. Left out, the queue keeps the fields it has (none for a new queue). */
  fields?: QueueFieldInput[] | null;
}

export type ParsedQueue = Omit<Queue, 'id' | 'source' | 'status'>;

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/**
 * Validates and normalizes a queue. The name is unique in the business (ignoring case); an own value of the queue is optional
 * and independent from the others; and with the general rules plus its own values the queue must reach "full" after "busy".
 *
 * @throws TurnosInvalidError (`invalid-queue`) with every problem found.
 */
export function parseQueue(input: QueueInput, context: { rules: TurnosRules; others: readonly Queue[]; defaultColor: QueueColor; currentFields?: readonly QueueField[] }): ParsedQueue {
  const issues = new Issues();
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < LIMITS.queueName.min || name.length > LIMITS.queueName.max) {
    issues.add('name', `name must be ${LIMITS.queueName.min} to ${LIMITS.queueName.max} characters long`);
  } else if (context.others.some((other) => sameName(other.name, name))) {
    issues.add('name', 'There is already a queue with that name');
  }
  const color = input.color === undefined || input.color === null ? context.defaultColor : QUEUE_COLORS.find((candidate) => candidate === input.color);
  if (!color) issues.add('color', `color must be one of: ${QUEUE_COLORS.join(', ')}`);
  const mode = QUEUE_MODES.find((candidate) => candidate === input.mode);
  if (!mode) issues.add('mode', `mode must be one of: ${QUEUE_MODES.join(', ')}`);
  if (!isInt(input.averageMinutes, LIMITS.averageMinutes.min, LIMITS.averageMinutes.max)) {
    issues.add('averageMinutes', `averageMinutes must be a whole number between ${LIMITS.averageMinutes.min} and ${LIMITS.averageMinutes.max}`);
  }

  const raw = isRecord(input.overrides) ? input.overrides : {};
  let prefix: string | null = null;
  if (typeof raw.prefix === 'string' && raw.prefix.trim() !== '') {
    prefix = normalizePrefix(raw.prefix);
    if (!isValidPrefix(prefix)) {
      issues.add('overrides.prefix', `prefix must be ${LIMITS.prefix.min} to ${LIMITS.prefix.max} letters or digits`);
      prefix = null;
    }
  } else if (raw.prefix !== undefined && raw.prefix !== null && typeof raw.prefix !== 'string') {
    issues.add('overrides.prefix', 'prefix must be text');
  }
  const own = (key: 'urgentMinutes' | 'busyLimit' | 'fullLimit'): number | null => {
    const value = raw[key];
    if (value === undefined || value === null) return null;
    const { min, max } = LIMITS[key];
    if (!isInt(value, min, max)) {
      issues.add(`overrides.${key}`, `${key} must be a whole number between ${min} and ${max}, or empty to use the general rule`);
      return null;
    }
    return value;
  };
  const overrides = { prefix, urgentMinutes: own('urgentMinutes'), busyLimit: own('busyLimit'), fullLimit: own('fullLimit') };

  if (!issues.any) {
    const effective = effectiveOf({ name, overrides }, context.rules);
    if (effective.fullLimit <= effective.busyLimit) {
      issues.add(
        'overrides.fullLimit',
        `The queue must be full after being busy: with its own and the general values, busy is ${effective.busyLimit} and full is ${effective.fullLimit}`,
      );
    }
  }
  const fields = input.fields === undefined || input.fields === null ? [...(context.currentFields ?? [])] : parseFields(input.fields, issues);
  if (issues.any || !color || !mode) throw new TurnosInvalidError('invalid-queue', issues.fields);
  return { name, color, mode, averageMinutes: input.averageMinutes, overrides, fields };
}
