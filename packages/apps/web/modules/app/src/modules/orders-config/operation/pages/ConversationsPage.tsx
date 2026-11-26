import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useSearchParams } from "react-router";
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ClockIcon,
  Cog6ToothIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { PageMeta } from "@/shell/meta";
import type { CatalogProduct } from "../domain/catalogDomain";
import type { Conversation, ConversationViewTab } from "../domain/conversationsDomain";
import type { Order } from "../domain/order";
import type { ConversationsStore } from "../stores/ConversationsStore";
import type { OrdersStore } from "../stores/OrdersStore";
import { InboxList } from "../components/conversations/InboxList";
import { ChatPanel } from "../components/conversations/ChatPanel";
import { ChatComposer } from "../components/conversations/ChatComposer";
import { OrderContextPanel } from "../components/conversations/OrderContextPanel";
import { ChatDrawer } from "../components/conversations/ChatDrawer";
import { PipelineBoardView } from "../components/conversations/PipelineBoardView";
import { SupportHistoryView } from "../components/conversations/SupportHistoryView";
import { ConversationsAnalyticsView } from "../components/conversations/ConversationsAnalyticsView";
import { ChannelConfigView } from "../components/conversations/ChannelConfigView";

export interface ConversationsPageProps {
  store: ConversationsStore;
  ordersStore: OrdersStore;
  catalogProducts: CatalogProduct[];
  businessName: string;
  currentOperatorId: string;
  currentOperatorName: string;
  operators: Array<{ id: string; name: string; email?: string }>;
  initialConversationId?: string;
  onSelectRouteId?: (id: string | undefined) => void;
  onCreateOrderForContact?: (conv: Conversation) => void;
  onOpenOrderDetail?: (order: Order) => void;
  onOpenInOrders?: (orderId: string) => void;
}

const VIEW_TABS: Array<{
  id: ConversationViewTab;
  label: string;
  query: string;
  Icon: typeof ChatBubbleLeftRightIcon;
}> = [
  { id: "chats", label: "Chat en vivo", query: "chats", Icon: ChatBubbleLeftRightIcon },
  { id: "pipeline", label: "Seguimiento", query: "seguimiento", Icon: ViewColumnsIcon },
  { id: "history", label: "Historial", query: "historial", Icon: ClockIcon },
  { id: "analytics", label: "Analítica", query: "analitica", Icon: ChartBarIcon },
  { id: "config", label: "Configuración", query: "config", Icon: Cog6ToothIcon },
];

function parseViewParam(raw: string | null): ConversationViewTab {
  if (raw === "seguimiento" || raw === "pipeline") return "pipeline";
  if (raw === "historial" || raw === "history") return "history";
  if (raw === "analitica" || raw === "analytics") return "analytics";
  if (raw === "config" || raw === "configuracion") return "config";
  return "chats";
}

