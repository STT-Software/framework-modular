import { LIMITS, PREFIX_MODES } from './catalog';
import type { Queue, TurnosRules } from './configuration';
import { TurnosInvalidError } from './errors';
import { isInt, Issues } from './issues';

/** Where a business starts: the initial of each queue, numbering restarted every day, urgent after 10 minutes, busy from 4, full from 8. */
export const DEFAULT_RULES: TurnosRules = {
  prefixMode: 'initial',
  fixedPrefix: null,
  dailyReset: true,
  urgentMinutes: 10,
  busyLimit: 4,
  fullLimit: 8,
};

const PREFIX_PATTERN = new RegExp(`^[A-Z0-9]{${LIMITS.prefix.min},${LIMITS.prefix.max}}$`);

/** Trimmed, uppercase and without accents: "  ñu " becomes "NU". */
export function normalizePrefix(raw: string): string {
  return raw.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isValidPrefix(normalized: string): boolean {
  return PREFIX_PATTERN.test(normalized);
}

export interface RulesInput {
  prefixMode: string;
  fixedPrefix?: string | null;
  dailyReset: boolean;
  urgentMinutes: number;
  busyLimit: number;
  fullLimit: number;
}

/**
 * Validates and normalizes the general rules. `fixedPrefix` is required with the "fixed" mode and ignored (stored as null)
 * with the others. The full limit must be greater than the busy limit.
 *
 * @throws TurnosInvalidError (`invalid-rules`) with every problem found.
 */
export function parseRules(input: RulesInput): TurnosRules {
  const issues = new Issues();
  const mode = PREFIX_MODES.find((candidate) => candidate === input.prefixMode);
  if (!mode) issues.add('prefixMode', `prefixMode must be one of: ${PREFIX_MODES.join(', ')}`);
  let fixedPrefix: string | null = null;
  if (mode === 'fixed') {
    fixedPrefix = typeof input.fixedPrefix === 'string' ? normalizePrefix(input.fixedPrefix) : '';
    if (!isValidPrefix(fixedPrefix)) {
      issues.add('fixedPrefix', `fixedPrefix must be ${LIMITS.prefix.min} to ${LIMITS.prefix.max} letters or digits`);
      fixedPrefix = null;
    }
  }
  if (typeof input.dailyReset !== 'boolean') issues.add('dailyReset', 'dailyReset must be true or false');
  if (!isInt(input.urgentMinutes, LIMITS.urgentMinutes.min, LIMITS.urgentMinutes.max)) {
    issues.add('urgentMinutes', `urgentMinutes must be a whole number between ${LIMITS.urgentMinutes.min} and ${LIMITS.urgentMinutes.max}`);
  }
  const busyOk = isInt(input.busyLimit, LIMITS.busyLimit.min, LIMITS.busyLimit.max);
  if (!busyOk) issues.add('busyLimit', `busyLimit must be a whole number between ${LIMITS.busyLimit.min} and ${LIMITS.busyLimit.max}`);
  const fullOk = isInt(input.fullLimit, LIMITS.fullLimit.generalMin, LIMITS.fullLimit.max);
  if (!fullOk) issues.add('fullLimit', `fullLimit must be a whole number between ${LIMITS.fullLimit.generalMin} and ${LIMITS.fullLimit.max}`);
  if (busyOk && fullOk && input.fullLimit <= input.busyLimit) {
    issues.add('fullLimit', 'fullLimit must be greater than busyLimit: a queue is full after being busy');
  }
  if (issues.any || !mode) throw new TurnosInvalidError('invalid-rules', issues.fields);
  return {
    prefixMode: mode,
    fixedPrefix,
    dailyReset: input.dailyReset,
    urgentMinutes: input.urgentMinutes,
    busyLimit: input.busyLimit,
    fullLimit: input.fullLimit,
  };
}

/** The first letter or digit of a queue name, in uppercase and without accents ("" if it has none). */
export function initialOf(name: string): string {
  return normalizePrefix(name).replace(/[^A-Z0-9]/g, '').slice(0, 1);
}

export interface EffectiveRules {
  prefix: string;
  urgentMinutes: number;
  busyLimit: number;
  fullLimit: number;
}

/** What a queue really uses: each of its own values if it has one, the general rule otherwise, field by field. */
export function effectiveOf(queue: Pick<Queue, 'name' | 'overrides'>, rules: TurnosRules): EffectiveRules {
  const own = queue.overrides;
  const prefix = own.prefix ?? (rules.prefixMode === 'fixed' ? (rules.fixedPrefix ?? '') : rules.prefixMode === 'initial' ? initialOf(queue.name) : '');
  return {
    prefix,
    urgentMinutes: own.urgentMinutes ?? rules.urgentMinutes,
    busyLimit: own.busyLimit ?? rules.busyLimit,
    fullLimit: own.fullLimit ?? rules.fullLimit,
  };
}

/** An example of the number of a turn of this queue: "C-001", or "001" without prefix. */
export function ticketExample(queue: Pick<Queue, 'name' | 'overrides'>, rules: TurnosRules): string {
  const { prefix } = effectiveOf(queue, rules);
  return `${prefix ? `${prefix}-` : ''}001`;
}

/** The queues whose effective limits would cross (full not above busy) under these rules, because of their own values. */
export function queuesWithCrossedLimits(rules: TurnosRules, queues: readonly Queue[]): Queue[] {
  return queues.filter((queue) => {
    const effective = effectiveOf(queue, rules);
    return effective.fullLimit <= effective.busyLimit;
  });
}
