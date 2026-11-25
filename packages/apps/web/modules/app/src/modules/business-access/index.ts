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
/**
 * Lo que otros módulos del administrador (hoy business-setup) pueden usar: su sesión (token en memoria, renovable) y el
 * error tipado del cliente. Nunca los componentes ni el cliente HTTP del acceso.
 */
export * from "./public";
