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
export { BusinessAppShell, PageHeading, ActivityList } from "./components/BusinessAppShell";
export type { NavItem, ActivityItem } from "./components/BusinessAppShell";
export { AppDialog } from "./components/AppDialog";
export { activityText } from "./components/activity";
export { ICONS, QUEUE_HEX, MODULE_CATALOG } from "./components/icons";
export type { IconName } from "./components/icons";
export { Badge, CardHeading, Empty, Field, Icon, InfoBox, LineChart, QueueDot, SectionHeading, Stat, Toggle, elapsed, initials } from "./components/ui";
export { toastStore } from "./stores/toast.store";
