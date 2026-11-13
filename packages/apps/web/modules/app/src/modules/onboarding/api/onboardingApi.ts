import { superAdminSessionStore } from "@/modules/super-admin-auth";
import type { SourceId } from "../sources";

/**
 * Cliente HTTP del servicio onboarding (ver su README para el contrato).
 *
 * Por defecto llama a "/api/onboarding", que el dev server de Vite redirige al
 * servicio. En otros entornos se define VITE_ONBOARDING_API_URL.
 */
const BASE_URL =
  (import.meta.env.VITE_ONBOARDING_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/onboarding";
const TIMEOUT_MS = 10_000;

export interface Profile {
  /** Teléfono en formato E.164 (+573001234567), o null si aún no lo guardó. */
  phone: string | null;
  sources: SourceId[];
  /** True cuando ya terminó los dos pasos. */
  completed: boolean;
}

export type OnboardingErrorKind =
  | "validation"
  | "conflict"
  | "unauthorized"
  | "rate-limited"
  | "network"
  | "timeout"
  | "server";

/** Error del servicio con un tipo claro, para que la pantalla decida qué mostrar. */
export class OnboardingError extends Error {
  constructor(
    readonly kind: OnboardingErrorKind,
    readonly status: number | null,
    message: string,
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
    const raw = (body as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? response.statusText);
    // El token venció o no es válido: se cierra la sesión y la puerta de acceso lleva al login.
    if (response.status === 401) superAdminSessionStore.signOut();
    throw new OnboardingError(kindFromStatus(response.status), response.status, message);
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
  saveSources(sources: SourceId[]): Promise<Profile> {
    return request<Profile>("/onboarding/profile/sources", { method: "PUT", body: JSON.stringify({ sources }) });
  },
};
