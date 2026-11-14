import { superAdminSessionStore } from "@/modules/super-admin-auth";
import type { Business, BusinessFilters, BusinessInput, BusinessPage, InvitationStatus } from "../types";

/**
 * Cliente HTTP de las rutas /businesses del backend (contrato en el README de packages/services/necto-api).
 *
 * Por defecto llama a "/api/businesses", que el dev server de Vite redirige al backend.
 * En otros entornos se define VITE_BUSINESSES_API_URL.
 */
const BASE_URL = (import.meta.env.VITE_BUSINESSES_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/businesses";
const TIMEOUT_MS = 15_000;

export type BusinessesErrorKind =
  | "validation"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "network"
  | "timeout"
  | "server";

/** Error del servicio con un tipo claro y, si es de validación, los campos rechazados (por ruta: `boss.email`). */
export class BusinessesError extends Error {
  constructor(
    readonly kind: BusinessesErrorKind,
    readonly status: number | null,
    message: string,
    readonly fields: Record<string, string[]> = {},
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "BusinessesError";
  }
}

function kindFromStatus(status: number): BusinessesErrorKind {
  if (status === 400) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate-limited";
  return "server";
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const token = superAdminSessionStore.accessToken;
  if (!token) throw new BusinessesError("unauthorized", 401, "There is no active session");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new BusinessesError(aborted ? "timeout" : "network", null, aborted ? "The service took too long to respond" : "Could not reach the service");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const raw = (body as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? response.statusText);
    const fields = (body as { fields?: Record<string, string[]> } | null)?.fields ?? {};
    const retry = Number(response.headers.get("Retry-After"));
    // El token venció o no es válido: se cierra la sesión y la puerta de acceso lleva al login.
    if (response.status === 401) superAdminSessionStore.signOut();
    throw new BusinessesError(kindFromStatus(response.status), response.status, message, fields, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return response;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await send(path, init)).json() as Promise<T>;
}

function filterQuery(filters: Partial<BusinessFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  return params;
}

export const businessesApi = {
  list(filters: Partial<BusinessFilters>, page: number, pageSize: number): Promise<BusinessPage> {
    const params = filterQuery(filters);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return json<BusinessPage>(`/businesses?${params}`);
  },
  get(id: string): Promise<Business> {
    return json<Business>(`/businesses/${encodeURIComponent(id)}`);
  },
  /** `idempotencyKey` makes a repeated submit return the same business instead of creating another. */
  create(input: BusinessInput, idempotencyKey: string): Promise<Business> {
    return json<Business>("/businesses", { method: "POST", body: JSON.stringify(input), headers: { "Idempotency-Key": idempotencyKey } });
  },
  update(id: string, input: BusinessInput): Promise<Business> {
    return json<Business>(`/businesses/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
  },
  pause(id: string): Promise<Business> {
    return json<Business>(`/businesses/${encodeURIComponent(id)}/pause`, { method: "POST" });
  },
  resume(id: string): Promise<Business> {
    return json<Business>(`/businesses/${encodeURIComponent(id)}/resume`, { method: "POST" });
  },
  invitation(id: string): Promise<InvitationStatus> {
    return json<InvitationStatus>(`/businesses/${encodeURIComponent(id)}/invitation`);
  },
  resendInvitation(id: string): Promise<InvitationStatus> {
    return json<InvitationStatus>(`/businesses/${encodeURIComponent(id)}/invitation/resend`, { method: "POST" });
  },
  /** The CSV of the businesses that match the filters. It needs the session token, so it is fetched here and saved as a file. */
  async exportCsv(filters: Partial<BusinessFilters>): Promise<Blob> {
    const query = filterQuery(filters).toString();
    const response = await send(`/businesses/export.csv${query ? `?${query}` : ""}`, { headers: { Accept: "text/csv" } });
    return response.blob();
  },
};
