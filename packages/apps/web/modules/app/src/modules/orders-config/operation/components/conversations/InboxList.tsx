import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  classifyIntention,
  formatChatListTime,
  getLastVisibleMessage,
  matchesDateFilter,
  phonesMatch,
  stripHtmlTags,
  type Conversation,
  type ConversationIntention,
  type ConversationViewTab,
  type DateFilter,
  type InboxFilter,
} from "../../domain/conversationsDomain";
import type { Order } from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";
import { BotIcon, ChannelAvatar, HeadsetIcon, WhatsAppIcon } from "./ChannelAvatar";

export interface InboxListProps {
  store: ConversationsStore;
  ordersStore: OrdersStore;
  currentOperatorId: string;
  activeView?: ConversationViewTab;
  onChangeView?: (view: ConversationViewTab) => void;
  onSelectConversation?: (id: string | null) => void;
}

const DATE_FILTER_OPTIONS: ReadonlyArray<{ value: DateFilter; label: string }> = [
  { value: "all", label: "Todas las fechas" },
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "month", label: "Este mes" },
];

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "Todas las conversaciones" },
  { value: "needs_attention", label: "Requieren atención" },
  { value: "mine", label: "Mis conversaciones" },
  { value: "unassigned", label: "Sin asignar" },
  { value: "ai_active", label: "IA activa" },
  { value: "unread", label: "Solo no leídas" },
  { value: "closed", label: "Resueltas" },
];

const INTENTION_BADGE_META: Record<
  ConversationIntention,
  { label: string; className: string }
