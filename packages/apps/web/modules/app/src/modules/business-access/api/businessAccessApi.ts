/**
 * Cliente HTTP de las rutas /business-access del backend (contrato en el README de packages/services/necto-api).
 * El administrador de un negocio entra sin contraseña: pide un código por correo y lo canjea por una sesión.
 *
 * La sesión vive en una cookie HttpOnly que pone el servidor (el navegador la envía solo: aquí nunca se lee). El
 * `accessToken` que devuelve el servidor es corto y se guarda solo en memoria.
 *
 * Por defecto llama a "/api/business-access", que el dev server de Vite redirige al backend quitando ese prefijo;
 * por eso cada ruta empieza por "/business-access" (el prefijo del controlador).
 * En otros entornos se define VITE_BUSINESS_ACCESS_API_URL (y el backend debe permitir ese origen con credenciales).
 */
const BASE_URL =
  (import.meta.env.VITE_BUSINESS_ACCESS_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/business-access";
const TIMEOUT_MS = 15_000;

export type AccessErrorKind =
  | "invalid-code"
  | "session-expired"
  | "reverification-required"
  | "validation"
  | "forbidden"
  | "not-found"
  | "email-not-assigned"
  | "rate-limited"
  | "network"
  | "timeout"
  | "server";

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

/** Un negocio que la persona administra ahora mismo (el servidor solo devuelve los autorizados). */
export interface AdministeredBusiness {
  id: string;
  name: string;
  category: string;
  /** El texto libre de la categoría, solo cuando es "other". */
  categoryOther: string | null;
  modules: string[];
}

/** Lo que recibe el navegador al abrir o renovar una sesión. */
export interface SessionGrant {
  accessToken: string;
  expiresInSeconds: number;
  admin: { email: string; remember: boolean };
  businesses: AdministeredBusiness[];
}

/** Las reglas del código (vigencia, reenvío e intentos): son las mismas para cualquier correo. */
export interface CodeRules {
  expiresInMinutes: number;
  resendAfterSeconds: number;
  maxAttempts: number;
}

export interface SessionInfo {
  email: string;
  remember: boolean;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

interface ErrorBody {
  message?: string | string[];
  code?: string;
}

function kindOf(status: number, path: string, code: string | undefined): AccessErrorKind {
  if (status === 400) return "validation";
  if (status === 401) {
    if (code === "session-expired") return "session-expired";
    return path === "/business-access/otp/verify" ? "invalid-code" : "session-expired";
  }
  if (status === 403) return code === "reverification-required" ? "reverification-required" : "forbidden";
  if (status === 404) return code === "email-not-assigned" ? "email-not-assigned" : "not-found";
  if (status === 429) return "rate-limited";
  return "server";
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      // Envía y recibe la cookie de sesión (HttpOnly: el código de la página nunca la ve).
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new AccessError(aborted ? "timeout" : "network", null, aborted ? "The service took too long to respond" : "Could not reach the service");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { message, code } = (body as ErrorBody | null) ?? {};
    const text = Array.isArray(message) ? message.join(", ") : (message ?? response.statusText);
    const retry = Number(response.headers.get("Retry-After"));
    throw new AccessError(kindOf(response.status, path, code), response.status, text, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return body as T;
}

export const businessAccessApi = {
  /** Pide el código. Si el correo no es jefe de ningún negocio activo, falla con `email-not-assigned`. */
  requestCode(email: string): Promise<CodeRules> {
    return request<CodeRules>("/business-access/otp/request", { method: "POST", body: { email } });
  },
  /** `remember` es la decisión explícita de la persona de recordar este dispositivo (hasta 30 días). */
  verifyCode(email: string, code: string, remember: boolean): Promise<SessionGrant> {
    return request<SessionGrant>("/business-access/otp/verify", { method: "POST", body: { email, code, remember } });
  },
  /** ¿Hay una sesión vigente en este navegador? 401 si no. */
  currentSession(): Promise<SessionInfo> {
    return request<SessionInfo>("/business-access/session");
  },
  /** Continúa con la sesión de este navegador: token nuevo y negocios autorizados en este momento. */
  refresh(): Promise<SessionGrant> {
    return request<SessionGrant>("/business-access/session/refresh", { method: "POST" });
  },
  /** Cierra la sesión en el servidor y borra la cookie. Sirve para cerrar sesión y para olvidar el dispositivo. */
  signOut(): Promise<void> {
    return request<void>("/business-access/session", { method: "DELETE" });
  },
  business(token: string, businessId: string): Promise<AdministeredBusiness> {
    return request<AdministeredBusiness>(`/business-access/businesses/${encodeURIComponent(businessId)}`, { token });
  },
};
