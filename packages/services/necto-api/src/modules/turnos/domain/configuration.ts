import type { FieldType, OperatorStatus, OperatorViewId, PrefixMode, QueueColor, QueueMode, QueueStatus, RoomNameDisplay, SetupStep, TurnosProfileId } from './catalog';

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

/** An extra thing a queue asks when a turn is created ("Documento", "Motivo de la visita"...). Its `id` is what answers are stored under. */
export interface QueueField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Only for `select`; empty for every other type. */
  options: string[];
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
  /** Paused: no new turns, the existing ones stay. */
  status: QueueStatus;
  /** What the queue asks when a turn is created, in order. */
  fields: QueueField[];
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
  /** The views of the operator's workspace this person may use. None means they cannot operate. */
  views: OperatorViewId[];
  /** `pending` until their first sign-in, which makes them `active`; the administrator can switch them off (`inactive`). */
  status: OperatorStatus;
  activatedAt: Date | null;
  createdAt: Date;
}
/** What the room screen shows. It is only the configuration: the screen itself is a later stage. */
export interface RoomScreenConfig {
  enabled: boolean;
  /** The queues shown; null shows all of them. */
  queueIds: string[] | null;
  customerName: RoomNameDisplay;
  playSound: boolean;
  /** How many of the latest calls stay on the screen. */
  recentCalls: number;
  message: string | null;
}
/** The satisfaction survey sent to the customer after a turn is completed. Ratings are 1 to 5. */
export interface SurveyConfig {
  enabled: boolean;
  /** Where the invitation is sent, when the customer left that contact. WhatsApp has no provider yet: it is always reported as not configured. */
  channels: { email: boolean; whatsapp: boolean };
  question: string;
  allowComment: boolean;
  thanksMessage: string | null;
  /** How long the link of an invitation works. */
  validHours: number;
  /** The queues that send it; null is all of them. */
  queueIds: string[] | null;
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
  roomScreen: RoomScreenConfig;
  survey: SurveyConfig;
  currentStep: SetupStep | null;
  visitedSteps: SetupStep[];
  /** When it was saved as ready. Any later change to it clears it again. */
  readyAt: Date | null;
  /** Increases with every write; a write only succeeds if nobody changed the configuration since it was read. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
