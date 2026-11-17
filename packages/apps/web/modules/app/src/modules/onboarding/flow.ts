import type { Profile } from "./api/onboardingApi";
import { AFTER_ONBOARDING_PATH, PHONE_STEP_PATH, SOURCE_STEP_PATH } from "./paths";

/*
 * Única fuente de verdad del flujo: a dónde va la persona según su perfil. La usan `/welcome`, los pasos, Ready y la
 * puerta del workspace (`app/RequireOnboardingCompleted.tsx`). Son funciones puras, sin red ni estado.
 */

/** Lo mínimo del perfil que decide el siguiente paso. */
export type FlowProfile = Pick<Profile, "phone" | "completed">;

/**
 * Siguiente pantalla del onboarding:
 * - perfil completo → workspace;
 * - con teléfono guardado → paso 2 (dónde nos conociste, opcional);
 * - sin teléfono → paso 1.
 *
 * Nunca se deduce nada de `sources`: el paso 2 se puede omitir (lista vacía) y aun así el perfil queda completo.
 */
export function nextOnboardingPath(profile: FlowProfile): string {
  if (profile.completed) return AFTER_ONBOARDING_PATH;
  if (profile.phone) return SOURCE_STEP_PATH;
  return PHONE_STEP_PATH;
}

/** Qué muestra `/welcome`: la intro animada (solo la primera vez) o la pantalla de carga «El cruce». */
export type WelcomeMode = "intro" | "loader";

/**
 * Decisión de `/welcome` con el perfil fresco del servicio. La intro solo la ve quien no la ha visto ni completó el
 * perfil (el servicio ya cuenta como vista a quien guardó un teléfono). Sin perfil (la consulta falló) se va a la
 * pantalla de carga, que lleva al paso donde se ven el error y «Reintentar».
 */
export function welcomeMode(profile: Pick<Profile, "introSeen" | "completed"> | null): WelcomeMode {
  if (!profile) return "loader";
  return profile.introSeen || profile.completed ? "loader" : "intro";
}

/** Pide el perfil (por ejemplo `ensureLoaded({ maxAgeMs: 0 })`) y decide; un error nunca muestra la intro. */
export async function resolveWelcomeMode(loadProfile: () => Promise<Profile>): Promise<WelcomeMode> {
  try {
    return welcomeMode(await loadProfile());
  } catch {
    return "loader";
  }
}