> = {
  inquire: {
    label: "Consulta",
    className:
      "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  },
  buy: {
    label: "Venta",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  track_order: {
    label: "Seguimiento",
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  claim: {
    label: "Reclamo",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

function matchesStatusFilter(
  conv: Conversation,
  filter: InboxFilter,
  currentOperatorId: string,
): boolean {
  switch (filter) {
    case "needs_attention":
      return (
        conv.status !== "closed" &&
        (conv.needsAttention || conv.status === "waiting")
      );
    case "mine":
      return (
        conv.status !== "closed" &&
        (currentOperatorId
          ? conv.assignedOperatorId === currentOperatorId
          : Boolean(conv.assignedOperatorId))
      );
    case "unassigned":
      return conv.status !== "closed" && conv.assignedOperatorId === null;
    case "ai_active":
      return (
        conv.status !== "closed" &&
        conv.aiActive &&
        conv.attentionMode === "bot"
      );
    case "unread":
      return conv.unreadCount > 0;
    case "closed":
      return conv.status === "closed";
    case "all":
    default:
      return true;
  }
}

function getLinkedOrdersForContact(conv: Conversation, orders: Order[]): Order[] {
  return orders
    .filter(
      (order) =>
        phonesMatch(order.customerPhone, conv.contact.phone) ||
        conv.messages.some((msg) => msg.orderId === order.id),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const InboxList = observer(
  ({
    store,
    ordersStore,
    currentOperatorId,
    onSelectConversation,
  }: InboxListProps) => {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [reloading, setReloading] = useState(false);
    const filtersRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!filtersOpen) return;
      const handleOutside = (e: MouseEvent) => {
        if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
          setFiltersOpen(false);
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setFiltersOpen(false);
      };
      document.addEventListener("mousedown", handleOutside);
      window.addEventListener("keydown", handleKey);
      return () => {
        document.removeEventListener("mousedown", handleOutside);
        window.removeEventListener("keydown", handleKey);
      };
    }, [filtersOpen]);

    const baseFiltered = store.filteredConversations(currentOperatorId);
    const rawQuery = store.searchQuery.trim().toLowerCase();

    // Also allow matching contacts by WhatsApp LID
    const conversations: Conversation[] = (() => {
      if (!rawQuery) return baseFiltered;
      const seen = new Set(baseFiltered.map((c) => c.id));
      const lidMatches = store.conversations.filter(
        (conv) =>
          !seen.has(conv.id) &&
          Boolean(conv.contact.lid?.toLowerCase().includes(rawQuery)) &&
          matchesStatusFilter(conv, store.inboxFilter, currentOperatorId) &&
          matchesDateFilter(conv.lastActivityAt, store.dateFilter),
      );
      if (lidMatches.length === 0) return baseFiltered;
      return [...baseFiltered, ...lidMatches].sort(
        (a, b) =>
          b.lastActivityAt.localeCompare(a.lastActivityAt) ||
          a.id.localeCompare(b.id),
      );
    })();

    const hasActiveFilters =
      store.inboxFilter !== "all" || store.dateFilter !== "all";
    const hasSearchOrFilters =
      hasActiveFilters || store.searchQuery.trim().length > 0;

    const handleReload = () => {
      setReloading(true);
      store.reload();
      window.setTimeout(() => setReloading(false), 500);
    };

    const handleRowClick = (id: string) => {
      const nextId = store.selectedId === id ? null : id;
      store.select(nextId);
      onSelectConversation?.(nextId);
    };

    return (
      <div className="flex h-full flex-col overflow-hidden bg-white font-sans text-gray-800 dark:bg-gray-900 dark:text-white/90">
        {/* Compact inbox header: title + counts + filter/refresh + search */}
        <div className="shrink-0 border-b border-gray-100 p-3.5 pb-3 dark:border-gray-800">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                Bandeja
              </h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11px] font-bold tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {conversations.length}
              </span>
              {store.unreadTotal > 0 && (
                <span className="inline-flex h-5 items-center rounded-full bg-[#FF3F1A]/10 px-1.5 text-[10px] font-bold text-[#FF3F1A] dark:bg-[#FF3F1A]/20 dark:text-[#FF7A59]">
                  {store.unreadTotal} sin leer
                </span>
              )}
            </div>

            {/* Filters + Refresh buttons */}
            <div className="flex items-center gap-1.5">
              <div className="relative" ref={filtersRef}>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                  className={`relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-xs shadow-xs transition-colors ${
                    hasActiveFilters
                      ? "border-[#FF3F1A] bg-[#FF3F1A]/10 text-[#FF3F1A] dark:border-[#FF3F1A]/50 dark:bg-[#FF3F1A]/15 dark:text-[#FF7A59]"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                  }`}
                  title="Filtrar conversaciones"
                  aria-label="Filtrar conversaciones"
                  aria-expanded={filtersOpen}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                  {hasActiveFilters && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#FF3F1A]" />
                  )}
                </button>

                {filtersOpen && (
                  <div className="absolute right-0 z-50 mt-2 max-h-96 w-60 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-800 dark:bg-gray-900">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Filtrar por fecha
                    </div>
                    <div className="mb-2 space-y-0.5">
                      {DATE_FILTER_OPTIONS.map((opt) => {
                        const selected = store.dateFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => store.setDateFilter(opt.value)}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                              selected
                                ? "bg-[#FF3F1A]/10 font-bold text-[#FF3F1A] dark:bg-[#FF3F1A]/15 dark:text-[#FF7A59]"
                                : "font-normal text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                            }`}
                          >
                            <span>{opt.label}</span>
                            {selected && <span className="text-[11px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="border-t border-gray-100 px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-gray-800">
                      Filtrar por estado
                    </div>
                    <div className="space-y-0.5">
                      {STATUS_FILTER_OPTIONS.map((opt) => {
                        const selected = store.inboxFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => store.setInboxFilter(opt.value)}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                              selected
                                ? "bg-[#FF3F1A]/10 font-bold text-[#FF3F1A] dark:bg-[#FF3F1A]/15 dark:text-[#FF7A59]"
                                : "font-normal text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                            }`}
                          >
                            <span>{opt.label}</span>
                            {selected && <span className="text-[11px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    {hasActiveFilters && (
                      <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => {
                            store.setInboxFilter("all");
                            store.setDateFilter("all");
                            setFiltersOpen(false);
                          }}
                          className="w-full cursor-pointer py-1 text-center text-xs font-semibold text-[#FF3F1A] hover:underline"
                        >
                          Limpiar todos los filtros
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleReload}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-xs transition-colors hover:bg-gray-50 hover:text-gray-900 active:scale-95 dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                title="Recargar conversaciones"
                aria-label="Recargar conversaciones"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={reloading ? "animate-spin" : ""}
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={store.searchQuery}
              onChange={(e) => store.setSearch(e.target.value)}
              placeholder="Buscar chat, teléfono o LID..."
              className="h-9 w-full rounded-xl border border-gray-200 bg-gray-100/70 py-1.5 pl-9 pr-8 text-xs text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#FF3F1A]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF3F1A]/15 dark:border-gray-800 dark:bg-gray-800/70 dark:text-white/90 dark:placeholder:text-gray-500 dark:focus:border-[#FF3F1A]/50 dark:focus:bg-gray-800"
            />
            {store.searchQuery && (
              <button
                type="button"
                onClick={() => store.setSearch("")}
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-2.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Conversation rows list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 sm:px-2.5">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <WhatsAppIcon className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                No se encontraron conversaciones
              </p>
              {store.searchQuery.trim() ? (
                <p className="mt-1 max-w-[220px] text-[11px] text-gray-500 dark:text-gray-400">
                  Ningún chat coincide con &ldquo;{store.searchQuery}&rdquo;.
                </p>
              ) : (
                <p className="mt-1 max-w-[220px] text-[11px] text-gray-500 dark:text-gray-400">
                  Ajusta tus filtros o restaura las conversaciones de demostración.
                </p>
              )}

              {hasSearchOrFilters && (
                <button
                  type="button"
                  onClick={() => store.clearFilters()}
                  className="mt-3 cursor-pointer text-xs font-semibold text-[#FF3F1A] hover:underline"
                >
                  Limpiar todos los filtros
                </button>
              )}

              <button
                type="button"
                onClick={() => store.resetDemo(ordersStore.orders)}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#FF3F1A] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#e5351a] active:scale-95"
              >
                Restaurar conversaciones demo
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isSelected = store.selectedId === conv.id;
                const linkedOrders = getLinkedOrdersForContact(
                  conv,
                  ordersStore.orders,
                );
                const activeOrder = linkedOrders.find(
                  (order) =>
                    order.stage !== "delivered" && order.stage !== "cancelled",
                );
                const intention = classifyIntention(conv, linkedOrders);
                const intentionMeta = INTENTION_BADGE_META[intention];
                const lastMessage = getLastVisibleMessage(conv);
                const previewText = lastMessage
                  ? stripHtmlTags(lastMessage.text)
                  : "Sin mensajes";
                const formattedTime = formatChatListTime(conv.lastActivityAt);
                const showWaitingBadge =
                  conv.status === "waiting" ||
                  (conv.needsAttention && conv.status !== "closed");

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleRowClick(conv.id)}
                    className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[#FF3F1A]/10 dark:bg-[#FF3F1A]/15"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    }`}
                  >
                    <ChannelAvatar
                      name={conv.contact.name}
                      channel={conv.channel}
                      avatarColor={conv.contact.avatarColor}
                      size="md"
                      online={
                        conv.status === "open" || conv.status === "attended"
                      }
                    />

                    <div className="min-w-0 flex-1">
                      {/* Row 1: Name + star + order chip + intention + waiting + time */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-1">
                          <span
                            className={`inline-flex max-w-[140px] items-center gap-1 truncate text-xs font-bold ${
                              isSelected
                                ? "text-[#FF3F1A] dark:text-[#FF7A59]"
                                : "text-gray-900 dark:text-white/95"
                            }`}
                          >
                            <span className="truncate">{conv.contact.name}</span>
                            {conv.starred && (
                              <span
                                className="shrink-0 text-amber-500"
                                title="Conversación destacada"
                              >
                                ★
                              </span>
                            )}
                          </span>

                          {activeOrder && (
                            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                              #{activeOrder.code}
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${intentionMeta.className}`}
                          >
                            {intentionMeta.label}
                          </span>

                          {showWaitingBadge && (
                            <span
                              className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                              title="Requiere atención de un asesor"
                            >
                              En espera
                            </span>
                          )}
                        </div>

                        <span className="shrink-0 pt-0.5 text-[11px] font-normal tabular-nums text-gray-400 dark:text-gray-500">
                          {formattedTime}
                        </span>
                      </div>

                      {/* Row 2: Sender pill + phone + last visible message + unread pill */}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                          {lastMessage?.author === "bot" && (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              title="Último mensaje enviado por el Bot IA"
                            >
                              <BotIcon className="h-2.5 w-2.5" />
                              <span>Bot</span>
                            </span>
                          )}
                          {lastMessage?.author === "agent" && (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#FF3F1A]/15 px-1 py-0.5 text-[10px] font-semibold text-[#FF3F1A] dark:bg-[#FF3F1A]/20 dark:text-[#FF7A59]"
                              title="Último mensaje enviado por un operador"
                            >
                              <HeadsetIcon className="h-2.5 w-2.5" />
                              <span>Operador</span>
                            </span>
                          )}
                          <span className="truncate">
                            {conv.contact.phone
                              ? `${conv.contact.phone} · `
                              : ""}
                            {previewText}
                          </span>
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#FF3F1A] px-1 text-[10px] font-bold text-white shadow-xs">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  },
);

export default InboxList;
