import type { OperatorViewId, QueueColor, QueueMode } from "../types";
/** Lo que devuelve el servicio de Turnos para la operación (contrato en el README de packages/services/necto-api, «Operación de Turnos»). */
export type Role = "admin" | "operator";
export type TicketStatus = "waiting" | "attending" | "completed" | "cancelled" | "no-show";
export const TICKET_STATUSES: readonly TicketStatus[] = ["waiting", "attending", "completed", "cancelled", "no-show"];
export interface Ticket {
  id: string;
  code: string;
  queue: { id: string; name: string };
  status: TicketStatus;
  customer: { name: string | null; phone: string | null; email: string | null };
  answers: Array<{ fieldId: string; label: string; type: string; value: string | number | boolean }>;
  note: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  calledAt: string | null;
  attendedBy: { id: string; name: string } | null;
  finishedAt: string | null;
  cancelReason: string | null;
  waitMinutes: number | null;
  serviceMinutes: number | null;
  /** Solo al abrir un turno. */
  events?: Array<{ type: string; at: string; by: { id: string; name: string }; automatic: boolean }>;
}
export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Outcome {
  applied: boolean;
  ticket: Ticket;
  next: Ticket | null;
}
export type QueueState = "paused" | "empty" | "normal" | "busy" | "full";
export interface QueueSummary {
  id: string;
  name: string;
  color: QueueColor;
  mode: QueueMode;
  status: "active" | "paused";
  averageMinutes: number;
}
export interface BoardEntry {
  queue: QueueSummary;
  waiting: number;
  attending: number;
  longestWaitMinutes: number | null;
  urgent: number;
  state: QueueState;
}
export interface Totals {
  created: number;
  completed: number;
  cancelled: number;
  noShow: number;
  called: number;
  averageWaitMinutes: number | null;
  averageServiceMinutes: number | null;
  completionRate: number | null;
  noShowRate: number | null;
}
export interface Overview {
  range: { from: string; to: string; days: number };
  totals: Totals;
  mine: Totals | null;
  queues: Array<BoardEntry & { metrics: Omit<Totals, never> }>;
  daily: Array<{ day: string; created: number; completed: number; cancelled: number; noShow: number }>;
  hourly: Array<{ hour: number; created: number }>;
  truncated: boolean;
  generatedAt: string;
  /** Solo en el «Inicio» del operador. */
  current?: Ticket | null;
  activity?: ActivityItem[];
}
export interface ActivityItem {
  type: string;
  at: string;
  by: { id: string; name: string };
  automatic: boolean;
  ticket: { id: string; code: string };
  queue: { id: string; name: string };
}
export interface TeamMember {
  operatorId: string;
  name: string;
  status: "pending" | "active" | "inactive";
  queueIds: string[];
  attended: number;
  completed: number;
  noShow: number;
  cancelled: number;
  averageServiceMinutes: number | null;
  current: { ticketId: string; code: string; since: string } | null;
}
export interface Satisfaction {
  invited: number;
  responses: number;
  responseRate: number | null;
  average: number | null;
  satisfied: number | null;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}
export interface SurveySummary {
  range: { from: string; to: string };
  truncated: boolean;
  overall: Satisfaction;
  trend: Array<{ day: string; responses: number; average: number | null }>;
  byQueue: Array<{ queueId: string; queueName: string } & Satisfaction>;
  byOperator: Array<{ operatorId: string; operatorName: string } & Satisfaction>;
}
export interface SurveyResponseItem {
  id: string;
  ticketCode: string;
  queue: { id: string; name: string };
  operator: { id: string; name: string | null } | null;
  rating: number;
  comment: string | null;
  answeredAt: string;
  delivery?: { email: { status: string }; whatsapp: { status: string } };
}
export interface SurveyResponsePage {
  total: number;
  page: number;
  pageSize: number;
  items: SurveyResponseItem[];
}
export interface RoomScreen {
  settings: { enabled: boolean; queueIds: string[] | null; customerName: "full" | "first-name" | "hidden"; playSound: boolean; recentCalls: number; message: string | null };
  calls: Array<{ ticketId: string; code: string; queueId: string; queueName: string; customer: string | null; calledAt: string; status: TicketStatus }>;
}
/** Lo que la persona puede ver y hacer: lo dice el servidor y se renueva al instante si el administrador lo cambia. */
export interface Scope {
  role: Role;
  views: OperatorViewId[];
  /** Operador: la primera vista que tiene. */
  firstView: OperatorViewId | null;
}
/** Las secciones de Turnos (la parte de la dirección tras `/turnos/`). */
export type Section = "dashboard" | "tickets" | "create" | "queues" | "board" | "created" | "surveys" | "team" | "display";
export const SECTION_VIEW: Record<string, OperatorViewId | "admin"> = {
  dashboard: "home",
  tickets: "my-turns",
  create: "create-turn",
  created: "create-turn",
  queues: "queues",
  board: "queues",
  surveys: "surveys",
  team: "admin",
  display: "admin",
};
export const VIEW_SECTION: Record<OperatorViewId, Section> = {
  home: "dashboard",
  "my-turns": "tickets",
  "create-turn": "create",
  queues: "queues",
  surveys: "surveys",
};
export const VIEW_LABEL: Record<OperatorViewId, { label: string; description: string }> = {
  home: { label: "Inicio", description: "Resumen de la atención" },
  "my-turns": { label: "Mis turnos", description: "Consultar los turnos de sus filas" },
  "create-turn": { label: "Crear turno", description: "Registrar clientes en sus filas" },
  queues: { label: "Filas", description: "Ver y atender sus filas asignadas" },
  surveys: { label: "Encuestas", description: "Ver encuestas de sus filas" },
};
