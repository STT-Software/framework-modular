import type { PrefixMode, QueueColor, QueueMode, SetupStep, TurnosProfileId } from './catalog';

/** The general rules of Turnos for a business. A queue that does not set its own value uses these. */
export interface TurnosRules {
  prefixMode: PrefixMode;
  /** Only with `prefixMode: "fixed"`; null otherwise. */
  fixedPrefix: string | null;
  /** Start the numbering again each day. */
  dailyReset: boolean;
  /** Minutes in the line after which a turn is marked urgent. */
  urgentMinutes: number;
  /** People waiting from which a queue counts as busy. */
  busyLimit: number;
  /** People waiting from which a queue counts as full. Always greater than the busy limit. */
  fullLimit: number;
}

/** What a queue overrides of the general rules. `null` means "use the general one", each field on its own. */
export interface QueueOverrides {
  prefix: string | null;
  urgentMinutes: number | null;
  busyLimit: number | null;
  fullLimit: number | null;
}

export interface Queue {
  id: string;
  name: string;
  color: QueueColor;
  mode: QueueMode;
  averageMinutes: number;
  /** "custom" when the person created it; otherwise the profile that suggested it. */
  source: 'custom' | TurnosProfileId;
  overrides: QueueOverrides;
}

/**
 * A person assigned to Turnos in this business. Only the assignment lives here: the person is identified by the email, the
 * same one they sign in with, and removing the assignment removes nothing else about them.
 */
export interface Operator {
  id: string;
  name: string;
  /** Normalized: trimmed and lowercase. Unique among the operators of the business. */
  email: string;
  phone: string | null;
  /** At least one, always queues of this business. */
  queueIds: string[];
  createdAt: Date;
}

/**
 * The whole configuration of Turnos for ONE business, as a single document: queues and operators live inside it, so that
 * changes that touch both (deleting a queue and reassigning its operators) are one atomic write, and a business can never
 * show an operator without a queue.
 */
export interface TurnosConfiguration {
  businessId: string;
  /** The attention profile: chosen in the base setup or in the first step, or the one suggested by the category. */
  profile: TurnosProfileId | null;
  /** Whether the suggested queues were generated. They are generated once. */
  seeded: boolean;
  /** Someone edited queues, rules or operators. While false, the suggestions can be replaced by another profile's. */
  touched: boolean;
  rules: TurnosRules;
  queues: Queue[];
  operators: Operator[];
  currentStep: SetupStep | null;
  visitedSteps: SetupStep[];
  /** When it was saved as ready. Any later change to it clears it again. */
  readyAt: Date | null;
  /** Increases with every write; a write only succeeds if nobody changed the configuration since it was read. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
