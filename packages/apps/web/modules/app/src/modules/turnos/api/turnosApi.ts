import { AccessError, type AccessErrorKind } from "@/modules/business-access";
import type { OperatorView, TurnosProfileId, TurnosState, TurnosStep } from "../types";

/**
 * Cliente HTTP de las rutas /turnos del backend (contrato en el README de packages/services/necto-api, módulo turnos).
 * Toda llamada lleva el token de la sesión del administrador o del operador (la de business-access, que se renueva sola una vez
 * si venció). Por defecto llama a "/api/turnos", que el dev server de Vite redirige quitando ese prefijo; por eso cada ruta empieza
 * por "/turnos". En otros entornos se define VITE_TURNOS_API_URL.
 */
const BASE_URL = (import.meta.env.VITE_TURNOS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/turnos";
const TIMEOUT_MS = 20_000;

/** Un error del servicio. Es un `AccessError` (así la sesión sabe renovarse) y añade el código estable y los errores por campo. */
export class TurnosError extends AccessError {
  constructor(
    kind: AccessErrorKind,
    status: number | null,
    message: string,
    /** Errores por campo: `{ "overrides.fullLimit": ["…"] }`. Las rutas anidadas van con puntos. */
    readonly fields: Record<string, string[]> = {},
    /** Código estable: `module-not-enabled`, `reassignment-required`, `queue-has-operators`, `turnos-incomplete`, `concurrent-change`… */
    readonly code: string | null = null,
  ) {
    super(kind, status, message);
    this.name = "TurnosError";
  }
}

interface ErrorBody {
  message?: string | string[];
  code?: string;
  fields?: Record<string, string[]>;
}

function kindOf(status: number, code: string | undefined): AccessErrorKind {
  if (status === 400 || status === 409) return "validation";
  if (status === 401) return "session-expired";
  if (status === 403) return code === "reverification-required" ? "reverification-required" : "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  return "server";
}

export async function call<T>(path: string, token: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: { Authorization: `Bearer ${token}`, ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new TurnosError(aborted ? "timeout" : "network", null, aborted ? "The service took too long to respond" : "Could not reach the service");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body = ((await response.json().catch(() => null)) as ErrorBody | null) ?? {};
    const text = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? response.statusText);
    throw new TurnosError(kindOf(response.status, body.code), response.status, text, body.fields ?? {}, body.code ?? null);
  }
  return (await response.json()) as T;
}

export const root = (businessId: string) => `/turnos/businesses/${encodeURIComponent(businessId)}`;

/** Lo que se envía al crear o reemplazar una fila. Un valor propio `null` o ausente usa la regla general. */
export interface QueueBody {
  name: string;
  mode: string;
  averageMinutes: number;
  color?: string;
  overrides: { prefix: string | null; urgentMinutes: number | null; busyLimit: number | null; fullLimit: number | null };
  /** Los datos extra de la fila. Sin enviarlo, la fila conserva los que tiene. */
  fields?: Array<{ id?: string; label: string; type: string; required: boolean; options: string[] }>;
}

export interface RulesBody {
  prefixMode: string;
  fixedPrefix: string | null;
  dailyReset: boolean;
  urgentMinutes: number;
  busyLimit: number;
  fullLimit: number;
}

export interface OperatorBody {
  name: string;
  email: string;
  phone: string | null;
  queueIds: string[];
  /** Sin enviarlo, el operador conserva sus vistas y su estado. */
  views?: string[];
  status?: "active" | "inactive";
}

export const turnosApi = {
  get: (token: string, businessId: string) => call<TurnosState>(root(businessId), token),
  changeProfile: (token: string, businessId: string, profile: TurnosProfileId, addSuggestedQueues: boolean) =>
    call<TurnosState>(`${root(businessId)}/profile`, token, { method: "PUT", json: { profile, addSuggestedQueues } }),
  createQueue: (token: string, businessId: string, body: QueueBody) => call<TurnosState>(`${root(businessId)}/queues`, token, { method: "POST", json: body }),
  updateQueue: (token: string, businessId: string, queueId: string, body: QueueBody) =>
    call<TurnosState>(`${root(businessId)}/queues/${encodeURIComponent(queueId)}`, token, { method: "PUT", json: body }),
  deleteQueue: (token: string, businessId: string, queueId: string, reassignments: Array<{ operatorId: string; queueId: string }>) =>
    call<TurnosState>(`${root(businessId)}/queues/${encodeURIComponent(queueId)}`, token, { method: "DELETE", json: { reassignments } }),
  saveRules: (token: string, businessId: string, body: RulesBody) => call<TurnosState>(`${root(businessId)}/rules`, token, { method: "PUT", json: body }),
  createOperator: (token: string, businessId: string, body: OperatorBody) =>
    call<TurnosState>(`${root(businessId)}/operators`, token, { method: "POST", json: body }),
  updateOperator: (token: string, businessId: string, operatorId: string, body: OperatorBody) =>
    call<TurnosState>(`${root(businessId)}/operators/${encodeURIComponent(operatorId)}`, token, { method: "PUT", json: body }),
  deleteOperator: (token: string, businessId: string, operatorId: string) =>
    call<TurnosState>(`${root(businessId)}/operators/${encodeURIComponent(operatorId)}`, token, { method: "DELETE" }),
  saveProgress: (token: string, businessId: string, step: TurnosStep) =>
    call<TurnosState>(`${root(businessId)}/progress`, token, { method: "PUT", json: { step } }),
  complete: (token: string, businessId: string) => call<TurnosState>(`${root(businessId)}/complete`, token, { method: "POST" }),
  /** La vista del operador: él y solo sus filas. */
  operator: (token: string, businessId: string) => call<OperatorView>(`${root(businessId)}/operator`, token),
};
