import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo turnos (frontend): lo único que se importa desde fuera.
 * La sesión es la de business-access (la misma de administradores y operadores); qué puede hacer cada rol lo decide el servidor en cada petición:
 *   /business/turnos                               entrada: abre el negocio con Turnos o vuelve al acceso
 *   /business/turnos/:businessId/:step             administrador: profile | queues | rules | operators | review
 *   /business/turnos/:businessId/operator          operador: él y solo sus filas
 * La operación (turnos en marcha, tablero, encuestas, equipo, pantalla de sala), para el administrador y los operadores:
 *   /business/app/:businessId/turnos/:section/:id  dashboard | tickets | create | created/:id | queues | board/:id | surveys | team | display
 */
const TurnosPage = lazy(() => import("./pages/TurnosPage"));
const OperationPage = lazy(() => import("./operation/pages/OperationPage"));

export const turnosModule: AppModule = {
  id: "turnos",
  // Una sola ruta con segmentos opcionales: cambiar de paso no vuelve a montar la página ni recarga lo guardado.
  routes: [
    { path: "/business/turnos/:businessId?/:step?", component: TurnosPage },
    { path: "/business/app/:businessId/turnos/:section?/:id?", component: OperationPage },
  ],
};
