import { lazy } from "react";
import type { AppModule } from "@/app/module";
import { loadOnboardingPage, loadPhoneStepPage, loadReadyPage, loadSourceStepPage } from "./pages/loaders";

/**
 * Puerta pública del módulo onboarding: lo único que se importa desde fuera.
 * Rutas (solo con sesión de superadmin; la puerta la pone la app por `requiresSuperAdmin`):
 * /welcome (animación), /welcome/phone (paso 1: teléfono), /welcome/source (paso 2: dónde nos conociste) y
 * /welcome/ready (cierre con las formas de marca como decoración; "Comenzar" lleva al workspace).
 */
export const onboardingModule: AppModule = {
  id: "onboarding",
  requiresSuperAdmin: true,
  routes: [
    { path: "/welcome", component: lazy(loadOnboardingPage) },
    { path: "/welcome/phone", component: lazy(loadPhoneStepPage) },
    { path: "/welcome/source", component: lazy(loadSourceStepPage) },
    { path: "/welcome/ready", component: lazy(loadReadyPage) },
  ],
};

// Para quien necesite saber si el perfil está completo (la app, antes de abrir el workspace) y a qué paso llevarlo.
export { onboardingProfileStore } from "./stores/onboardingProfile.store";
export { nextOnboardingPath } from "./flow";
