import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils";
import {
  CHANNEL_LABELS,
  classifyIntention,
  derivePipelineStage,
  formatRelativeTime,
  getInitials,
  getLastVisibleMessage,
  INTENTION_META,
  phonesMatch,
  PIPELINE_STAGES,
  stripHtmlTags,
  type Conversation,
  type ConversationChannel,
  type ConversationIntention,
  type PipelineStageId,
  type PipelineStageMeta,
} from "../../domain/conversationsDomain";
import { formatCOP, STAGE_LABELS, type Order } from "../../domain/order";
import type { ConversationsStore } from "../../stores/ConversationsStore";
import type { OrdersStore } from "../../stores/OrdersStore";

export interface PipelineBoardViewProps {
  store: ConversationsStore;
  ordersStore: OrdersStore;
  onOpenChatDrawer: (conversationId: string) => void;
  onOpenFullConsole: (conversationId: string) => void;
  onCreateOrder?: (conv: Conversation) => void;
}

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

const INTENTION_BADGE_STYLES: Record<ConversationIntention, string> = {
  inquire:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  buy:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  track_order:
    "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  claim:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

function pickActiveOrder(linkedOrders: Order[]): Order | undefined {
  return (
    linkedOrders.find(
      (order) => order.stage !== "cancelled" && order.stage !== "delivered",
    ) ??
    linkedOrders.find((order) => order.stage !== "cancelled") ??
    linkedOrders[0]
  );
}

interface PipelineEntry {
  conv: Conversation;
  linkedOrders: Order[];
  activeOrder?: Order;
  autoStage: PipelineStageId;
  effectiveStage: PipelineStageId;
  isManualOverride: boolean;
  intention: ConversationIntention;
}

interface PipelineCardProps {
  entry: PipelineEntry;
  stageMeta: PipelineStageMeta;
  onOpenChatDrawer: (conversationId: string) => void;
  onOpenFullConsole: (conversationId: string) => void;
  onCreateOrder?: (conv: Conversation) => void;
  onDragStart: (e: React.DragEvent, convId: string) => void;
}

function PipelineCard({
  entry,
  stageMeta,
  onOpenChatDrawer,
  onOpenFullConsole,
  onCreateOrder,
  onDragStart,
}: PipelineCardProps) {
  const { conv, activeOrder, isManualOverride, intention } = entry;
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(conv.contact.phone);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const channelStyle = CHANNEL_BADGE_STYLES[conv.channel];
  const intentionMeta = INTENTION_META[intention];
  const lastMsg = getLastVisibleMessage(conv);
  const previewText = lastMsg ? stripHtmlTags(lastMsg.text) : "";
  const progressPct = activeOrder?.paid ? 100 : stageMeta.progress;

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, conv.id)}
      onClick={() => onOpenChatDrawer(conv.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenChatDrawer(conv.id);
        }
      }}
      className="group relative cursor-grab select-none rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-theme-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md active:cursor-grabbing dark:border-white/[0.08] dark:bg-gray-900 dark:hover:border-white/[0.16]"
    >
      {/* Top row: Avatar + Name + Channel + 3-dot menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
              style={{ backgroundColor: conv.contact.avatarColor }}
              title={conv.contact.name}
            >
              {getInitials(conv.contact.name)}
            </div>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900",
                channelStyle.dot,
              )}
              title={`Canal: ${CHANNEL_LABELS[conv.channel]}`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                {conv.contact.name}
              </h4>
              {isManualOverride && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-2 ring-violet-200 dark:ring-violet-500/30"
                  title="Etapa movida manualmente"
                />
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  channelStyle.badge,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", channelStyle.dot)} />
                {CHANNEL_LABELS[conv.channel]}
              </span>
              {conv.needsAttention && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  Requiere asesor
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3-dot actions menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            aria-label={`Opciones para ${conv.contact.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenChatDrawer(conv.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400" />
                Abrir chat lateral
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenFullConsole(conv.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                Ir a consola completa
              </button>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
              >
                {copiedPhone ? (
                  <CheckIcon className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ClipboardDocumentIcon className="h-4 w-4 text-gray-400" />
                )}
                <span>{copiedPhone ? "¡Teléfono copiado!" : "Copiar teléfono"}</span>
              </button>
              {onCreateOrder && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onCreateOrder(conv);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  Crear pedido
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Last message preview */}
      {previewText && (
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {previewText}
        </p>
      )}

      {/* Linked order + payment + intention badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {activeOrder && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <ShoppingBagIcon className="h-3 w-3" />
            #{activeOrder.code} · {formatCOP(activeOrder.total)}
          </span>
        )}

        {activeOrder && (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              activeOrder.paid
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
            )}
          >
            {activeOrder.paid ? "Pagado" : "Pendiente"}
          </span>
        )}

        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
            INTENTION_BADGE_STYLES[intention],
          )}
        >
          {intentionMeta.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-gray-400 dark:text-gray-500">
            {activeOrder
              ? STAGE_LABELS[activeOrder.stage] ?? activeOrder.stage
              : "Avance comercial"}
          </span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {progressPct}%
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              backgroundColor: activeOrder?.paid ? "#10B981" : stageMeta.color,
            }}
          />
        </div>
      </div>

      {/* Footer: Relative time + unread badge */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5 text-[11px] text-gray-400 dark:border-white/[0.06] dark:text-gray-500">
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          {formatRelativeTime(conv.lastActivityAt)}
        </span>

        <div className="flex items-center gap-2">
          {isManualOverride && (
            <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
              Manual
            </span>
          )}
          {conv.unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface PipelineColumnProps {
  stageMeta: PipelineStageMeta;
  entries: PipelineEntry[];
  columnValue: number;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, convId: string) => void;
  onOpenChatDrawer: (conversationId: string) => void;
  onOpenFullConsole: (conversationId: string) => void;
  onCreateOrder?: (conv: Conversation) => void;
}

function PipelineColumn({
  stageMeta,
  entries,
  columnValue,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onOpenChatDrawer,
  onOpenFullConsole,
  onCreateOrder,
}: PipelineColumnProps) {
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={`Columna ${stageMeta.label}`}
      className={cn(
        "flex h-full min-h-[420px] min-w-[280px] flex-1 flex-col rounded-2xl border p-3 transition-all duration-150",
        isDragOver
          ? "border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-brand-950/25"
          : "border-gray-200/80 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]",
      )}
    >
      {/* Column header */}
      <header className="mb-3 shrink-0 px-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: stageMeta.color }}
            />
            <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
              {stageMeta.label}
            </h3>
          </div>
          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gray-200/80 px-1.5 text-[11px] font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
            {entries.length}
          </span>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate text-gray-500 dark:text-gray-400">
            {stageMeta.progress}% avance
          </span>
          <span
            className={cn(
              "shrink-0 font-semibold",
              columnValue > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-400 dark:text-gray-500",
            )}
          >
            {formatCOP(columnValue)}
          </span>
        </div>
      </header>

      {/* Cards list */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {entries.map((entry) => (
          <PipelineCard
            key={entry.conv.id}
            entry={entry}
            stageMeta={stageMeta}
            onOpenChatDrawer={onOpenChatDrawer}
            onOpenFullConsole={onOpenFullConsole}
            onCreateOrder={onCreateOrder}
            onDragStart={onDragStart}
          />
        ))}

        {entries.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
            <span>Sin conversaciones en esta etapa</span>
            <span className="mt-1 text-[11px] opacity-80">
              Arrastra una tarjeta aquí
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

export const PipelineBoardView = observer(
  ({
    store,
    ordersStore,
    onOpenChatDrawer,
    onOpenFullConsole,
    onCreateOrder,
  }: PipelineBoardViewProps) => {
    const [search, setSearch] = useState("");
    const [selectedStages, setSelectedStages] = useState<PipelineStageId[]>([]);
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);
    const [dragOverStage, setDragOverStage] = useState<PipelineStageId | null>(
      null,
    );
    const filterMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!filterMenuOpen) return;
      const handleOutside = (e: MouseEvent) => {
        if (
          filterMenuRef.current &&
          !filterMenuRef.current.contains(e.target as Node)
        ) {
          setFilterMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [filterMenuOpen]);

    const toggleStageFilter = (stageId: PipelineStageId) => {
      setSelectedStages((prev) =>
        prev.includes(stageId)
          ? prev.filter((id) => id !== stageId)
          : [...prev, stageId],
      );
    };

    const query = normalizeSearch(search);
    const queryDigits = search.replace(/\D/g, "");

    const byStage: Record<PipelineStageId, PipelineEntry[]> = {
      initial_contact: [],
      offer_sent: [],
      follow_up: [],
      closing: [],
      payment_validation: [],
    };

    const allOrders = ordersStore.orders;

    for (const conv of store.conversations) {
      if (conv.status === "closed") continue;

      const linkedOrders = getLinkedOrders(conv, allOrders);
      const activeOrder = pickActiveOrder(linkedOrders);

      if (query) {
        const matchName = normalizeSearch(conv.contact.name).includes(query);
        const matchPhone =
          normalizeSearch(conv.contact.phone).includes(query) ||
          (queryDigits.length >= 3 &&
            conv.contact.phone.replace(/\D/g, "").includes(queryDigits));
        const matchOrder = linkedOrders.some((order) =>
          normalizeSearch(order.code).includes(query),
        );
        if (!matchName && !matchPhone && !matchOrder) continue;
      }

      const autoStage = derivePipelineStage(conv, linkedOrders);
      const effectiveStage = store.effectivePipelineStage(conv, linkedOrders);
      if (autoStage === null || effectiveStage === null) continue;

      const overrideEntry = store.pipelineOverrides[conv.id];
      const isManualOverride = Boolean(
        overrideEntry &&
          overrideEntry.autoSnapshot === autoStage &&
          overrideEntry.stage !== autoStage,
      );
      const intention = classifyIntention(conv, linkedOrders);

      byStage[effectiveStage].push({
        conv,
        linkedOrders,
        activeOrder,
        autoStage,
        effectiveStage,
        isManualOverride,
        intention,
      });
    }

    for (const stage of PIPELINE_STAGES) {
      byStage[stage.id].sort((a, b) =>
        b.conv.lastActivityAt.localeCompare(a.conv.lastActivityAt),
      );
    }

    const visibleStages = useMemo(() => {
      if (selectedStages.length === 0) return PIPELINE_STAGES;
      return PIPELINE_STAGES.filter((stage) =>
        selectedStages.includes(stage.id),
      );
    }, [selectedStages]);

    const columnTotals: Record<PipelineStageId, number> = {
      initial_contact: 0,
      offer_sent: 0,
      follow_up: 0,
      closing: 0,
      payment_validation: 0,
    };

    let totalPipelineCop = 0;
    let totalActiveLeads = 0;

    for (const stage of visibleStages) {
      const entries = byStage[stage.id];
      let sum = 0;
      for (const entry of entries) {
        if (entry.activeOrder && entry.activeOrder.stage !== "cancelled") {
          sum += entry.activeOrder.total;
        }
      }
      columnTotals[stage.id] = sum;
      totalPipelineCop += sum;
      totalActiveLeads += entries.length;
    }

    const overrideCount = Object.keys(store.pipelineOverrides).length;

    const handleDragStart = (e: React.DragEvent, convId: string) => {
      e.dataTransfer.setData("text/plain", convId);
      e.dataTransfer.effectAllowed = "move";
    };

    const handleDropOnStage = (
      e: React.DragEvent,
      targetStage: PipelineStageId,
    ) => {
      e.preventDefault();
      setDragOverStage(null);
      const convId = e.dataTransfer.getData("text/plain");
      if (!convId) return;

      const conv = store.byId(convId);
      if (!conv) return;

      const linkedOrders = getLinkedOrders(conv, ordersStore.orders);
      const autoStage = derivePipelineStage(conv, linkedOrders);
      if (!autoStage) return;
      store.setPipelineStageOverride(conv.id, targetStage, autoStage);
    };

    const handleResetStages = () => {
      store.resetPipelineOverrides();
      setSelectedStages([]);
      setSearch("");
    };

    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
        {/* Top Toolbar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-theme-xs lg:flex-row lg:items-center lg:justify-between dark:border-gray-800 dark:bg-white/[0.03]">
          {/* Left: Search + Stage Filter + Active Chips */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative w-full sm:w-64">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, teléfono o #pedido..."
                aria-label="Buscar en el embudo comercial"
                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-9 pr-8 text-xs text-gray-900 placeholder-gray-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Multi-select Stage Filter Dropdown */}
            <div className="relative" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setFilterMenuOpen((prev) => !prev)}
                aria-expanded={filterMenuOpen}
                aria-haspopup="true"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <FunnelIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                <span>Etapas</span>
                {selectedStages.length > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                    {selectedStages.length}
                  </span>
                )}
              </button>

              {filterMenuOpen && (
                <div className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Filtrar etapas del embudo
                  </div>
                  {PIPELINE_STAGES.map((stage) => {
                    const active = selectedStages.includes(stage.id);
                    const count = byStage[stage.id].length;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => toggleStageFilter(stage.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                          active
                            ? "bg-gray-100 font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                            : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              active
                                ? "border-brand-500 bg-brand-500 text-white"
                                : "border-gray-300 dark:border-gray-600",
                            )}
                          >
                            {active && <CheckIcon className="h-3 w-3 stroke-[3]" />}
                          </span>
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span>{stage.label}</span>
                        </span>
                        <span className="text-[11px] font-medium text-gray-400">
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  {selectedStages.length > 0 && (
                    <>
                      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                      <button
                        type="button"
                        onClick={() => setSelectedStages([])}
                        className="flex w-full items-center justify-center rounded-lg py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        Limpiar filtros
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Active stage filter chips */}
            {selectedStages.map((stageId) => {
              const meta = PIPELINE_STAGES.find((s) => s.id === stageId);
              if (!meta) return null;
              return (
                <span
                  key={stageId}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span>{meta.label}</span>
                  <button
                    type="button"
                    onClick={() => toggleStageFilter(stageId)}
                    aria-label={`Quitar filtro ${meta.label}`}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>

          {/* Right: Pipeline COP metric + Active leads + Reset button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex h-9 items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/80 px-3 text-xs dark:border-gray-700 dark:bg-gray-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <BanknotesIcon className="h-4 w-4" />
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                Pipeline:
              </span>
              <strong className="font-bold text-gray-900 dark:text-white">
                {formatCOP(totalPipelineCop)}
              </strong>
              <span className="h-3.5 w-px bg-gray-200 dark:bg-gray-700" />
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {totalActiveLeads}{" "}
                {totalActiveLeads === 1 ? "lead activo" : "leads activos"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetStages}
              title="Restablecer etapas automáticas y filtros"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowPathIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              <span>Restablecer etapas</span>
              {overrideCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-100 px-1 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                  {overrideCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 5-Column Kanban Board */}
        <div className="flex min-h-0 flex-1 gap-3.5 overflow-x-auto pb-2">
          {visibleStages.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stageMeta={stage}
              entries={byStage[stage.id]}
              columnValue={columnTotals[stage.id]}
              isDragOver={dragOverStage === stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverStage !== stage.id) {
                  setDragOverStage(stage.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverStage === stage.id) {
                  setDragOverStage(null);
                }
              }}
              onDrop={(e) => handleDropOnStage(e, stage.id)}
              onDragStart={handleDragStart}
              onOpenChatDrawer={onOpenChatDrawer}
              onOpenFullConsole={onOpenFullConsole}
              onCreateOrder={onCreateOrder}
            />
          ))}
        </div>

        <p className="shrink-0 px-1 text-[11px] text-gray-400 dark:text-gray-500">
          Arrastra cualquier conversación para ajustar su etapa comercial manualmente. Las conversaciones cerradas salen del embudo y se consultan en Historial.
        </p>
      </div>
    );
  },
);
