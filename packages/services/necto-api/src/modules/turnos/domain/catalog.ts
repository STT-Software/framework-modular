export const TURNOS_MODULE_ID = 'turnos';

export const QUEUE_MODES = ['auto', 'manual'] as const;
export type QueueMode = (typeof QUEUE_MODES)[number];

/** The palette of a queue. The identifiers are stored; the colors themselves are the interface's business. */
export const QUEUE_COLORS = ['orange', 'purple', 'blue', 'green', 'pink', 'amber'] as const;
export type QueueColor = (typeof QUEUE_COLORS)[number];

/** How the number of a turn gets its letters: the first letter of the queue, one prefix for all queues, or none. */
export const PREFIX_MODES = ['initial', 'fixed', 'none'] as const;
export type PrefixMode = (typeof PREFIX_MODES)[number];

/** The steps of the configuration, in order. They only say where the person is; every write is validated on its own. */
export const SETUP_STEPS = ['profile', 'queues', 'rules', 'operators', 'review'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/**
 * The views of the operator's workspace, in the order they are offered: the first one an operator may use is where they land after
 * signing in. Each one is granted on its own, by the administrator.
 */
export const OPERATOR_VIEWS = ['home', 'my-turns', 'create-turn', 'queues', 'surveys'] as const;
export type OperatorViewId = (typeof OPERATOR_VIEWS)[number];
/** Pending: assigned, has not signed in yet. Active: can operate. Inactive: switched off by the administrator (keeps their history). */
export const OPERATOR_STATUSES = ['pending', 'active', 'inactive'] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];
/** A paused queue accepts no new turns and keeps the ones it has. */
export const QUEUE_STATUSES = ['active', 'paused'] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];
/** The kinds of extra field a queue can ask when a turn is created. `select` has options; `checkbox` is a yes/no. */
export const FIELD_TYPES = ['text', 'number', 'phone', 'email', 'date', 'select', 'checkbox'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
/** The life of a turn: waiting, in attention, and one of three endings. */
export const TICKET_STATUSES = ['waiting', 'attending', 'completed', 'cancelled', 'no-show'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const OPEN_TICKET_STATUSES = ['waiting', 'attending'] as const satisfies readonly TicketStatus[];
export const ROOM_NAME_DISPLAYS = ['full', 'first-name', 'hidden'] as const;
export type RoomNameDisplay = (typeof ROOM_NAME_DISPLAYS)[number];
/** Numbers and sizes the rules accept (own limits of the product, shown to the interface so it can validate the same way). */
export const LIMITS = {
  queueName: { min: 2, max: 60 },
  averageMinutes: { min: 1, max: 1440 },
  prefix: { min: 1, max: 5 },
  urgentMinutes: { min: 1, max: 1440 },
  busyLimit: { min: 1, max: 9999 },
  /** The general limit of a full queue starts at 2 (it must exceed the busy one); a queue's own limit starts at 1. */
  fullLimit: { min: 1, max: 10000, generalMin: 2 },
  operatorName: { min: 2, max: 80 },
  operatorEmail: { max: 160 },
  phoneDigits: { min: 7, max: 15 },
  queuesPerBusiness: 30,
  operatorsPerBusiness: 100,
  fieldsPerQueue: 10,
  fieldLabel: { min: 2, max: 60 },
  fieldOptions: { min: 2, max: 20 },
  fieldOption: { min: 1, max: 40 },
  /** The longest text answered in a field, a customer name or a comment. */
  answerText: 200,
  customerName: { min: 2, max: 80 },
  note: 300,
  roomRecentCalls: { min: 1, max: 10 },
  roomMessage: 120,
  surveyQuestion: { min: 2, max: 140 },
  surveyThanks: 200,
  surveyValidHours: { min: 1, max: 720 },
  /** A page of tickets or responses. */
  pageSize: { default: 25, max: 100 },
  /** The most rows a CSV report holds, so one request cannot read the whole history. */
  reportRows: 20000,
} as const;

export interface SuggestedQueue {
  name: string;
  mode: QueueMode;
  averageMinutes: number;
}

/**
 * The attention profiles: a starting point that suggests the first queues of a business. The identifiers are stable
 * (stored and sent by the interface); names and descriptions are product text shown to people, in Spanish.
 */
export const TURNOS_PROFILES = [
  {
    id: 'clinic',
    name: 'Clínica / Salud',
    description: 'Consultas, laboratorio y atención médica.',
    queues: [
      { name: 'Consulta general', mode: 'auto', averageMinutes: 14 },
      { name: 'Laboratorio', mode: 'manual', averageMinutes: 25 },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurante',
    description: 'Atención para recoger, pedir o llevar.',
    queues: [
      { name: 'Pedidos en caja', mode: 'auto', averageMinutes: 8 },
      { name: 'Recogida de pedidos', mode: 'manual', averageMinutes: 5 },
    ],
  },
  {
    id: 'bank',
    name: 'Banco / Trámites',
    description: 'Atención en ventanilla y solicitudes por servicio.',
    queues: [
      { name: 'Caja', mode: 'auto', averageMinutes: 10 },
      { name: 'Asesoría', mode: 'manual', averageMinutes: 20 },
    ],
  },
  {
    id: 'salon',
    name: 'Salón / Estética',
    description: 'Atención por corte, color y cuidado personal.',
    queues: [
      { name: 'Corte', mode: 'auto', averageMinutes: 30 },
      { name: 'Color', mode: 'manual', averageMinutes: 60 },
      { name: 'Uñas', mode: 'manual', averageMinutes: 40 },
    ],
  },
  {
    id: 'custom',
    name: 'Otro / Personalizado',
    description: 'Empieza con una fila general y crea tu propia forma de atender.',
    queues: [{ name: 'Atención general', mode: 'auto', averageMinutes: 10 }],
  },
] as const satisfies ReadonlyArray<{ id: string; name: string; description: string; queues: readonly SuggestedQueue[] }>;

export type TurnosProfileId = (typeof TURNOS_PROFILES)[number]['id'];
export const TURNOS_PROFILE_IDS = TURNOS_PROFILES.map((profile) => profile.id) as readonly TurnosProfileId[];

export function profileById(id: TurnosProfileId) {
  return TURNOS_PROFILES.find((profile) => profile.id === id) ?? TURNOS_PROFILES[TURNOS_PROFILES.length - 1];
}

const PROFILE_BY_CATEGORY: Readonly<Record<string, TurnosProfileId>> = {
  gastronomy: 'restaurant',
  'health-wellness': 'clinic',
  retail: 'bank',
  'professional-services': 'bank',
};
/** The profile suggested for a business from its category; every profile starts with default queues. */
export function suggestedProfileFor(category: string): TurnosProfileId {
  return PROFILE_BY_CATEGORY[category] ?? 'custom';
}
