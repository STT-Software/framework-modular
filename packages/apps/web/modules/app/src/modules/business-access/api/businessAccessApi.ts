/**
 * Cliente HTTP de las rutas /business-access del backend (contrato en el README de packages/services/necto-api).
 * El jefe de un negocio entra sin contraseña: pide un código por correo y lo canjea por una sesión.
 *
 * Por defecto llama a "/api/business-access", que el dev server de Vite redirige al backend.
 * En otros entornos se define VITE_BUSINESS_ACCESS_API_URL.
 */
const BASE_URL =
  (import.meta.env.VITE_BUSINESS_ACCESS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/business-access";
const TIMEOUT_MS = 15_000;

export type AccessErrorKind = "invalid-code" | "validation" | "unauthorized" | "forbidden" | "rate-limited" | "network" | "timeout" | "server";

export class AccessError extends Error {
  constructor(
    readonly kind: AccessErrorKind,
    readonly status: number | null,
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export interface BossSessionResult {
  accessToken: string;
  business: { id: string; name: string };
  boss: { name: string; email: string };
}

export interface BossOverview {
  business: { id: string; name: string; status: "active" | "paused"; modules: string[] };
  boss: { name: string; email: string };
}

function kindFromStatus(status: number, path: string): AccessErrorKind {
  if (status === 400) return "validation";
  if (status === 401) return path.includes("/otp/verify") ? "invalid-code" : "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate-limited";
  return "server";
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new AccessError(aborted ? "timeout" : "network", null, aborted ? "The service took too long to respond" : "Could not reach the service");
  } finally {
    clearTimeout(timer);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = (body as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? response.statusText);
    const retry = Number(response.headers.get("Retry-After"));
    throw new AccessError(kindFromStatus(response.status, path), response.status, message, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return body as T | null;
}

export const businessAccessApi = {
  /** Always answers the same, whether or not the email belongs to the business: it reveals nothing. */
  async requestCode(businessId: string, email: string): Promise<void> {
    await request("/business-access/otp/request", { method: "POST", body: JSON.stringify({ businessId, email }) });
  },
  async verifyCode(businessId: string, email: string, code: string): Promise<BossSessionResult> {
    return (await request<BossSessionResult>("/business-access/otp/verify", { method: "POST", body: JSON.stringify({ businessId, email, code }) }))!;
  },
  async me(token: string): Promise<BossOverview> {
    return (await request<BossOverview>("/business-access/me", {}, token))!;
  },
};
