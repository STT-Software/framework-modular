import { lazy } from "react";
import type { AppModule } from "@/app/module";
/**
 * Puerta pública del módulo business-dashboard (frontend): lo único que se importa desde fuera.
 * El dashboard general del administrador y el marco de la aplicación del negocio (`nd-`), que comparten las pantallas de Turnos.
 *   /business/app/:businessId           el resumen del negocio
 *   /business/app/:businessId/modules   «Mis módulos»
 * La sesión es la de business-access; el servidor decide si la persona es el administrador vigente y qué falta por configurar.
 */
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
export const businessDashboardModule: AppModule = {
  id: "business-dashboard",
  routes: [{ path: "/business/app/:businessId/:section?", component: DashboardPage }],
};
export * from "./public";
