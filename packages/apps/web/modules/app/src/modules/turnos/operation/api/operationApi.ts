import { call, root } from "../../api/turnosApi";
import type { OperatorViewId } from "../../types";
import type {
  ActivityItem,
  BoardEntry,
  Outcome,
  Overview,
  QueueSummary,
  Role,
  RoomScreen,
  SurveyResponsePage,
  SurveySummary,
  TeamMember,
  Ticket,
  TicketPage,
} from "../types";
/**
 * Cliente HTTP de la operación de Turnos. El operador usa `/operation/*` y el administrador `/insights/*`: las rutas de turnos, filas y
 * encuestas son las mismas en los dos lados, y lo que cada uno puede ver o hacer lo decide el servidor en cada petición.
 */
const side = (role: Role, businessId: string) => `${root(businessId)}/${role === "admin" ? "insights" : "operation"}`;
const query = (params: Record<string, string | number | boolean | undefined | null | string[]>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
};
export interface TicketQuery {
  queueId?: string;
  status?: string[];
  search?: string;
  mine?: boolean;
  range?: string;
  from?: string;
  to?: string;
  order?: "newest" | "arrival";
  page?: number;
  pageSize?: number;
}
export interface CreateTicketBody {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  note?: string;
  answers?: Record<string, unknown>;
  clientRequestId: string;
}
export const operationApi = {
  /** «Inicio»: el operador pide su resumen; el administrador, el tablero del negocio. */
  overview: (token: string, role: Role, businessId: string, range = "today") =>
    call<Overview>(role === "admin" ? `${side(role, businessId)}/overview${query({ range })}` : `${side(role, businessId)}/home${query({ range })}`, token),
  board: async (token: string, role: Role, businessId: string) => (await call<{ queues: BoardEntry[] }>(`${side(role, businessId)}/queues`, token)).queues,
  tickets: (token: string, role: Role, businessId: string, params: TicketQuery) => call<TicketPage>(`${side(role, businessId)}/tickets${query({ ...params })}`, token),
  ticket: async (token: string, role: Role, businessId: string, ticketId: string) =>
    (await call<{ ticket: Ticket }>(`${side(role, businessId)}/tickets/${encodeURIComponent(ticketId)}`, token)).ticket,
  current: async (token: string, role: Role, businessId: string) => (await call<{ ticket: Ticket | null }>(`${side(role, businessId)}/tickets/current`, token)).ticket,
  create: (token: string, role: Role, businessId: string, queueId: string, body: CreateTicketBody) =>
    call<{ created: boolean; ticket: Ticket }>(`${side(role, businessId)}/queues/${encodeURIComponent(queueId)}/tickets`, token, { method: "POST", json: body }),
  callNext: (token: string, role: Role, businessId: string, queueId: string) =>
    call<Outcome>(`${side(role, businessId)}/queues/${encodeURIComponent(queueId)}/call-next`, token, { method: "POST" }),
  act: (token: string, role: Role, businessId: string, ticketId: string, action: "call" | "complete" | "cancel" | "no-show", reason?: string) =>
    call<Outcome>(`${side(role, businessId)}/tickets/${encodeURIComponent(ticketId)}/${action}`, token, {
      method: "POST",
      ...(action === "cancel" && reason ? { json: { reason } } : {}),
    }),
  setQueueStatus: async (token: string, role: Role, businessId: string, queueId: string, status: "paused" | "active") =>
    (await call<{ queue: QueueSummary }>(`${side(role, businessId)}/queues/${encodeURIComponent(queueId)}/${status === "paused" ? "pause" : "resume"}`, token, { method: "POST" })).queue,
  activity: async (token: string, role: Role, businessId: string, limit = 10) =>
    (await call<{ items: ActivityItem[] }>(`${side(role, businessId)}/activity${query({ limit })}`, token)).items,
  surveySummary: (token: string, role: Role, businessId: string, params: { range?: string; queueId?: string }) =>
    call<SurveySummary>(`${side(role, businessId)}/surveys/summary${query(params)}`, token),
  surveyResponses: (token: string, role: Role, businessId: string, params: { range?: string; queueId?: string; rating?: number; page?: number; pageSize?: number }) =>
    call<SurveyResponsePage>(`${side(role, businessId)}/surveys/responses${query(params)}`, token),
  /** Solo el administrador. */
  team: async (token: string, businessId: string, range = "today") => (await call<{ members: TeamMember[] }>(`${side("admin", businessId)}/team${query({ range })}`, token)).members,
  roomScreen: (token: string, businessId: string) => call<RoomScreen>(`${side("admin", businessId)}/room-screen`, token),
  saveRoomScreen: (token: string, businessId: string, body: RoomScreen["settings"]) =>
    call<RoomScreen>(`${side("admin", businessId)}/room-screen`, token, { method: "PUT", json: body }),
  saveSurvey: (token: string, businessId: string, body: unknown) => call<unknown>(`${side("admin", businessId)}/surveys/config`, token, { method: "PUT", json: body }),
  /** El reporte CSV con los mismos filtros de la lista. */
  report: async (token: string, businessId: string, params: TicketQuery): Promise<Blob> => {
    const response = await fetch(`${(import.meta.env.VITE_TURNOS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/turnos"}${side("admin", businessId)}/tickets.csv${query({ ...params })}`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`report ${response.status}`);
    return response.blob();
  },
};
export type { OperatorViewId };
/** La dirección del canal en vivo (Server-Sent Events) de cada lado. */
export const eventsUrl = (role: Role, businessId: string): string =>
  `${(import.meta.env.VITE_TURNOS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/turnos"}${side(role, businessId)}/events`;
