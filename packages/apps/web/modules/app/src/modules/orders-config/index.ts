import { lazy } from "react";
import type { AppModule } from "@/app/module";

const OrdersConfigPage = lazy(() => import("./pages/OrdersConfigPage"));

const OperationPage = lazy(() => import("./operation/pages/PedidosOperationPage"));
const LegacyOperationRedirect = lazy(() => import("./operation/pages/LegacyOperationRedirect"));
const PublicCatalogPage = lazy(() => import("./operation/pages/PublicCatalogPage"));
const CheckoutGlobalPayPage = lazy(() => import("./operation/pages/CheckoutGlobalPayPage"));

export const ordersConfigModule: AppModule = {
  id: "orders-config",
  // Single route with optional params so step changes do not remount the page or reload state.
  routes: [
    { path: "/catalogo-clientes/:businessId?", component: PublicCatalogPage },
    { path: "/checkout/:ref?", component: CheckoutGlobalPayPage },
    { path: "/business/pedidos/:businessId/operator", component: LegacyOperationRedirect },
    { path: "/business/pedidos/:businessId/dashboard", component: LegacyOperationRedirect },
    { path: "/business/pedidos/:businessId?/:step?", component: OrdersConfigPage },
    { path: "/business/app/:businessId/pedidos/:section?/:id?", component: OperationPage },
  ],
};