export const ConversationsPage = observer(({
  store,
  ordersStore,
  catalogProducts,
  businessName,
  currentOperatorId,
  currentOperatorName,
  operators,
  initialConversationId,
  onSelectRouteId,
  onCreateOrderForContact,
  onOpenOrderDetail,
  onOpenInOrders,
}: ConversationsPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = parseViewParam(searchParams.get("vista"));

  const [inboxOpen, setInboxOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatTab, setChatTab] = useState<"conversation" | "orders">("conversation");
  const [pipelineDrawerConvId, setPipelineDrawerConvId] = useState<string | null>(null);

  // Sync URL conversation ID only on initial mount or genuine external prop changes
  const initialMountSyncedRef = useRef(false);
  const lastAppliedRouteIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!initialMountSyncedRef.current) {
      initialMountSyncedRef.current = true;
      const queryId = searchParams.get("id") || searchParams.get("chatId");
      const targetId = initialConversationId || queryId || undefined;
      lastAppliedRouteIdRef.current = targetId;
      if (targetId && store.byId(targetId)) {
        store.select(targetId);
      }
      return;
    }

    if (initialConversationId !== lastAppliedRouteIdRef.current) {
      lastAppliedRouteIdRef.current = initialConversationId;
      if (initialConversationId && store.byId(initialConversationId)) {
        store.select(initialConversationId);
      }
    }
    // Intentionally omit searchParams after initial mount so view switching or deselect never re-selects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId, store]);

  // Reset chat sub-tab when switching conversations
  useEffect(() => {
    setChatTab("conversation");
  }, [store.selectedId]);

  const setView = (nextView: ConversationViewTab) => {
    const next = new URLSearchParams(searchParams);
    const tab = VIEW_TABS.find((item) => item.id === nextView);
    if (!tab || tab.id === "chats") {
      next.delete("vista");
    } else {
      next.set("vista", tab.query);
    }
    setSearchParams(next, { replace: true });
    if (nextView !== "pipeline") setPipelineDrawerConvId(null);
  };

  // Single route/state transition (never call setSearchParams and navigate in the same tick)
  const openInLiveConsole = (convId: string) => {
    store.select(convId);
    lastAppliedRouteIdRef.current = convId;
    setPipelineDrawerConvId(null);
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setInboxOpen(false);
    }
    if (onSelectRouteId) {
      onSelectRouteId(convId);
    } else {
      setView("chats");
    }
  };

  const handleSelectFromInbox = (id: string | null) => {
    const routeId = id ?? undefined;
    lastAppliedRouteIdRef.current = routeId;
    onSelectRouteId?.(routeId);
    if (id && typeof window !== "undefined" && window.innerWidth < 640) {
      setInboxOpen(false);
    }
  };

  const selected = store.selectedConversation ?? null;

  const handleSendQuickTemplate = (text: string) => {
    if (!selected || selected.status === "closed") return;
    if (!store.channelConfig.whatsappConnected) return;
    store.sendAgentMessage(selected.id, text, currentOperatorId, currentOperatorName);
  };

  const handleSwitchToOrdersTab = () => {
    setChatTab("orders");
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setInfoOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageMeta
        title={`Necto · Conversaciones (${VIEW_TABS.find((t) => t.id === activeView)?.label ?? "Chat en vivo"})`}
      />

      {/* Single clean top sub-navigation bar for all 5 Conversations views */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-xs dark:border-white/10 dark:bg-gray-900/80">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              Conversaciones
            </h1>
            {store.needsAttentionCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                {store.needsAttentionCount} en espera
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                store.channelConfig.masterAutoReply
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  store.channelConfig.masterAutoReply ? "bg-emerald-500" : "bg-gray-400"
                }`}
              />
              {store.channelConfig.masterAutoReply
                ? "Asistente IA activo"
                : "Asistente IA pausado"}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Atención omnicanal, seguimiento comercial, historial, analítica y configuración del asistente.
          </p>
        </div>

        <nav
          aria-label="Vistas de Conversaciones"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5"
        >
          {VIEW_TABS.map(({ id, label, Icon }) => {
            const isActive = activeView === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
                {id === "chats" && store.unreadTotal > 0 && (
                  <span className="ml-0.5 rounded-full bg-[#FF3F1A] px-1.5 py-0.2 text-[10px] font-bold tabular-nums text-white">
                    {store.unreadTotal}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* View 1: Live 2/3-Pane Console */}
      {activeView === "chats" && (
        <div className="relative flex h-[calc(100vh-14.5rem)] min-h-[560px] overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
          {inboxOpen && (
            <div className="flex min-h-0 w-full shrink-0 flex-col border-r border-gray-200/80 dark:border-white/10 sm:w-[320px] xl:w-[350px]">
              <InboxList
                store={store}
                ordersStore={ordersStore}
                currentOperatorId={currentOperatorId}
                onSelectConversation={handleSelectFromInbox}
              />
            </div>
          )}

          <div
            className={`min-h-0 min-w-0 flex-1 flex-col ${
              inboxOpen ? "hidden sm:flex" : "flex"
            }`}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ChatPanel
                conversationId={store.selectedId}
                store={store}
                ordersStore={ordersStore}
                businessName={businessName}
                currentOperatorId={currentOperatorId}
                currentOperatorName={currentOperatorName}
                operators={operators}
                inboxOpen={inboxOpen}
                infoOpen={infoOpen}
                activeTab={chatTab}
                onActiveTabChange={setChatTab}
                onToggleInbox={() => setInboxOpen((prev) => !prev)}
                onToggleInfo={() => setInfoOpen((prev) => !prev)}
                onCreateOrder={(conv) => onCreateOrderForContact?.(conv)}
                onOpenOrderDetail={onOpenOrderDetail}
                onOpenInOrders={onOpenInOrders}
              />
            </div>

            {selected && (
              <ChatComposer
                conversation={selected}
                store={store}
                ordersStore={ordersStore}
                catalogProducts={catalogProducts}
                currentOperatorId={currentOperatorId}
                currentOperatorName={currentOperatorName}
                onOpenConfig={() => setView("config")}
              />
            )}
          </div>

          {/* Docked context panel on lg+ screens */}
          {infoOpen && selected && (
            <div className="custom-scrollbar hidden min-h-0 w-72 shrink-0 overflow-y-auto border-l border-gray-200/80 dark:border-white/10 lg:flex lg:flex-col 2xl:w-80">
              <OrderContextPanel
                conversation={selected}
                store={store}
                ordersStore={ordersStore}
                onCreateOrder={(conv) => onCreateOrderForContact?.(conv)}
                onOpenOrderDetail={onOpenOrderDetail}
                onSendTemplate={handleSendQuickTemplate}
                onSwitchToOrdersTab={handleSwitchToOrdersTab}
                onClose={() => setInfoOpen(false)}
              />
            </div>
          )}

          {/* Slide-over overlay context panel on < lg screens */}
          {infoOpen && selected && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Contexto de ${selected.contact.name}`}
              className="fixed inset-0 z-50 flex justify-end lg:hidden"
            >
              <div
                aria-hidden="true"
                onClick={() => setInfoOpen(false)}
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
              />
              <div className="relative z-10 flex h-full w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                <OrderContextPanel
                  conversation={selected}
                  store={store}
                  ordersStore={ordersStore}
                  onCreateOrder={(conv) => {
                    setInfoOpen(false);
                    onCreateOrderForContact?.(conv);
                  }}
                  onOpenOrderDetail={(order) => {
                    setInfoOpen(false);
                    onOpenOrderDetail?.(order);
                  }}
                  onSendTemplate={handleSendQuickTemplate}
                  onSwitchToOrdersTab={handleSwitchToOrdersTab}
                  onClose={() => setInfoOpen(false)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* View 2: Seguimiento Pipeline Kanban */}
      {activeView === "pipeline" && (
        <>
          <PipelineBoardView
            store={store}
            ordersStore={ordersStore}
            onOpenChatDrawer={(convId) => setPipelineDrawerConvId(convId)}
            onOpenFullConsole={openInLiveConsole}
            onCreateOrder={(conv) => onCreateOrderForContact?.(conv)}
          />
          <ChatDrawer
            open={pipelineDrawerConvId !== null}
            conversationId={pipelineDrawerConvId}
            store={store}
            ordersStore={ordersStore}
            catalogProducts={catalogProducts}
            businessName={businessName}
            currentOperatorId={currentOperatorId}
            currentOperatorName={currentOperatorName}
            operators={operators}
            onClose={() => setPipelineDrawerConvId(null)}
            onOpenFullConsole={openInLiveConsole}
            onOpenOrderDetail={onOpenOrderDetail}
            onOpenConfig={() => {
              setPipelineDrawerConvId(null);
              setView("config");
            }}
          />
        </>
      )}

      {/* View 3: Historial de atención */}
      {activeView === "history" && (
        <SupportHistoryView
          store={store}
          ordersStore={ordersStore}
          currentOperatorName={currentOperatorName}
          onOpenConversation={openInLiveConsole}
        />
      )}

      {/* View 4: Analítica de conversaciones */}
      {activeView === "analytics" && (
        <ConversationsAnalyticsView
          store={store}
          ordersStore={ordersStore}
          onOpenConversation={openInLiveConsole}
        />
      )}

      {/* View 5: Configuración de canal y asistente IA */}
      {activeView === "config" && (
        <ChannelConfigView
          store={store}
          ordersStore={ordersStore}
          catalogProducts={catalogProducts}
          businessName={businessName}
        />
      )}
    </div>
  );
});
