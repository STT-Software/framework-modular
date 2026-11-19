import type { DocumentType } from "../documentTypes";

/**
 * Cliente HTTP del servicio super-admin-auth (ver su README para el contrato).
 *
 * Por defecto llama a "/api/super-admin-auth", que el dev server de Vite redirige
 * al servicio. En otros entornos se define VITE_SUPER_ADMIN_AUTH_API_URL.
 */
const BASE_URL =
  (import.meta.env.VITE_SUPER_ADMIN_AUTH_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "/api/super-admin-auth";

const TIMEOUT_MS = 10_000;

export interface SuperAdmin {
  id: string;
  username: string;
  email: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  identityDocumentType: DocumentType;
  identityDocument: string;
  /** Debe ser true: el servidor rechaza el registro si no se aceptaron los términos. */
  acceptTerms: boolean;
}

export interface LoginResult {
  accessToken: string;
  superAdmin: SuperAdmin;
}

/** Respuesta de `register` y `resend`: la cuenta aún no existe, queda pendiente del código enviado por correo. */
export interface PendingRegistration {
  registrationId: string;
  email: string;
  /** ISO: cuándo vence el código. */
  expiresAt: string;
  /** ISO: desde cuándo se puede pedir otro código. */
  resendAvailableAt: string;
}

export interface VerifyRegistrationInput {
  registrationId: string;
  code: string;
}

export type AuthErrorKind =
  | "validation"
  | "invalid-code"
  | "code-expired"
  | "too-many-attempts"
  | "resend-too-soon"
  | "too-many-codes"
  | "conflict"
  | "unauthorized"
  | "rate-limited"
  | "network"
  | "timeout"
  | "server";

export type RegisterField = "username" | "email" | "identityDocument";

/** Error del servicio con un tipo claro, para que la pantalla decida qué mostrar. */
export class SuperAdminAuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    readonly status: number | null,
    message: string,
    /** Campo que causó el conflicto (solo en `conflict`). */
    readonly field?: RegisterField,
  ) {
    super(message);
    this.name = "SuperAdminAuthError";
  }
}

function conflictField(message: string): RegisterField | undefined {
  if (message.includes("username")) return "username";
  if (message.includes("email")) return "email";
  if (message.includes("identity document")) return "identityDocument";
  return undefined;
}

/** Códigos estables que el backend envía en `code` para el paso de verificación. */
const CODE_KINDS: Record<string, AuthErrorKind> = {
  "invalid-code": "invalid-code",
  "code-expired": "code-expired",
  "too-many-attempts": "too-many-attempts",
  "resend-too-soon": "resend-too-soon",
  "too-many-codes": "too-many-codes",
};

function kindFromStatus(status: number): AuthErrorKind {
  if (status === 400) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 409) return "conflict";
  if (status === 429) return "rate-limited";
  return "server";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new SuperAdminAuthError(
      aborted ? "timeout" : "network",
      null,
      aborted ? "The service took too long to respond" : "Could not reach the service",
    );
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = body as { message?: string | string[]; code?: string } | null;
    const raw = parsed?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : (raw ?? response.statusText);
    const kind = (parsed?.code && CODE_KINDS[parsed.code]) || kindFromStatus(response.status);
    throw new SuperAdminAuthError(
      kind,
      response.status,
      message,
      kind === "conflict" ? conflictField(message) : undefined,
    );
  }

  return body as T;
}

export const superAdminAuthApi = {
  /** Guarda el registro como pendiente y envía un código de 6 dígitos al correo. No crea la cuenta. */
  register(input: RegisterInput): Promise<PendingRegistration> {
    return request<PendingRegistration>("/auth/super/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Comprueba el código, crea la cuenta y devuelve la sesión (igual que login). */
  verifyRegistration(input: VerifyRegistrationInput): Promise<LoginResult> {
    return request<LoginResult>("/auth/super/register/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Genera y envía un código nuevo; el anterior deja de valer. */
  resendRegistrationCode(registrationId: string): Promise<PendingRegistration> {
    return request<PendingRegistration>("/auth/super/register/resend", {
      method: "POST",
      body: JSON.stringify({ registrationId }),
    });
  },

  login(input: LoginInput): Promise<LoginResult> {
    return request<LoginResult>("/auth/super/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me(accessToken: string): Promise<SuperAdmin> {
    return request<SuperAdmin>("/auth/super/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
