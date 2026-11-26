import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CpuChipIcon,
  EyeIcon,
  InboxStackIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { cn } from "@/utils";
import {
  CHANNEL_LABELS,
  classifyIntention,
  CRM_STAGES,
  formatHour,
  formatRelativeTime,
  getInitials,
  getLastVisibleMessage,
  INTENTION_META,
  phonesMatch,
  STATUS_META,
  stripHtmlTags,
  type Conversation,
  type ConversationChannel,
  type ConversationIntention,
  type ConversationStatus,
  type CrmStageId,
} from "../../domain/conversationsDomain";
import { formatCOP, STAGE_LABELS, type Order } from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";
import { Modal } from "../Dialog";

export interface SupportHistoryViewProps {
  store: ConversationsStore;
  ordersStore: OrdersStore;
  currentOperatorName: string;
  onOpenConversation: (conversationId: string) => void;
}

type HistoryTab = "all" | "pending" | "in_progress" | "resolved";
type SortColumn = "id" | "contact" | "date";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 10;

const HISTORY_TABS: Array<{ id: HistoryTab; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "pending", label: "Pendientes" },
  { id: "in_progress", label: "En curso" },
  { id: "resolved", label: "Resueltas" },
];

const CHANNEL_BADGE_STYLES: Record<
  ConversationChannel,
  { badge: string; dot: string }
