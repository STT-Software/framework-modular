import { lazy } from "react";
import type { AppModule } from "@/app/module";

const OrdersConfigPage = lazy(() => import("./pages/OrdersConfigPage"));

export const ordersConfigModule: AppModule = {
  id: "orders-config",
  routes: [
    { path: "/business/pedidos", component: OrdersConfigPage },
    { path: "/business/pedidos/:businessId", component: OrdersConfigPage },
    { path: "/business/pedidos/:businessId/:step", component: OrdersConfigPage },
  ],
};
