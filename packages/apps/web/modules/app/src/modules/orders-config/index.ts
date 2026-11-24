import { lazy } from "react";
import type { AppModule } from "@/app/module";

const OrdersConfigPage = lazy(() => import("./pages/OrdersConfigPage"));

export const ordersConfigModule: AppModule = {
  id: "orders-config",
  // Single route with optional params so step changes do not remount the page or reload state.
  routes: [{ path: "/business/pedidos/:businessId?/:step?", component: OrdersConfigPage }],
};
