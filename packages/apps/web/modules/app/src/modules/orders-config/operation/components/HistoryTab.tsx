import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { Input } from "@/elements/form/input";
import {
  ChevronLeftIcon,
  CloseIcon,
  EyeIcon,
  HorizontaLDots,
} from "@/icons";
import { cn } from "@/utils";
import {
  CHANNEL_LABELS,
  MODALITY_LABELS,
  PAYMENT_METHOD_LABELS,
  STAGE_COLORS,
  STAGE_LABELS,
  formatCOP,
  type Order,
  type OrderChannel,
  type OrderModality,
} from "../domain/order";
import {
  filterOrdersByRange,
  paginate,
  sortOrders,
  type DateRange,
  type HistorySortKey,
} from "../domain/analyticsUtils";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { CalendarRangeDropdown } from "./CalendarRangeDropdown";

export interface HistoryTabProps {
  orders: Order[];
  initialRange: DateRange;
  initialChannel?: string | null;
  initialModality?: string | null;
  enabledModalities?: ReadonlyArray<string>;
  hasConversation?: (phone: string) => boolean;
  onRangeChange?: (range: DateRange) => void;
  onFilteredOrdersChange?: (orders: Order[]) => void;
  onOpenOrderDetail?: (order: Order) => void;
  onOpenChat?: (order: Order) => void;
}

type TerminalStatusFilter = "all" | "delivered" | "cancelled";
type ModalityFilter = "all" | OrderModality;
type ChannelFilter = "all" | OrderChannel;

const TERMINAL_STATUS_CHIPS: Array<{
  id: TerminalStatusFilter;
  label: string;
  dotClass?: string;
}> = [
  { id: "all", label: "Todos" },
  { id: "delivered", label: "Entregado", dotClass: "bg-emerald-500" },
  { id: "cancelled", label: "Cancelado", dotClass: "bg-red-500" },
];

const MODALITY_CHIPS: Array<{ id: ModalityFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "delivery", label: "Domicilio" },
  { id: "pickup", label: "Retiro en tienda" },
  { id: "onsite", label: "En sitio" },
];

const PAGE_SIZES = [10, 25, 50] as const;