> = {
  whatsapp: {
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    dot: "bg-[#25D366]",
  },
  instagram: {
    badge:
      "bg-pink-50 text-pink-700 border-pink-200/80 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
    dot: "bg-[#E1306C]",
  },
  messenger: {
    badge:
      "bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    dot: "bg-[#0084FF]",
  },
  tiktok: {
    badge:
      "bg-gray-100 text-gray-800 border-gray-200/80 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700",
    dot: "bg-gray-900 dark:bg-white",
  },
  telegram: {
    badge:
      "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
    dot: "bg-[#229ED9]",
  },
};

const STATUS_BADGE_STYLES: Record<ConversationStatus, string> = {
  open: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  waiting: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  attended:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const INTENTION_BADGE_STYLES: Record<ConversationIntention, string> = {
  inquire: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  buy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  track_order: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  claim: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatTicketCode(convId: string): string {
  const digits = convId.match(/(\d+)\s*$/)?.[1];
  if (!digits) return `#${convId.slice(0, 8).toUpperCase()}`;
  return `#TCK-${digits.padStart(3, "0")}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function getLinkedOrders(conv: Conversation, orders: Order[]): Order[] {
  return orders
    .filter(
      (order) =>
        phonesMatch(order.customerPhone, conv.contact.phone) ||
        conv.messages.some((msg) => msg.orderId === order.id),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function matchesTab(conv: Conversation, tab: HistoryTab): boolean {
  switch (tab) {
    case "resolved":
      return conv.status === "closed";
    case "pending":
      return conv.status !== "closed" && (conv.status === "waiting" || conv.needsAttention);
    case "in_progress":
      return conv.status !== "closed" && conv.status !== "waiting" && !conv.needsAttention;
    case "all":
    default:
      return true;
  }
}

export const SupportHistoryView = observer(
  ({
    store,
    ordersStore,
    currentOperatorName,
    onOpenConversation,
  }: SupportHistoryViewProps) => {
    const [activeTab, setActiveTab] = useState<HistoryTab>("all");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState<{
      column: SortColumn;
      dir: SortDirection;
    }>({ column: "date", dir: "desc" });
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [detailConvId, setDetailConvId] = useState<string | null>(null);

    const stats = store.ticketStats;
    const query = normalizeSearch(search);
    const queryDigits = search.replace(/\D/g, "");

    const filteredRows = store.conversations
      .filter((conv) => {
        if (!matchesTab(conv, activeTab)) return false;
        if (!query) return true;

        const ticketCode = formatTicketCode(conv.id);
        const lastMsg = getLastVisibleMessage(conv);
        const lastText = lastMsg ? stripHtmlTags(lastMsg.text) : "";

        const matchId =
          normalizeSearch(conv.id).includes(query) ||
          normalizeSearch(ticketCode).includes(query);
        const matchName = normalizeSearch(conv.contact.name).includes(query);
        const matchPhone =
          normalizeSearch(conv.contact.phone).includes(query) ||
          (queryDigits.length >= 3 &&
            conv.contact.phone.replace(/\D/g, "").includes(queryDigits));
        const matchMessage = normalizeSearch(lastText).includes(query);

        return matchId || matchName || matchPhone || matchMessage;
      })
      .slice()
      .sort((a, b) => {
        const sign = sort.dir === "asc" ? 1 : -1;
        switch (sort.column) {
          case "id":
            return formatTicketCode(a.id).localeCompare(formatTicketCode(b.id)) * sign;
          case "contact":
            return a.contact.name.localeCompare(b.contact.name, "es") * sign;
          case "date":
          default:
            return a.lastActivityAt.localeCompare(b.lastActivityAt) * sign;
        }
      });

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

    useEffect(() => {
      if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const startIdx = (page - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(startIdx, startIdx + PAGE_SIZE);
    const fromCount = filteredRows.length === 0 ? 0 : startIdx + 1;
    const toCount = Math.min(startIdx + PAGE_SIZE, filteredRows.length);

    const allPageSelected =
      pageRows.length > 0 && pageRows.every((conv) => selectedIds.has(conv.id));

    const toggleAllPage = () => {
      const next = new Set(selectedIds);
      if (allPageSelected) {
        for (const conv of pageRows) next.delete(conv.id);
      } else {
        for (const conv of pageRows) next.add(conv.id);
      }
      setSelectedIds(next);
    };

    const toggleOne = (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
    };

    const handleSort = (column: SortColumn) => {
      setSort((prev) =>
        prev.column === column
          ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
          : { column, dir: column === "date" ? "desc" : "asc" },
      );
    };

    const renderSortArrow = (column: SortColumn) => {
      if (sort.column !== column) {
        return <span className="ml-1 text-[10px] opacity-35">↕</span>;
      }
      return (
        <span className="ml-1 text-[10px] text-brand-600 dark:text-brand-400">
          {sort.dir === "asc" ? "▲" : "▼"}
        </span>
      );
    };

    const handleBulkResolve = () => {
      for (const id of selectedIds) {
        const conv = store.byId(id);
        if (conv && conv.status !== "closed") {
          store.closeConversation(id, currentOperatorName);
        }
      }
      setSelectedIds(new Set());
    };

    const detailConv = detailConvId ? store.byId(detailConvId) : undefined;
    const detailLinkedOrders = detailConv
      ? getLinkedOrders(detailConv, ordersStore.orders)
      : [];
    const detailActiveOrder =
      detailLinkedOrders.find((o) => o.stage !== "cancelled") ??
      detailLinkedOrders[0];
    const detailCrmStage: CrmStageId | null = detailConv
      ? store.effectiveCrmStage(detailConv, detailLinkedOrders)
      : null;
    const detailCrmIsManual = detailConv
      ? store.isCrmManual(detailConv.id)
      : false;
    const detailLastMessages = detailConv
      ? detailConv.messages.filter((m) => !m.isInternalNote).slice(-5)
      : [];

    const kpiCards: Array<{
      id: HistoryTab;
      label: string;
      value: number;
      icon: React.ReactNode;
      toneClass: string;
    }> = [
      {
        id: "all",
        label: "Total conversaciones",
        value: stats.total,
        icon: <InboxStackIcon className="h-5 w-5" />,
        toneClass:
          "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
      },
      {
        id: "pending",
        label: "Pendientes",
        value: stats.pending,
        icon: <ClockIcon className="h-5 w-5" />,
        toneClass:
          "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      },
      {
        id: "in_progress",
        label: "En curso",
        value: stats.inProgress,
        icon: <SparklesIcon className="h-5 w-5" />,
        toneClass:
          "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
      },
      {
        id: "resolved",
        label: "Resueltas",
        value: stats.resolved,
        icon: <CheckCircleIcon className="h-5 w-5" />,
        toneClass:
          "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      },
    ];

    return (
      <div className="space-y-5">
        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((kpi) => {
            const isSelected = activeTab === kpi.id;
            return (
              <button
                key={kpi.id}
                type="button"
                onClick={() => {
                  setActiveTab(kpi.id);
                  setPage(1);
                }}
                className="text-left"
              >
                <Card
                  className={cn(
                    "p-4 transition-all hover:shadow-md",
                    isSelected &&
                      "border-brand-500/60 ring-2 ring-brand-500/15 dark:border-brand-400/60",
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        kpi.toneClass,
                      )}
                    >
                      {kpi.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                        {kpi.label}
                      </p>
                      <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
                        {kpi.value}
                      </p>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>

        {/* Main Table Card */}
        <Card className="overflow-hidden p-0 sm:p-0">
          {/* Header: Filter Tabs + Search + Result Count */}
          <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-1.5">
              {HISTORY_TABS.map((tab) => {
                const active = activeTab === tab.id;
                const count =
                  tab.id === "all"
                    ? stats.total
                    : tab.id === "pending"
                      ? stats.pending
                      : tab.id === "in_progress"
                        ? stats.inProgress
                        : stats.resolved;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-brand-500 text-white shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200/80 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px]",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-400",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar ID, cliente, teléfono o mensaje..."
                  aria-label="Buscar en historial de atención"
                  className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-9 pr-3 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-gray-100 px-2.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {filteredRows.length}{" "}
                {filteredRows.length === 1 ? "resultado" : "resultados"}
              </span>
            </div>
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200/70 bg-brand-50/70 px-4 py-2.5 dark:border-brand-500/30 dark:bg-brand-950/30">
              <span className="text-xs font-semibold text-brand-800 dark:text-brand-200">
                {selectedIds.size}{" "}
                {selectedIds.size === 1
                  ? "conversación seleccionada"
                  : "conversaciones seleccionadas"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpiar selección
                </Button>
                <Button
                  size="sm"
                  startIcon={<CheckCircleIcon className="h-4 w-4" />}
                  onClick={handleBulkResolve}
                >
                  Marcar resueltas
                </Button>
              </div>
            </div>
          )}

          {/* Table Content */}
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <InboxStackIcon className="h-10 w-10 text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                No se encontraron conversaciones
              </p>
              <p className="max-w-sm text-xs text-gray-500 dark:text-gray-400">
                {search.trim()
                  ? "Prueba con otro término de búsqueda o limpia los filtros activos."
                  : "No hay registros en esta categoría por el momento."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAllPage}
                        aria-label="Seleccionar todas las conversaciones de la página"
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                    </th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort("id")}
                        className="inline-flex items-center uppercase hover:text-gray-800 dark:hover:text-white"
                      >
                        ID {renderSortArrow("id")}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort("contact")}
                        className="inline-flex items-center uppercase hover:text-gray-800 dark:hover:text-white"
                      >
                        Cliente {renderSortArrow("contact")}
                      </button>
                    </th>
                    <th className="px-3 py-3">Canal</th>
                    <th className="px-3 py-3">Asunto</th>
                    <th className="px-3 py-3">Etapa CRM</th>
                    <th className="px-3 py-3">Intención</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Atención</th>
                    <th className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort("date")}
                        className="inline-flex items-center uppercase hover:text-gray-800 dark:hover:text-white"
                      >
                        Última actividad {renderSortArrow("date")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {pageRows.map((conv) => {
                    const linkedOrders = getLinkedOrders(conv, ordersStore.orders);
                    const intention = classifyIntention(conv, linkedOrders);
                    const crmStageId = store.effectiveCrmStage(conv, linkedOrders);
                    const crmStageMeta =
                      CRM_STAGES.find((s) => s.id === crmStageId) ?? CRM_STAGES[0];
                    const crmIsManual = store.isCrmManual(conv.id);
                    const lastMsg = getLastVisibleMessage(conv);
                    const subjectText = lastMsg
                      ? stripHtmlTags(lastMsg.text)
                      : "Sin mensajes";
                    const channelStyle = CHANNEL_BADGE_STYLES[conv.channel];
                    const statusMeta = STATUS_META[conv.status];
                    const isChecked = selectedIds.has(conv.id);

                    return (
                      <tr
                        key={conv.id}
                        onClick={() => setDetailConvId(conv.id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.03]",
                          isChecked && "bg-brand-50/30 dark:bg-brand-500/5",
                        )}
                      >
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(conv.id)}
                            aria-label={`Seleccionar ${conv.contact.name}`}
                            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                          />
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">
                          {formatTicketCode(conv.id)}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ backgroundColor: conv.contact.avatarColor }}
                            >
                              {getInitials(conv.contact.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900 dark:text-white">
                                {conv.contact.name}
                              </p>
                              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                                {conv.contact.phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                              channelStyle.badge,
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", channelStyle.dot)}
                            />
                            {CHANNEL_LABELS[conv.channel]}
                          </span>
                        </td>

                        <td className="max-w-[220px] px-3 py-3">
                          <p
                            title={subjectText}
                            className="truncate text-xs text-gray-600 dark:text-gray-300"
                          >
                            {subjectText}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: `${crmStageMeta.color}18`,
                              color: crmStageMeta.color,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: crmStageMeta.color }}
                            />
                            <span>{crmStageMeta.label}</span>
                            {crmIsManual && (
                              <span
                                className="text-[9px] font-bold opacity-80"
                                title="Etapa CRM ajustada manualmente"
                              >
                                •M
                              </span>
                            )}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              INTENTION_BADGE_STYLES[intention],
                            )}
                          >
                            {INTENTION_META[intention].label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              STATUS_BADGE_STYLES[conv.status],
                            )}
                          >
                            {statusMeta.label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-3">
                          {conv.attentionMode === "human" ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-200">
                              <UserIcon className="h-3.5 w-3.5 text-brand-500" />
                              {conv.assignedOperatorName ?? "Asesor humano"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                              <CpuChipIcon className="h-3.5 w-3.5" />
                              Bot IA
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">
                          <div className="font-medium">
                            {formatShortDate(conv.lastActivityAt)}
                          </div>
                          <div className="text-[11px] text-gray-400 dark:text-gray-500">
                            {formatRelativeTime(conv.lastActivityAt)}
                          </div>
                        </td>

                        <td
                          className="whitespace-nowrap px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            {conv.status !== "closed" && (
                              <button
                                type="button"
                                onClick={() =>
                                  store.closeConversation(
                                    conv.id,
                                    currentOperatorName,
                                  )
                                }
                                title="Marcar como resuelta"
                                aria-label={`Marcar como resuelta la conversación con ${conv.contact.name}`}
                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white"
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetailConvId(conv.id)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              Ver detalle
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenConversation(conv.id)}
                              title="Ir al chat en vivo"
                              aria-label={`Abrir chat con ${conv.contact.name}`}
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-brand-400"
                            >
                              <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {filteredRows.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Mostrando <strong className="text-gray-800 dark:text-gray-200">{fromCount}</strong> a{" "}
                <strong className="text-gray-800 dark:text-gray-200">{toCount}</strong> de{" "}
                <strong className="text-gray-800 dark:text-gray-200">{filteredRows.length}</strong>{" "}
                conversaciones
              </p>

              <nav
                aria-label="Paginación del historial"
                className="flex items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Página anterior"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                  (num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      aria-current={num === page ? "page" : undefined}
                      className={cn(
                        "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors",
                        num === page
                          ? "bg-brand-500 text-white shadow-xs"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5",
                      )}
                    >
                      {num}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Página siguiente"
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Siguiente
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </nav>
            </div>
          )}
        </Card>

        {/* Ticket Detail Modal */}
        <Modal
          isOpen={Boolean(detailConv)}
          onClose={() => setDetailConvId(null)}
          label="Detalle de conversación"
          className="w-[min(94vw,44rem)] p-0"
        >
          {detailConv && (
            <div className="flex flex-col">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: detailConv.contact.avatarColor }}
                  >
                    {getInitials(detailConv.contact.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-gray-900 dark:text-white">
                        {detailConv.contact.name}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-brand-600 dark:text-brand-400">
                        {formatTicketCode(detailConv.id)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {detailConv.contact.phone}
                      {detailConv.contact.address
                        ? ` · ${detailConv.contact.address}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      CHANNEL_BADGE_STYLES[detailConv.channel].badge,
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        CHANNEL_BADGE_STYLES[detailConv.channel].dot,
                      )}
                    />
                    {CHANNEL_LABELS[detailConv.channel]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      STATUS_BADGE_STYLES[detailConv.status],
                    )}
                  >
                    {STATUS_META[detailConv.status].label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailConvId(null)}
                    aria-label="Cerrar modal"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="space-y-5 px-6 py-5">
                {/* Summary metadata */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Atención
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {detailConv.attentionMode === "human"
                        ? detailConv.assignedOperatorName ?? "Asesor humano"
                        : "Bot IA"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Intención
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {
                        INTENTION_META[
                          classifyIntention(detailConv, detailLinkedOrders)
                        ].label
                      }
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Última actividad
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {formatRelativeTime(detailConv.lastActivityAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Mensajes totales
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {detailConv.messages.filter((m) => !m.isInternalNote).length}
                    </p>
                  </div>
                </div>

                {/* CRM 5-Stage Progress Stepper (real CRM stages) */}
                <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Etapa CRM
                    </span>
                    <div className="flex items-center gap-2">
                      {detailCrmStage && (
                        <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                          {CRM_STAGES.find((s) => s.id === detailCrmStage)
                            ?.label ?? ""}
                        </span>
                      )}
                      {detailCrmIsManual && (
                        <button
                          type="button"
                          onClick={() =>
                            store.resetCrmStageOverride(detailConv.id)
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25"
                        >
                          <ArrowPathIcon className="h-3 w-3" />
                          <span>Manual (restablecer)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {CRM_STAGES.map((stage, idx) => {
                      const activeIndex = CRM_STAGES.findIndex(
                        (s) => s.id === detailCrmStage,
                      );
                      const isLost = detailCrmStage === "lost";
                      const isActive = activeIndex === idx;
                      const isCompleted = !isLost && activeIndex > idx;

                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() =>
                            store.setCrmStageOverride(detailConv.id, stage.id)
                          }
                          title={`Establecer etapa CRM: ${stage.label}`}
                          className="group flex cursor-pointer flex-col items-center gap-1.5 text-center"
                        >
                          <div className="flex w-full items-center">
                            <div
                              className={cn(
                                "h-1.5 flex-1 rounded-full transition-colors",
                                isActive
                                  ? stage.id === "lost"
                                    ? "bg-red-500"
                                    : "bg-brand-500"
                                  : isCompleted
                                    ? "bg-emerald-500"
                                    : "bg-gray-200 dark:bg-gray-700",
                              )}
                            />
                          </div>
                          <span
                            className={cn(
                              "line-clamp-2 text-[10px] leading-tight transition-colors",
                              isActive
                                ? stage.id === "lost"
                                  ? "font-bold text-red-600 dark:text-red-400"
                                  : "font-bold text-gray-900 dark:text-white"
                                : isCompleted
                                  ? "font-medium text-gray-700 dark:text-gray-300"
                                  : "text-gray-400 group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-300",
                            )}
                          >
                            {stage.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Linked Order Summary */}
                {detailActiveOrder && (
                  <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                          <ShoppingBagIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Pedido #{detailActiveOrder.code} ·{" "}
                            {formatCOP(detailActiveOrder.total)}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {detailActiveOrder.items.length}{" "}
                            {detailActiveOrder.items.length === 1
                              ? "producto"
                              : "productos"}{" "}
                            ·{" "}
                            {STAGE_LABELS[detailActiveOrder.stage] ??
                              detailActiveOrder.stage}
                            {detailActiveOrder.carrier &&
                            detailActiveOrder.trackingNumber
                              ? ` · ${detailActiveOrder.carrier} (${detailActiveOrder.trackingNumber})`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          detailActiveOrder.paid
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                        )}
                      >
                        {detailActiveOrder.paid ? "Pagado" : "Pago pendiente"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Last 5 Messages Preview */}
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Últimos mensajes ({detailLastMessages.length})
                  </h4>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-gray-200/80 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    {detailLastMessages.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">
                        Sin mensajes registrados en esta conversación.
                      </p>
                    ) : (
                      detailLastMessages.map((msg) => {
                        const isCustomer = msg.author === "customer";
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex flex-col",
                              isCustomer ? "items-start" : "items-end",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                                isCustomer
                                  ? "border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  : msg.author === "bot"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-brand-500 text-white",
                              )}
                            >
                              <div className="mb-0.5 flex items-center justify-between gap-3 text-[10px] opacity-80">
                                <span className="font-semibold">
                                  {isCustomer
                                    ? detailConv.contact.name
                                    : msg.author === "bot"
                                      ? "Bot IA"
                                      : msg.authorName ?? "Asesor"}
                                </span>
                                <span>{formatHour(msg.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-line">
                                {stripHtmlTags(msg.text)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailConvId(null)}
                >
                  Cerrar
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  {detailConv.status !== "closed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      startIcon={<CheckCircleIcon className="h-4 w-4" />}
                      onClick={() => {
                        store.closeConversation(
                          detailConv.id,
                          currentOperatorName,
                        );
                      }}
                    >
                      Marcar como resuelta
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      startIcon={<ArrowPathIcon className="h-4 w-4" />}
                      onClick={() => {
                        store.reopenConversation(detailConv.id);
                      }}
                    >
                      Reabrir
                    </Button>
                  )}

                  <Button
                    size="sm"
                    startIcon={<ChatBubbleLeftRightIcon className="h-4 w-4" />}
                    onClick={() => {
                      const targetId = detailConv.id;
                      setDetailConvId(null);
                      onOpenConversation(targetId);
                    }}
                  >
                    Ir al chat en vivo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  },
);
