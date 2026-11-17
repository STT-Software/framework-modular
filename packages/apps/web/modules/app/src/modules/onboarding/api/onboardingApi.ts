import { superAdminSessionStore } from "@/modules/super-admin-auth";
import type { SourceId } from "../sources";

/**
 * Cliente HTTP de las rutas de onboarding del backend (contrato en el README de
 * packages/services/necto-api).
 *
 * Por defecto llama a "/api/onboarding", que el dev server de Vite redirige al backend.
 * En otros entornos se define VITE_ONBOARDING_API_URL.
 */
const BASE_URL =
  (import.meta.env.VITE_ONBOARDING_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/onboarding";
const TIMEOUT_MS = 10_000;

export interface Profile {
  /** Teléfono en formato E.164 (+573001234567), o null si aún no lo guardó. */
  phone: string | null;
  sources: SourceId[];
  /**
   * Texto libre de «Otro» (máximo 80 caracteres), o null. Opcional: un servicio anterior no lo envía.
   */
  sourceOther?: string | null;
  /** True cuando ya terminó los dos pasos. */
  completed: boolean;
  /**
   * True si la cuenta ya vio la intro de bienvenida (en cualquier dispositivo) o ya completó el perfil: la intro solo
   * la ven los usuarios nuevos, una vez.
   */
  introSeen: boolean;
}

export type OnboardingErrorKind =
  | "validation"
  | "conflict"
  | "unauthorized"
  | "rate-limited"
  | "network"
  | "timeout"
  | "server";

/**
 * Códigos que el servicio pone en `code` para distinguir errores del mismo estado HTTP (contrato en el README del API):
 * - `phone-in-use`: otra cuenta ya usa el número (409).
 * - `phone-required`: se envió el paso 2 sin teléfono guardado (409); hay que volver al paso 1.
 */
export type OnboardingErrorCode = "phone-in-use" | "phone-required";

/** Error del servicio con un tipo claro, para que la pantalla decida qué mostrar. */
export class OnboardingError extends Error {
  constructor(
    readonly kind: OnboardingErrorKind,
    readonly status: number | null,
    message: string,
    /** Código del servicio (`code` del cuerpo), o null si no vino (errores de red o un servicio anterior). */
    readonly code: OnboardingErrorCode | (string & {}) | null = null,
  ) {
    super(message);
    this.name = "OnboardingError";
  }
}

function kindFromStatus(status: number): OnboardingErrorKind {
  if (status === 400) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 409) return "conflict";
  if (status === 429) return "rate-limited";
  return "server";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = superAdminSessionStore.accessToken;
  if (!token) {
    throw new OnboardingError("unauthorized", 401, "There is no active session");
  }

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
    throw new OnboardingError(
      aborted ? "timeout" : "network",
      null,
      aborted ? "The service took too long to respond" : "Could not reach the service",
    );
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = body as { message?: string | string[]; code?: unknown } | null;
    const raw = parsed?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? response.statusText);
    const code = typeof parsed?.code === "string" ? parsed.code : null;
    // El token venció o no es válido: se cierra la sesión y la puerta de acceso lleva al login.
    if (response.status === 401) superAdminSessionStore.signOut();
    throw new OnboardingError(kindFromStatus(response.status), response.status, message, code);
  }
  return body as T;
}

export const onboardingApi = {
  getProfile(): Promise<Profile> {
    return request<Profile>("/onboarding/profile/me");
  },
  savePhone(phone: string): Promise<Profile> {
    return request<Profile>("/onboarding/profile/phone", { method: "PUT", body: JSON.stringify({ phone }) });
  },
  /**
   * Paso 2. `sources` vacío es «Omitir»; `sourceOther` solo cuenta con `other` (si no se pasa, no se envía: así sigue
   * funcionando con un servicio anterior).
   */
  saveSources(sources: SourceId[], sourceOther?: string | null): Promise<Profile> {
    const body = sourceOther === undefined ? { sources } : { sources, sourceOther };
    return request<Profile>("/onboarding/profile/sources", { method: "PUT", body: JSON.stringify(body) });
  },
  /** La intro de bienvenida ya se mostró: no se volverá a mostrar a esta cuenta en ningún dispositivo. */
  markIntroSeen(): Promise<Profile> {
    return request<Profile>("/onboarding/profile/intro-seen", { method: "PUT" });
  },
};