function formatDateTimeEs(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function isTerminalOrder(order: Order): boolean {
  return order.stage === "delivered" || order.stage === "cancelled";
}

function RowActionsMenu({
  order,
  conversationAvailable = true,
  onViewDetail,
  onOpenChat,
}: {
  order: Order;
  conversationAvailable?: boolean;
  onViewDetail: (order: Order) => void;
  onOpenChat?: (order: Order) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div
      className="relative inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={`Acciones para ${order.code}`}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <HorizontaLDots className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onViewDetail(order);
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-gray-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-400"
          >
            <EyeIcon className="h-4 w-4" />
            Ver detalle
          </button>
          {onOpenChat && (
            <button
              type="button"
              disabled={!conversationAvailable}
              title={
                conversationAvailable
                  ? "Abrir conversación con el cliente"
                  : "Sin conversación registrada"
              }
              onClick={() => {
                if (!conversationAvailable) return;
                setOpen(false);
                onOpenChat(order);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium transition-colors",
                conversationAvailable
                  ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                  : "cursor-not-allowed text-gray-400 opacity-60 dark:text-gray-500",
              )}
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Abrir conversación
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: HistorySortKey;
  activeKey: HistorySortKey;
  direction: "asc" | "desc";
  onSort: (key: HistorySortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === sortKey;
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-gray-900 dark:hover:text-white",
          isActive && "text-brand-600 dark:text-brand-400",
        )}
      >
        <span>{label}</span>
        <span className="text-[10px]" aria-hidden="true">
          {isActive ? (direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

export const HistoryTab = observer(function HistoryTab({
  orders,
  initialRange,
  initialChannel = null,
  initialModality = null,
  enabledModalities,
  hasConversation,
  onRangeChange,
  onFilteredOrdersChange,
  onOpenOrderDetail,
  onOpenChat,
}: HistoryTabProps) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TerminalStatusFilter>("all");
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>(() =>
    initialModality === "delivery" ||
    initialModality === "pickup" ||
    initialModality === "onsite"
      ? initialModality
      : "all",
  );
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(() =>
    initialChannel === "whatsapp" || initialChannel === "operator"
      ? initialChannel
      : "all",
  );
  const [includeActive, setIncludeActive] = useState<boolean>(
    Boolean(initialChannel || initialModality),
  );
  const [sortKey, setSortKey] = useState<HistorySortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [fallbackDetailOrder, setFallbackDetailOrder] = useState<Order | null>(
    null,
  );

  // Sync external range changes from parent AnalyticsPage
  useEffect(() => {
    setRange(initialRange);
  }, [initialRange.start, initialRange.end]);

  // Sync external breakdown drill-down props
  useEffect(() => {
    if (initialChannel === "whatsapp" || initialChannel === "operator") {
      setChannelFilter(initialChannel);
      setIncludeActive(true);
    } else if (initialChannel === null) {
      setChannelFilter("all");
    }
  }, [initialChannel]);

  useEffect(() => {
    if (
      initialModality === "delivery" ||
      initialModality === "pickup" ||
      initialModality === "onsite"
    ) {
      setModalityFilter(initialModality);
      setIncludeActive(true);
    } else if (initialModality === null) {
      setModalityFilter("all");
    }
  }, [initialModality]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    modalityFilter,
    channelFilter,
    includeActive,
    range.start,
    range.end,
    pageSize,
  ]);

  const handleRangeChange = (nextRange: DateRange) => {
    setRange(nextRange);
    onRangeChange?.(nextRange);
  };

  const handleSort = (key: HistorySortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "createdAt" || key === "total" ? "desc" : "asc");
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setModalityFilter("all");
    setChannelFilter("all");
    setIncludeActive(false);
    handleRangeChange({ start: null, end: null });
  };

  const handleOpenDetail = (order: Order) => {
    if (onOpenOrderDetail) {
      onOpenOrderDetail(order);
    } else {
      setFallbackDetailOrder(order);
    }
  };

  const visibleModalityChips =
    enabledModalities && enabledModalities.length > 0
      ? MODALITY_CHIPS.filter(
          (chip) => chip.id === "all" || enabledModalities.includes(chip.id),
        )
      : MODALITY_CHIPS;

  // Compute directly inside observer render so MobX mutations update immediately
  const query = search.trim().toLowerCase();
  const ordersBeforeDateRange = orders.filter((order) => {
    if (!includeActive && !isTerminalOrder(order)) return false;
    if (statusFilter !== "all" && order.stage !== statusFilter) return false;
    if (modalityFilter !== "all" && order.modality !== modalityFilter) {
      return false;
    }
    if (channelFilter !== "all" && order.channel !== channelFilter) {
      return false;
    }

    if (query) {
      const haystack =
        `${order.code} ${order.customerName} ${order.customerPhone}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const filteredOrders = filterOrdersByRange(
    ordersBeforeDateRange,
    range,
    (order) => order.deliveredAt ?? order.createdAt,
  );

  const sortedOrders = sortOrders(filteredOrders, sortKey, sortDirection);
  const paginated = paginate(sortedOrders, page, pageSize);

  // Report currently filtered closed orders to parent for CSV export
  const exportOrders = sortedOrders.filter(isTerminalOrder);
  const exportSignature = exportOrders
    .map((o) => `${o.id}:${o.stage}:${o.paid}:${o.total}`)
    .join("|");
  const onFilteredChangeRef = useRef(onFilteredOrdersChange);
  onFilteredChangeRef.current = onFilteredOrdersChange;
  const exportOrdersRef = useRef(exportOrders);
  exportOrdersRef.current = exportOrders;

  useEffect(() => {
    onFilteredChangeRef.current?.(exportOrdersRef.current);
  }, [exportSignature]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    modalityFilter !== "all" ||
    channelFilter !== "all" ||
    includeActive ||
    Boolean(range.start || range.end);

  const startItemIndex =
    sortedOrders.length === 0 ? 0 : (paginated.safePage - 1) * pageSize + 1;
  const endItemIndex = Math.min(
    sortedOrders.length,
    paginated.safePage * pageSize,
  );

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3.5">
          {/* Top row: search + result count + date range + clear */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-72">
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, teléfono o # pedido..."
                  aria-label="Buscar en el historial de pedidos"
                  className="h-9 pr-8 text-xs sm:text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {sortedOrders.length}{" "}
                {sortedOrders.length === 1 ? "resultado" : "resultados"}
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CalendarRangeDropdown
                value={range}
                onChange={handleRangeChange}
                compact
                align="right"
                placeholder="Filtrar por fecha"
              />
            </div>
          </div>

          {/* Bottom row: Status chips + Modality chips + Channel & Scope pills */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-gray-100 pt-3 dark:border-gray-800">
            {/* Terminal status chips with emerald/red dots */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Estado:
              </span>
              {TERMINAL_STATUS_CHIPS.map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusFilter(chip.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-brand-500 text-white shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                  >
                    {chip.dotClass && (
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          chip.dotClass,
                          active && "ring-1 ring-white/70",
                        )}
                      />
                    )}
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modality chips (filtered by enabledModalities when provided) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Modalidad:
              </span>
              {visibleModalityChips.map((chip) => {
                const active = modalityFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setModalityFilter(chip.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Active Channel filter chip (when filtered from Metrics) */}
            {channelFilter !== "all" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Canal:
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                  {CHANNEL_LABELS[channelFilter]}
                  <button
                    type="button"
                    onClick={() => setChannelFilter("all")}
                    aria-label="Quitar filtro de canal"
                    className="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/25"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}

            {/* Toggle to include active (non-terminal) orders */}
            <button
              type="button"
              onClick={() => setIncludeActive((prev) => !prev)}
              aria-pressed={includeActive}
              className={cn(
                "ml-auto rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                includeActive
                  ? "bg-secondary-600/10 text-secondary-600 ring-1 ring-inset ring-secondary-600/25 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
                  : "bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 dark:bg-white/[0.03] dark:text-gray-400 dark:ring-gray-700",
              )}
            >
              {includeActive ? "Mostrando todos los estados" : "Solo cerrados"}
            </button>
          </div>
        </div>
      </Card>

      {/* Activity heatmap synced bidirectionally with date range */}
      <ActivityHeatmap
        orders={ordersBeforeDateRange}
        selectedRange={range}
        onSelectRange={handleRangeChange}
      />

      {/* Closed orders table */}
      {sortedOrders.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            No hay pedidos que coincidan con los filtros
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Prueba ampliando el rango de fechas o limpiando los filtros activos.
          </p>
          {hasActiveFilters && (
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]">
                <tr>
                  <SortableHeader
                    label="ID"
                    sortKey="code"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Fecha"
                    sortKey="createdAt"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Cliente"
                    sortKey="customerName"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Canal
                  </th>
                  <SortableHeader
                    label="Modalidad"
                    sortKey="modality"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Pago"
                    sortKey="paymentMethod"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Estado"
                    sortKey="stage"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Total"
                    sortKey="total"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginated.items.map((order) => {
                  const stageColor = STAGE_COLORS[order.stage] ?? "#64748B";
                  const stageLabel = STAGE_LABELS[order.stage] ?? order.stage;
                  const conversationAvailable = hasConversation
                    ? hasConversation(order.customerPhone)
                    : true;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleOpenDetail(order)}
                      className="cursor-pointer transition-colors hover:bg-gray-50/90 dark:hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-gray-900 dark:text-white">
                        {order.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTimeEs(order.deliveredAt ?? order.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {order.customerName}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {order.customerPhone}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            order.channel === "whatsapp"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                          )}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                order.channel === "whatsapp"
                                  ? "#538690"
                                  : "#5120dc",
                            }}
                          />
                          {CHANNEL_LABELS[order.channel] ?? order.channel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                        {MODALITY_LABELS[order.modality] ?? order.modality}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-200">
                          {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                            order.paymentMethod}
                        </div>
                        <div
                          className={cn(
                            "text-[11px] font-medium",
                            order.paid
                              ? "text-[#538690] dark:text-[#6ba9b5]"
                              : "text-[#ff3f1a] dark:text-[#fe674a]",
                          )}
                        >
                          {order.paid ? "Pagado" : "Pendiente de pago"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: `${stageColor}18`,
                            color: stageColor,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: stageColor }}
                          />
                          {stageLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-white">
                        {formatCOP(order.total)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <RowActionsMenu
                          order={order}
                          conversationAvailable={conversationAvailable}
                          onViewDetail={handleOpenDetail}
                          onOpenChat={onOpenChat}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Mostrando{" "}
                <strong className="font-semibold text-gray-700 dark:text-gray-200">
                  {startItemIndex}–{endItemIndex}
                </strong>{" "}
                de{" "}
                <strong className="font-semibold text-gray-700 dark:text-gray-200">
                  {sortedOrders.length}
                </strong>{" "}
                pedidos
              </span>
              <label className="inline-flex items-center gap-1.5">
                <span>Filas:</span>
                <select
                  aria-label="Pedidos por página"
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(
                      Number(e.target.value) as (typeof PAGE_SIZES)[number],
                    )
                  }
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:border-brand-400 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={paginated.safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                Anterior
              </button>
              <span className="px-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                Página {paginated.safePage} de {paginated.totalPages}
              </span>
              <button
                type="button"
                disabled={paginated.safePage >= paginated.totalPages}
                onClick={() =>
                  setPage((p) => Math.min(paginated.totalPages, p + 1))
                }
                aria-label="Página siguiente"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Siguiente
                <ChevronLeftIcon className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Lightweight fallback read-only detail dialog when onOpenOrderDetail is not provided */}
      {fallbackDetailOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle del pedido ${fallbackDetailOrder.code}`}
          onClick={() => setFallbackDetailOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {fallbackDetailOrder.code}
                  </h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${
                        STAGE_COLORS[fallbackDetailOrder.stage] ?? "#64748B"
                      }18`,
                      color:
                        STAGE_COLORS[fallbackDetailOrder.stage] ?? "#64748B",
                    }}
                  >
                    {STAGE_LABELS[fallbackDetailOrder.stage] ??
                      fallbackDetailOrder.stage}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {fallbackDetailOrder.customerName} ·{" "}
                  {fallbackDetailOrder.customerPhone}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setFallbackDetailOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs dark:bg-white/[0.03]">
              <div>
                <span className="text-gray-400">Fecha</span>
                <p className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
                  {formatDateTimeEs(
                    fallbackDetailOrder.deliveredAt ??
                      fallbackDetailOrder.createdAt,
                  )}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Modalidad</span>
                <p className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
                  {MODALITY_LABELS[fallbackDetailOrder.modality]}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Canal</span>
                <p className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
                  {CHANNEL_LABELS[fallbackDetailOrder.channel]}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Pago</span>
                <p className="mt-0.5 font-medium text-gray-800 dark:text-gray-200">
                  {PAYMENT_METHOD_LABELS[fallbackDetailOrder.paymentMethod]} ·{" "}
                  {fallbackDetailOrder.paid ? "Pagado" : "Pendiente de pago"}
                </p>
              </div>
            </div>

            {fallbackDetailOrder.items.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Productos
                </p>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                  {fallbackDetailOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="text-gray-700 dark:text-gray-200">
                        {item.quantity}× {item.name}
                        {item.variant ? ` (${item.variant})` : ""}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {formatCOP(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-gray-50/70 px-3 py-2.5 text-sm font-bold dark:bg-white/[0.02]">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCOP(fallbackDetailOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {fallbackDetailOrder.cancellationReason && (
              <div className="mb-4 rounded-xl border border-error-200 bg-error-50/70 p-3 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
                <strong>Motivo de cancelación:</strong>{" "}
                {fallbackDetailOrder.cancellationReason}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFallbackDetailOrder(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
