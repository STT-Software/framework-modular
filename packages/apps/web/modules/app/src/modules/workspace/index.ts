import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo workspace: lo único que se importa desde fuera.
 * Rutas: /workspace (directorio de negocios) y /workspace/profile (mi perfil). La app las pone detrás de la
 * sesión de superadmin y de tener el perfil de onboarding completo (`requiresSuperAdmin` y
 * `requiresOnboardingCompleted`).
 */
export const workspaceModule: AppModule = {
  id: "workspace",
  requiresSuperAdmin: true,
  requiresOnboardingCompleted: true,
  routes: [
    { path: "/workspace", component: lazy(() => import("./pages/WorkspacePage")) },
    { path: "/workspace/profile", component: lazy(() => import("./pages/ProfilePage")) },
  ],
};
