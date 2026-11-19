/** Lo que devuelve y recibe el servicio de Turnos (contrato en el README de packages/services/necto-api, módulo turnos). */

export type TurnosProfileId = "clinic" | "restaurant" | "bank" | "salon" | "custom";
export type QueueColor = "orange" | "purple" | "blue" | "green" | "pink" | "amber";
export type QueueMode = "auto" | "manual";
export type PrefixMode = "initial" | "fixed" | "none";
export type TurnosStep = "profile" | "queues" | "rules" | "operators" | "review";

export const TURNOS_STEPS: readonly TurnosStep[] = ["profile", "queues", "rules", "operators", "review"];

/** Lo que una fila fija por su cuenta; `null` es «usa la regla general», campo por campo. */
export interface QueueOverrides {
  prefix: string | null;
  urgentMinutes: number | null;
  busyLimit: number | null;
  fullLimit: number | null;
}

export interface EffectiveRules {
  prefix: string;
  urgentMinutes: number;
  busyLimit: number;
  fullLimit: number;
}

export interface TurnosQueue {
  id: string;
  name: string;
  color: QueueColor;
  mode: QueueMode;
  averageMinutes: number;
  /** "custom" si la creó la persona; si no, el perfil que la sugirió. */
  source: "custom" | TurnosProfileId;
  overrides: QueueOverrides;
  effective: EffectiveRules;
  ticketExample: string;
}

export interface TurnosRules {
  prefixMode: PrefixMode;
  fixedPrefix: string | null;
  dailyReset: boolean;
  urgentMinutes: number;
  busyLimit: number;
  fullLimit: number;
}

export interface TurnosOperator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  queueIds: string[];
  createdAt: string;
}

export interface ProfileOption {
  id: TurnosProfileId;
  name: string;
  description: string;
  suggestedQueues: Array<{ name: string; mode: QueueMode; averageMinutes: number }>;
}

export interface TurnosLimits {
  queueName: { min: number; max: number };
  averageMinutes: { min: number; max: number };
  prefix: { min: number; max: number };
  urgentMinutes: { min: number; max: number };
  busyLimit: { min: number; max: number };
  fullLimit: { min: number; max: number; generalMin: number };
  operatorName: { min: number; max: number };
  operatorEmail: { max: number };
  phoneDigits: { min: number; max: number };
  queuesPerBusiness: number;
  operatorsPerBusiness: number;
}

/** La configuración completa, tal como la guardó el servidor (la devuelve `GET` y cada escritura). */
export interface TurnosState {
  business: { id: string; name: string; category: string; categoryOther: string | null };
  profile: { id: TurnosProfileId; suggested: TurnosProfileId; suggestionsUntouched: boolean };
  queues: TurnosQueue[];
  rules: TurnosRules;
  operators: TurnosOperator[];
  progress: { currentStep: TurnosStep | null; visitedSteps: TurnosStep[]; ready: boolean; readyAt: string | null };
  /** Solo en la respuesta de crear una fila o un operador. */
  created?: { id: string };
  catalog: {
    profiles: ProfileOption[];
    colors: QueueColor[];
    modes: QueueMode[];
    prefixModes: PrefixMode[];
    steps: TurnosStep[];
    limits: TurnosLimits;
  };
}

/** Lo que ve un operador: él y solo sus filas. */
export interface OperatorView {
  business: { id: string; name: string };
  operator: { id: string; name: string; email: string };
  queues: Array<{ id: string; name: string; color: QueueColor; mode: QueueMode; averageMinutes: number }>;
}

/** Lo que la persona escribe en el diálogo de una fila (los valores propios son texto: vacío = usa el general). */
export interface QueueForm {
  name: string;
  mode: QueueMode;
  averageMinutes: string;
  color: QueueColor;
  prefix: string;
  urgentMinutes: string;
  busyLimit: string;
  fullLimit: string;
}

export interface OperatorForm {
  name: string;
  email: string;
  phone: string;
  queueIds: string[];
}

/** El formulario de reglas generales (los números son texto mientras se escribe). */
export interface RulesForm {
  prefixMode: PrefixMode;
  fixedPrefix: string;
  dailyReset: boolean;
  urgentMinutes: string;
  busyLimit: string;
  fullLimit: string;
}
