import { useState, type ReactNode } from "react";
import type { PedidosOperatorView } from "../../types";
import { CarriersPage } from "../pages/CarriersPage";
import { IncidentsPage } from "../pages/IncidentsPage";
import { CatalogPage, type Product } from "../pages/CatalogPage";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { OrdersPage } from "../pages/OrdersPage";
import { PickupStore } from "../stores/PickupStore";
import { IncidentStore } from "../stores/IncidentStore";
import type { Order } from "../domain/order";
import type { SalesSection } from "../sections";
import "../styles/sales.css";

export function SalesWorkspace({ section, detailId, view, openSection, children }: {
  section?: SalesSection; detailId?: string; view: PedidosOperatorView; openSection: (section: SalesSection, id?: string) => void; children: ReactNode;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pickups] = useState(() => new PickupStore());
  const [incidents] = useState(() => new IncidentStore());
  if (!section) return <>{children}</>;
  return <section className="sales-workspace">
    <aside className="sales-preview">Vista previa · Los cambios duran hasta que salgas de este espacio o recargues la página.</aside>
    {section === "orders" && <OrdersPage selected={detailId ?? ""} setSelected={id => openSection("orders", id)} orders={orders} products={products} stages={view.operator.stages} modalities={view.modalities} onChange={setOrders} incidents={incidents} openCatalog={() => openSection("catalog")} openIncidents={() => openSection("incidents")}/>}
    {section === "incidents" && <IncidentsPage activeIncidentId={detailId} setActiveIncidentId={id => openSection("incidents", id ?? undefined)} store={incidents}/>}
    {section === "carriers" && <CarriersPage store={pickups}/>}
    {section === "catalog" && <CatalogPage products={products} onChange={setProducts}/>}
    {section === "analytics" && <AnalyticsPage orders={orders}/>}
  </section>;
}
