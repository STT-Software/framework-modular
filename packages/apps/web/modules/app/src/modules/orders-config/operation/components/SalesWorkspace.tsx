import { useState, type ReactNode } from "react";
import { ChatIcon } from "@/icons";
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
    {section === "chats" && (
      <div className="nd-card nd-pad flex flex-col items-center justify-center text-center p-12 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500">
          <ChatIcon className="size-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Conversaciones y Canales</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mt-1">
            Conecta tus canales de WhatsApp y redes sociales para gestionar conversaciones y pedidos en vivo desde este panel.
          </p>
        </div>
      </div>
    )}
    {section === "analytics" && <AnalyticsPage orders={orders}/>}
  </section>;
}
