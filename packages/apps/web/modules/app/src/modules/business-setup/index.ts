import { lazy } from "react";
import type { AppModule } from "@/app/module";

/**
 * Puerta pública del módulo business-setup (frontend): lo único que se importa desde fuera.
 * Rutas públicas para la app (la sesión es la del administrador, de business-access, que se verifica en el servidor):
 *   /business/setup                         entrada: abre el negocio o vuelve al acceso
 *   /business/setup/:businessId             los módulos asignados
 *   /business/setup/:businessId/:step       data | schedule | category | review
 */
const BusinessSetupPage = lazy(() => import("./pages/BusinessSetupPage"));

export const businessSetupModule: AppModule = {
  id: "business-setup",
  // Una sola ruta con segmentos opcionales: así cambiar de paso no vuelve a montar la página ni recarga lo guardado.
  routes: [{ path: "/business/setup/:businessId?/:step?", component: BusinessSetupPage }],
};
