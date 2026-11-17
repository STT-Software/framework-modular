import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo onboarding: lo único que se importa desde fuera.
 * Rutas (solo con sesión de superadmin; la puerta la pone la app por `requiresSuperAdmin`):
 * /welcome (animación), /welcome/phone (paso 1: teléfono), /welcome/source (paso 2: dónde nos conociste) y
 * /welcome/ready (cierre con el juego de formas; "Comenzar" lleva al workspace).
 */
export const onboardingModule: AppModule = {
  id: "onboarding",
  requiresSuperAdmin: true,
  routes: [
    { path: "/welcome", component: lazy(() => import("./pages/OnboardingPage")) },
    { path: "/welcome/phone", component: lazy(() => import("./pages/PhoneStepPage")) },
    { path: "/welcome/source", component: lazy(() => import("./pages/SourceStepPage")) },
    { path: "/welcome/ready", component: lazy(() => import("./pages/ReadyPage")) },
  ],
};

// Para quien necesite saber si el perfil está completo (la app, antes de abrir el workspace) y a qué paso llevarlo.
export { onboardingProfileStore } from "./stores/onboardingProfile.store";
export { nextOnboardingPath } from "./flow";
