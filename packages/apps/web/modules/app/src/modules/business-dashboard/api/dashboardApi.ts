import { AccessError, type AccessErrorKind } from "@/modules/business-access";
/**
 * Cliente HTTP del dashboard general (`GET /dashboard/businesses/:id`, contrato en el README de packages/services/necto-api, módulo
 * business-dashboard). Por defecto llama a "/api/dashboard", que el dev server de Vite redirige quitando ese prefijo; por eso la ruta empieza
 * por "/dashboard". En otros entornos se define VITE_DASHBOARD_API_URL. La actividad reciente se pide al contrato HTTP de Turnos.
 */
const BASE_URL = (import.meta.env.VITE_DASHBOARD_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/dashboard";
const TURNOS_URL = (import.meta.env.VITE_TURNOS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/turnos";
const TIMEOUT_MS = 20_000;
export class DashboardError extends AccessError {
  constructor(kind: AccessErrorKind, status: number | null, message: string) {
    super(kind, status, message);
    this.name = "DashboardError";
  }
}
export interface TurnosIndicators {
  queues: { total: number; paused: number };
  operators: { total: number; active: number; pending: number; inactive: number };
  today: {
    created: number;
    waiting: number;
    attending: number;
    completed: number;
    cancelled: number;
    noShow: number;
    averageWaitMinutes: number | null;
    averageServiceMinutes: number | null;
  };
  satisfaction: { average: number | null; responses: number };
}
export interface DashboardModuleView {
  id: string;
  name: string;
  description: string;
  /** Tiene una configuración propia que se puede completar hoy. */
  configurable: boolean;
  /** Ya se puede operar (hoy solo Turnos). */
  operational: boolean;
  setup: { status: "pending" | "ready"; summary: Record<string, number> | null };
  openNow: boolean | null;
  indicators: { turnos: TurnosIndicators } | null;
}
export type SetupNext = { step: "base" } | { step: "module"; moduleId: string };
export interface DashboardState {
  /** `dashboard` cuando todo está preparado; `setup` mientras falte algo (y `setup.next` dice qué). */
  entry: "dashboard" | "setup";
  business: { id: string; name: string; category: string; categoryOther: string | null; status: string; timezone: string };
  setup: {
    baseReady: boolean;
    baseReadyAt: string | null;
    next: SetupNext | null;
    pendingModules: string[];
    configurableModules: number;
    readyModules: number;
  };
  modules: DashboardModuleView[];
  generatedAt: string;
}
export interface ActivityEntry {
  type: string;
  at: string;
  by: { id: string; name: string };
  automatic: boolean;
  ticket: { id: string; code: string };
  queue: { id: string; name: string };
}
function kindOf(status: number): AccessErrorKind {
  if (status === 400 || status === 409) return "validation";
  if (status === 401) return "session-expired";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  return "server";
}
async function get<T>(url: string, token: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { credentials: "include", headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new DashboardError(aborted ? "timeout" : "network", null, aborted ? "The service took too long to respond" : "Could not reach the service");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body = ((await response.json().catch(() => null)) as { message?: string | string[] } | null) ?? {};
    throw new DashboardError(kindOf(response.status), response.status, Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? response.statusText));
  }
  return (await response.json()) as T;
}
export const dashboardApi = {
  get: (token: string, businessId: string) => get<DashboardState>(`${BASE_URL}/dashboard/businesses/${encodeURIComponent(businessId)}`, token),
  /** Lo último que pasó en Turnos (el administrador lo ve completo). */
  activity: async (token: string, businessId: string, limit = 5) =>
    (await get<{ items: ActivityEntry[] }>(`${TURNOS_URL}/turnos/businesses/${encodeURIComponent(businessId)}/insights/activity?limit=${limit}`, token)).items,
};
