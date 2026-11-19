import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo turnos (frontend): lo único que se importa desde fuera.
 * La sesión es la de business-access (la misma de administradores y operadores); qué puede hacer cada rol lo decide el servidor en cada petición:
 *   /business/turnos                               entrada: abre el negocio con Turnos o vuelve al acceso
 *   /business/turnos/:businessId/:step             administrador: profile | queues | rules | operators | review
 *   /business/turnos/:businessId/operator          operador: él y solo sus filas
 */
const TurnosPage = lazy(() => import("./pages/TurnosPage"));

export const turnosModule: AppModule = {
  id: "turnos",
  // Una sola ruta con segmentos opcionales: cambiar de paso no vuelve a montar la página ni recarga lo guardado.
  routes: [{ path: "/business/turnos/:businessId?/:step?", component: TurnosPage }],
};
