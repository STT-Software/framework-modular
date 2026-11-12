import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo super-admin-auth: lo único que se importa desde fuera.
 * Rutas: /super/login y /super/register.
 */
export const superAdminAuthModule: AppModule = {
  id: "super-admin-auth",
  routes: [
    {
      path: "/super",
      component: lazy(() => import("./SuperAdminAuthLayout")),
      children: [
        { index: true, redirectTo: "login" },
        { path: "login", component: lazy(() => import("./pages/LoginPage")) },
        { path: "register", component: lazy(() => import("./pages/RegisterPage")) },
      ],
    },
  ],
};

export { superAdminSessionStore } from "./stores/superAdminSession.store";
export type { SuperAdmin } from "./api/superAdminAuthApi";
