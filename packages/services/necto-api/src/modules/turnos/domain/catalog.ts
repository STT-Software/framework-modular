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
    description: 'Empieza sin filas y crea tu propia forma de atender.',
    queues: [],
  },
] as const satisfies ReadonlyArray<{ id: string; name: string; description: string; queues: readonly SuggestedQueue[] }>;

export type TurnosProfileId = (typeof TURNOS_PROFILES)[number]['id'];
export const TURNOS_PROFILE_IDS = TURNOS_PROFILES.map((profile) => profile.id) as readonly TurnosProfileId[];

export function profileById(id: TurnosProfileId) {
  return TURNOS_PROFILES.find((profile) => profile.id === id) ?? TURNOS_PROFILES[TURNOS_PROFILES.length - 1];
}

/** The profile suggested for a business from its category (only gastronomy has its own; the rest start free). */
export function suggestedProfileFor(category: string): TurnosProfileId {
  return category === 'gastronomy' ? 'restaurant' : 'custom';
}
