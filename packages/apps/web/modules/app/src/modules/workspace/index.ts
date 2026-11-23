import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo workspace: lo único que se importa desde fuera.
 * Rutas: /workspace (directorio de negocios), /workspace/businesses/new y /workspace/businesses/:id/edit (crear y editar un
 * negocio, con el asistente del módulo businesses) y /workspace/profile (mi perfil). La app las pone detrás de la
 * sesión de superadmin y de tener el perfil de onboarding completo (`requiresSuperAdmin` y
 * `requiresOnboardingCompleted`).
 */
/**
 * Descarga la página principal del workspace sin abrirla. La pantalla de carga del onboarding la llama mientras se
 * anima, así al entrar el workspace ya está listo. Es la misma importación que usa la ruta (el mismo archivo).
 */
export const preloadWorkspacePage = () => import("./pages/WorkspacePage");

export { WorkspaceSupportDropdown } from "./components/WorkspaceSupportDropdown";
export { WorkspaceSupportWidget, openSupportWidget } from "./components/WorkspaceSupportWidget";

export const workspaceModule: AppModule = {
  id: "workspace",
  requiresSuperAdmin: true,
  requiresOnboardingCompleted: true,
  routes: [
    { path: "/workspace", component: lazy(preloadWorkspacePage) },
    { path: "/workspace/businesses/new", component: lazy(() => import("./pages/BusinessSetupPage")) },
    { path: "/workspace/businesses/:id/edit", component: lazy(() => import("./pages/BusinessSetupPage")) },
    { path: "/workspace/profile", component: lazy(() => import("./pages/ProfilePage")) },
  ],
};
