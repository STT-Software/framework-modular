import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo onboarding: lo único que se importa desde fuera.
 * Rutas (solo con sesión de superadmin; la puerta la pone la app por `requiresSuperAdmin`):
 * /welcome (animación), /welcome/phone (paso 1: teléfono) y /welcome/source (paso 2: dónde nos conociste).
 */
export const onboardingModule: AppModule = {
  id: "onboarding",
  requiresSuperAdmin: true,
  routes: [
    { path: "/welcome", component: lazy(() => import("./pages/OnboardingPage")) },
    { path: "/welcome/phone", component: lazy(() => import("./pages/PhoneStepPage")) },
    { path: "/welcome/source", component: lazy(() => import("./pages/SourceStepPage")) },
  ],
};

// Para quien necesite saber si el perfil está completo (la app, antes de abrir el workspace).
export { onboardingProfileStore } from "./stores/onboardingProfile.store";
