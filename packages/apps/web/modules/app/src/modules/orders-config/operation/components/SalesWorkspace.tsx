import { useEffect, useState, type ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router";
import type { OrderOperator, PedidosOperatorView } from "../../types";
import { STAGE_LABELS, type Order } from "../domain/order";
import type { Conversation } from "../domain/conversationsDomain";
import { OrdersStore } from "../stores/OrdersStore";
import { PickupStore } from "../stores/PickupStore";
import { IncidentStore } from "../stores/IncidentStore";
import { CatalogStore } from "../stores/CatalogStore";
import { ConversationsStore } from "../stores/ConversationsStore";
import { CarriersPage } from "../pages/CarriersPage";
import { IncidentsPage } from "../pages/IncidentsPage";
import { IncidentDetailPage } from "../pages/IncidentDetailPage";
import { CatalogPage } from "../pages/CatalogPage";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { OrdersPage } from "../pages/OrdersPage";
import { ConversationsPage } from "../pages/ConversationsPage";
import { OrderDetailModal } from "./OrderDetailModal";
import { CreateOrderModal } from "./CreateOrderModal";
import { ChatDrawer } from "./conversations/ChatDrawer";
import type { SalesSection } from "../sections";
import "../styles/sales.css";

export interface SalesWorkspaceProps {
  section?: SalesSection;
  detailId?: string;
  view: PedidosOperatorView;
  isAdmin?: boolean;
  operators?: OrderOperator[];
  openSection: (section: SalesSection, id?: string) => void;
  children: ReactNode;
}

export const SalesWorkspace = observer(({
  section,
  detailId,
  view,
  isAdmin = true,
  operators = [],
  openSection,
  children,
}: SalesWorkspaceProps) => {
  const navigate = useNavigate();
  const businessId = view.business.id;
  const [ordersStore] = useState(() => new OrdersStore(businessId, view.profile));
  const [catalogStore] = useState(() => new CatalogStore(businessId, view.profile));
  const [pickupStore] = useState(() => new PickupStore(businessId));
  const [incidentStore] = useState(() => new IncidentStore(businessId));
  const [conversationsStore] = useState(
    () => new ConversationsStore(businessId, ordersStore.orders),
  );

  useEffect(() => {
    if (!view.profile) return;
    if (catalogStore.profile !== view.profile) {
      catalogStore.applyProfile(view.profile);
    }
    ordersStore.applyProfileLabels(view.profile);
  }, [view.profile, catalogStore, ordersStore]);

  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const [chatDrawerState, setChatDrawerState] = useState<{
    order?: Order | null;
    conversationId?: string | null;
  } | null>(null);
  const [createFromConv, setCreateFromConv] = useState<Conversation | null>(null);

  if (!section) return <>{children}</>;

  const previewOrder: Order | null = previewOrderId
    ? (ordersStore.byId(previewOrderId) ?? null)
    : null;

  const teamOperators =
    operators.length > 0
      ? operators.map((op) => ({ id: op.id, name: op.name, email: op.email }))
      : [{ id: view.operator.id, name: view.operator.name, email: view.operator.email }];

  const openOrderDetailByCode = (orderCode: string) => {
    const found = ordersStore.byCode(orderCode) ?? ordersStore.byId(orderCode);
    if (found) setPreviewOrderId(found.id);
  };

  const openChatForOrder = (order: Order) => {
    setPreviewOrderId(null);
    const existing = conversationsStore.byPhone(order.customerPhone);
    setChatDrawerState({ order, conversationId: existing?.id ?? null });
  };

  const openChatForPhone = (phone: string) => {
    const existing = conversationsStore.byPhone(phone);
    setChatDrawerState({ conversationId: existing?.id ?? null, order: null });
  };

  const openFullConversation = (conversationId: string) => {
    setChatDrawerState(null);
    conversationsStore.select(conversationId);
    openSection("conversations", conversationId);
  };

  const openConversationsConfig = () => {
    setChatDrawerState(null);
    navigate(`/business/app/${businessId}/pedidos/conversations?vista=config`);
  };

  const isIncidentById = Boolean(detailId && incidentStore.byId(detailId));
  const showIncidentDetail = section === "incidents" && Boolean(detailId) && !isIncidentById;
  const linkedOrderForTracking =
    showIncidentDetail && detailId
      ? (() => {
          const list = incidentStore.byTracking(detailId);
          const code = list[0]?.orderNumber;
          return code ? ordersStore.byCode(code) : undefined;
        })()
      : undefined;
  const linkedOrderStatusLabel = linkedOrderForTracking
    ? (ordersStore.columns.find((c) => c.id === linkedOrderForTracking.stage)?.label ??
      STAGE_LABELS[linkedOrderForTracking.stage] ??
      linkedOrderForTracking.stage)
    : undefined;

  return (
    <section className="sales-workspace">
      {section === "orders" && (
        <OrdersPage
          businessId={businessId}
          businessName={view.business.name}
          operatorName={view.operator.name}
          isAdmin={isAdmin}
          selected={detailId ?? ""}
          setSelected={(id) => openSection("orders", id || undefined)}
          ordersStore={ordersStore}
          incidentsStore={incidentStore}
          conversationsStore={conversationsStore}
          catalogProducts={catalogStore.products}
          stages={view.operator.stages}
          modalities={view.modalities}
          openCatalog={() => openSection("catalog")}
          openIncidents={() => openSection("incidents")}
          onOpenChat={openChatForOrder}
        />
      )}

      {section === "incidents" &&
        (showIncidentDetail && detailId ? (
          <IncidentDetailPage
            trackingNumber={detailId}
            store={incidentStore}
            hasLinkedOrder={Boolean(linkedOrderForTracking)}
            linkedOrderStatusLabel={linkedOrderStatusLabel}
            onBack={() => openSection("incidents")}
            onOpenOrderDetail={openOrderDetailByCode}
            onOpenChat={openChatForPhone}
          />
        ) : (
          <IncidentsPage
            store={incidentStore}
            activeIncidentId={isIncidentById ? detailId : undefined}
            setActiveIncidentId={(id) => openSection("incidents", id ?? undefined)}
            onOpenTracking={(tracking) => openSection("incidents", tracking)}
          />
        ))}

      {section === "carriers" && (
        <CarriersPage
          store={pickupStore}
          carrierPreferences={ordersStore.carrierPreferences}
          onUpdateCarrierPreferences={(prefs) => ordersStore.updateCarrierPreferences(prefs)}
        />
      )}

      {section === "catalog" && (
        <CatalogPage
          store={catalogStore}
          businessId={businessId}
          businessName={view.business.name}
          profile={catalogStore.profile}
        />
      )}

      {section === "conversations" && (
        <ConversationsPage
          store={conversationsStore}
          ordersStore={ordersStore}
          catalogProducts={catalogStore.products}
          businessName={view.business.name}
          currentOperatorId={view.operator.id}
          currentOperatorName={view.operator.name}
          operators={teamOperators}
          initialConversationId={detailId}
          onSelectRouteId={(id) => openSection("conversations", id)}
          onCreateOrderForContact={(conv) => setCreateFromConv(conv)}
          onOpenOrderDetail={(order) => setPreviewOrderId(order.id)}
          onOpenInOrders={(orderId) => openSection("orders", orderId)}
        />
      )}

      {section === "analytics" && (
        <AnalyticsPage
          orders={ordersStore.orders}
          enabledModalities={view.modalities}
          hasConversation={(phone) => conversationsStore.hasConversation(phone)}
          onOpenOrderDetail={(order) => setPreviewOrderId(order.id)}
          onOpenChat={openChatForOrder}
        />
      )}

      <OrderDetailModal
        open={previewOrder !== null}
        order={previewOrder}
        businessId={businessId}
        businessName={view.business.name}
        operatorName={view.operator.name}
        allowedStages={view.operator.stages}
        ordersStore={ordersStore}
        incidentsStore={incidentStore}
        conversationsStore={conversationsStore}
        onClose={() => setPreviewOrderId(null)}
        onOpenChat={openChatForOrder}
        readOnly={section === "analytics"}
      />

      <ChatDrawer
        open={chatDrawerState !== null}
        conversationId={chatDrawerState?.conversationId ?? null}
        order={chatDrawerState?.order ?? null}
        store={conversationsStore}
        ordersStore={ordersStore}
        catalogProducts={catalogStore.products}
        businessName={view.business.name}
        currentOperatorId={view.operator.id}
        currentOperatorName={view.operator.name}
        operators={teamOperators}
        onClose={() => setChatDrawerState(null)}
        onOpenFullConsole={openFullConversation}
        onOpenOrderDetail={(order) => setPreviewOrderId(order.id)}
        onOpenConfig={openConversationsConfig}
      />

      <CreateOrderModal
        open={createFromConv !== null}
        businessId={businessId}
        businessName={view.business.name}
        operatorName={view.operator.name}
        ordersStore={ordersStore}
        catalogProducts={catalogStore.products}
        modalities={view.modalities}
        initialCustomerName={createFromConv?.contact.name}
        initialCustomerPhone={createFromConv?.contact.phone}
        initialAddressStreet={createFromConv?.contact.address}
        initialChatId={createFromConv?.id}
        onSendReceiptToChat={(order, message) => {
          const conv = conversationsStore.sendOrderReceiptToChat(
            createFromConv?.id ?? order.customerPhone,
            order,
            message,
            view.operator.id,
            view.operator.name,
          );
          setCreateFromConv(null);
          openFullConversation(conv.id);
        }}
        onClose={() => setCreateFromConv(null)}
        onOpenCatalog={() => {
          setCreateFromConv(null);
          openSection("catalog");
        }}
        onGoToDetail={(order) => {
          setCreateFromConv(null);
          setPreviewOrderId(order.id);
        }}
      />
    </section>
  );
});
