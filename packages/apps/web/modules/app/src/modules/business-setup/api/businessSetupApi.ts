import { AccessError, type AccessErrorKind } from "@/modules/business-access";
import type { ModuleId } from "@/modules/businesses";
import type { SetupState, SetupStep, WeekSchedule } from "../types";

/**
 * Cliente HTTP de las rutas /business-setup del backend (contrato en el README de packages/services/necto-api).
 * Toda llamada lleva el token del administrador, que pone la sesión de business-access (`withToken` lo renueva una vez
 * si venció). Por defecto llama a "/api/business-setup", que el dev server de Vite redirige quitando ese prefijo; por eso
 * cada ruta empieza por "/business-setup". En otros entornos se define VITE_BUSINESS_SETUP_API_URL.
 */
const BASE_URL = (import.meta.env.VITE_BUSINESS_SETUP_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/business-setup";
const TIMEOUT_MS = 20_000;

/** Un error del servicio. Es un `AccessError` (así la sesión sabe renovarse) y añade los errores por campo. */
export class SetupError extends AccessError {
  constructor(
    kind: AccessErrorKind,
    status: number | null,
    message: string,
    /** Errores por campo del servidor: `{ "schedule.mon.ranges.0.end": ["…"] }`. */
    readonly fields: Record<string, string[]> = {},
    /** Código estable del servidor: `module-not-enabled`, `setup-incomplete`, `invalid-logo`, `invalid-schedule`... */
    readonly code: string | null = null,
  ) {
    super(kind, status, message);
    this.name = "SetupError";
  }
}

interface ErrorBody {
  message?: string | string[];
  code?: string;
  fields?: Record<string, string[]>;
}

function kindOf(status: number, code: string | undefined): AccessErrorKind {
  if (status === 400 || status === 409 || status === 413) return "validation";
  if (status === 401) return "session-expired";
  if (status === 403) return code === "reverification-required" ? "reverification-required" : "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  return "server";
}

async function send(path: string, token: string, init: { method?: string; json?: unknown; form?: FormData } = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        // Con un FormData el navegador pone su propio Content-Type (con el límite del multipart).
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.form ?? (init.json === undefined ? undefined : JSON.stringify(init.json)),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new SetupError(aborted ? "timeout" : "network", null, aborted ? "The service took too long to respond" : "Could not reach the service");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const body = ((await response.json().catch(() => null)) as ErrorBody | null) ?? {};
    const text = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? response.statusText);
    throw new SetupError(kindOf(response.status, body.code), response.status, text, body.fields ?? {}, body.code ?? null);
  }
  return response;
}

async function json(path: string, token: string, init?: { method?: string; json?: unknown; form?: FormData }): Promise<SetupState> {
  return (await send(path, token, init)).json() as Promise<SetupState>;
}

const root = (businessId: string) => `/business-setup/businesses/${encodeURIComponent(businessId)}`;

export const businessSetupApi = {
  get: (token: string, businessId: string) => json(root(businessId), token),
  saveProfile: (token: string, businessId: string, body: Record<string, string | null>) =>
    json(`${root(businessId)}/profile`, token, { method: "PUT", json: body }),
  saveCategory: (token: string, businessId: string, category: string, categoryOther: string | null) =>
    json(`${root(businessId)}/category`, token, { method: "PUT", json: categoryOther === null ? { category } : { category, categoryOther } }),
  saveSchedule: (token: string, businessId: string, schedule: WeekSchedule) =>
    json(`${root(businessId)}/schedule`, token, { method: "PUT", json: { schedule } }),
  saveModuleSchedule: (token: string, businessId: string, moduleId: ModuleId, body: { inherit: boolean; schedule?: WeekSchedule }) =>
    json(`${root(businessId)}/schedule/modules/${encodeURIComponent(moduleId)}`, token, { method: "PUT", json: body }),
  saveProgress: (token: string, businessId: string, step: SetupStep) =>
    json(`${root(businessId)}/progress`, token, { method: "PUT", json: { step } }),
  complete: (token: string, businessId: string) => json(`${root(businessId)}/complete`, token, { method: "POST" }),
  uploadLogo: (token: string, businessId: string, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return json(`${root(businessId)}/logo`, token, { method: "PUT", form });
  },
  removeLogo: (token: string, businessId: string) => json(`${root(businessId)}/logo`, token, { method: "DELETE" }),
  /** La imagen necesita el token, así que se descarga con fetch y la página la muestra con un `blob:` URL. */
  async downloadLogo(token: string, businessId: string): Promise<Blob> {
    return (await send(`${root(businessId)}/logo`, token)).blob();
  },
};
