import { lazy } from "react";
import type { AppModule } from "@/app/module";

const OrdersConfigPage = lazy(() => import("./pages/OrdersConfigPage"));

const OperationPage = lazy(() => import("./operation/pages/PedidosOperationPage"));
const LegacyOperationRedirect = lazy(() => import("./operation/pages/LegacyOperationRedirect"));

export const ordersConfigModule: AppModule = {
  id: "orders-config",
  // Single route with optional params so step changes do not remount the page or reload state.
  routes: [
    { path: "/business/pedidos/:businessId/operator", component: LegacyOperationRedirect },
    { path: "/business/pedidos/:businessId/dashboard", component: LegacyOperationRedirect },
    { path: "/business/pedidos/:businessId?/:step?", component: OrdersConfigPage },
    { path: "/business/app/:businessId/pedidos/:section?/:id?", component: OperationPage },
  ],
};
