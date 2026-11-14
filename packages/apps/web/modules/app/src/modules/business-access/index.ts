import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo business-access (frontend): lo único que se importa desde fuera.
 * Ruta pública: /business/access?business=<id> (el enlace del correo de invitación). Es la entrada del JEFE de un
 * negocio, con su propia sesión; no usa la puerta del superadmin.
 */
export const businessAccessModule: AppModule = {
  id: "business-access",
  routes: [{ path: "/business/access", component: lazy(() => import("./pages/BusinessAccessPage")) }],
};
