import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useSearchParams } from "react-router";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  BarsArrowDownIcon,
  BarsArrowUpIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import { GridIcon, ListIcon } from "@/icons";
import type { ModalityType, OrderOperatorStage } from "../../types";
import type { CatalogProduct } from "../domain/catalogDomain";
import {
  canOperatorMoveTo,
  STAGE_LABELS,
  type Order,
  type OrderColumn,
  type OrderModality,
  type OrderStage,
} from "../domain/order";
import type { OrderNotificationEventType } from "../domain/conversationsDomain";
import type { ConversationsStore } from "../stores/ConversationsStore";
import type { IncidentStore } from "../stores/IncidentStore";
import type { OrdersStore } from "../stores/OrdersStore";
import { CreateOrderModal } from "../components/CreateOrderModal";
import { DeliveryIncidentModal } from "../components/DeliveryIncidentModal";
import { OrderCard } from "../components/OrderCard";
import {
  CancelOrderModal,
  ColumnFormModal,
  DeliverOrderModal,
} from "../components/OrderConfirmModals";
import { OrderDetailModal } from "../components/OrderDetailModal";
import {
  exportOrdersToCsv,
  OrdersListView,
  type ListGroupId,
} from "../components/OrdersListView";
import { ScheduledOrdersModal } from "../components/ScheduledOrdersModal";
import { ScheduleOrderModal } from "../components/ScheduleOrderModal";

export type OrdersModalities = ReadonlyArray<ModalityType | OrderModality>;

export interface OrdersPageProps {
  businessName: string;
  businessId?: string;
  operatorName: string;
  isAdmin?: boolean;
  selected: string;
  setSelected: (id: string) => void;
  ordersStore: OrdersStore;
  incidentsStore: IncidentStore;
  conversationsStore?: ConversationsStore;
  catalogProducts: CatalogProduct[];
  stages: OrderOperatorStage[];
  modalities: OrdersModalities;
  openCatalog: () => void;
  openIncidents: () => void;
  onOpenChat?: (order: Order) => void;
}

function stageToNotificationEvent(stage: OrderStage): OrderNotificationEventType {
  switch (stage) {
    case "confirmed":
      return "confirmed";
    case "preparing":
      return "preparing";
    case "ready":
      return "ready";
    case "in_transit":
      return "in_transit";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "advanced";
  }
}

function stageToListGroup(stageId: string): ListGroupId {
  if (stageId === "scheduled") return "scheduled";
  if (stageId === "delivered" || stageId === "cancelled") return "closed";
  if (stageId === "in_transit") return "in_transit";
  if (stageId === "new" || stageId === "confirmed") return "to_prepare";
  return "preparing";
}

type ViewMode = "kanban" | "lista";
type PaymentFilter = "all" | "paid" | "pending";
type SortDirection = "desc" | "asc";

const VIEW_STORAGE_KEY = "necto.pedidosVista";

function parseViewParam(param: string | null): ViewMode | null {
  if (param === "lista") return "lista";
  if (param === "inicio" || param === "kanban") return "kanban";
  return null;
}

function parsePaymentParam(param: string | null): PaymentFilter {
  if (param === "paid" || param === "pagado" || param === "pagados") {
    return "paid";
  }
  if (param === "pending" || param === "pendiente" || param === "pendientes") {
    return "pending";
  }
  return "all";
}

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "kanban";
  try {
    const val = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return val === "lista" ? "lista" : "kanban";
  } catch {
    return "kanban";
  }
}

function kanbanGridClass(columnCount: number): string {
  if (columnCount <= 1) return "grid grid-cols-1 gap-3.5";
  if (columnCount === 2) return "grid grid-cols-1 gap-3.5 md:grid-cols-2";
  if (columnCount === 3) return "grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3";
  if (columnCount === 4) {
    return "grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4";
  }
  return "grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
}

export const OrdersPage = observer(
  ({
    businessName,
    businessId,
    operatorName,
    isAdmin = true,
    selected,
    setSelected,
    ordersStore,
    incidentsStore,
    conversationsStore,
    catalogProducts,
    stages,
    modalities,
    openCatalog,
    openIncidents,
    onOpenChat,
  }: OrdersPageProps) => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Initialize filters from URL search params > localStorage
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
      return parseViewParam(searchParams.get("vista")) ?? readStoredView();
    });
    const [selectedStages, setSelectedStages] = useState<string[]>(() => {
      const raw = searchParams.get("estado");
      return raw ? raw.split(",").filter(Boolean) : [];
    });
    const [activeGroup, setActiveGroup] = useState<ListGroupId>(() => {
      const raw = searchParams.get("estado");
      const first = raw?.split(",").filter(Boolean)[0];
      return first ? stageToListGroup(first) : "to_prepare";
    });
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(() =>
      parsePaymentParam(searchParams.get("pago")),
    );
    const [sortDir, setSortDir] = useState<SortDirection>("desc");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchExpanded, setSearchExpanded] = useState(false);

    // Dropdowns & menus
    const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
    const [openColMenuId, setOpenColMenuId] = useState<string | null>(null);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const colMenuRef = useRef<HTMLDivElement>(null);

    // Drag & Drop state
    const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
    const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
    const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
    const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);

    // Modals state
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [scheduledListOpen, setScheduledListOpen] = useState(false);
    const [scheduleTarget, setScheduleTarget] = useState<Order | null>(null);
    const [incidentTarget, setIncidentTarget] = useState<Order | null>(null);
    const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
    const [bulkCancelIds, setBulkCancelIds] = useState<string[]>([]);
    const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
    const [columnModal, setColumnModal] = useState<{
      open: boolean;
      mode: "create" | "rename";
      columnId?: string;
      initialLabel?: string;
      initialColor?: string;
    }>({ open: false, mode: "create" });

    // Toast notification
    const [toast, setToast] = useState<{
      tone: "success" | "error";
      message: string;
    } | null>(null);
    const toastTimerRef = useRef<number | null>(null);
    const lastWrittenQueryRef = useRef<string | null>(null);

    const showToast = (
      message: string,
      tone: "success" | "error" = "success",
    ) => {
      setToast({ message, tone });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3800);
    };

    useEffect(() => {
      return () => {
        if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      };
    }, []);

    // 1-second interval checking scheduled orders activation
    useEffect(() => {
      const interval = window.setInterval(() => {
        const activated = ordersStore.tickScheduledOrders();
        if (activated > 0) {
          showToast(
            activated === 1
              ? "1 pedido programado se activó automáticamente en Nuevo."
              : `${activated} pedidos programados se activaron automáticamente en Nuevo.`,
          );
        }
      }, 1000);
      return () => window.clearInterval(interval);
    }, [ordersStore]);

    // React to external searchParams changes (?vista=, ?pago=, ?estado=, ?detalle=, ?focus=)
    const serializedSearchParams = searchParams.toString();
    useEffect(() => {
      const isSelfWrite = lastWrittenQueryRef.current === serializedSearchParams;
      if (isSelfWrite) {
        lastWrittenQueryRef.current = null;
      }

      if (!isSelfWrite) {
        const parsedView = parseViewParam(searchParams.get("vista"));
        if (parsedView && parsedView !== viewMode) {
          setViewMode(parsedView);
        }

        const rawPago = searchParams.get("pago");
        if (rawPago !== null) {
          const parsedPago = parsePaymentParam(rawPago);
          if (parsedPago !== paymentFilter) setPaymentFilter(parsedPago);
        } else if (paymentFilter !== "all") {
          setPaymentFilter("all");
        }

        const rawEstado = searchParams.get("estado");
        const nextStages = rawEstado ? rawEstado.split(",").filter(Boolean) : [];
        if (nextStages.join(",") !== selectedStages.join(",")) {
          setSelectedStages(nextStages);
          if (nextStages.length > 0) {
            setActiveGroup(stageToListGroup(nextStages[0]));
          }
        }
      }

      const detalleParam = searchParams.get("detalle");
      if (detalleParam) {
        const found =
          ordersStore.byId(detalleParam) ?? ordersStore.byCode(detalleParam);
        if (found && selected !== found.id) {
          setSelected(found.id);
        }
      }

      const focusParam = searchParams.get("focus");
      if (focusParam) {
        const found =
          ordersStore.byId(focusParam) ?? ordersStore.byCode(focusParam);
        if (found) {
          setFocusedOrderId(found.id);
          if (found.stage === "delivered" || found.stage === "cancelled") {
            setViewMode("lista");
            setActiveGroup("closed");
          } else if (found.scheduledFor) {
            setViewMode("lista");
            setActiveGroup("scheduled");
          }
          window.setTimeout(() => {
            setFocusedOrderId((curr) => (curr === found.id ? null : curr));
          }, 2600);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serializedSearchParams]);

    // Sync view & filters to URL search params + localStorage
    useEffect(() => {
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
      } catch {
        // Ignore private-mode storage errors
      }

      const next = new URLSearchParams(searchParams);
      next.set("vista", viewMode === "kanban" ? "inicio" : "lista");
      if (selectedStages.length > 0) {
        next.set("estado", selectedStages.join(","));
      } else {
        next.delete("estado");
      }
      if (paymentFilter !== "all") {
        next.set("pago", paymentFilter === "paid" ? "pagados" : "pendientes");
      } else {
        next.delete("pago");
      }

      const nextQuery = next.toString();
      if (nextQuery !== searchParams.toString()) {
        lastWrittenQueryRef.current = nextQuery;
        setSearchParams(next, { replace: true });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, selectedStages, paymentFilter]);

    // Close dropdowns on outside click
    useEffect(() => {
      if (!filtersMenuOpen && !openColMenuId) return;
      const handleOutside = (e: MouseEvent) => {
        if (
          filtersMenuOpen &&
          filtersDropdownRef.current &&
          !filtersDropdownRef.current.contains(e.target as Node)
        ) {
          setFiltersMenuOpen(false);
        }
        if (
          openColMenuId &&
          colMenuRef.current &&
          !colMenuRef.current.contains(e.target as Node)
        ) {
          setOpenColMenuId(null);
        }
      };
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [filtersMenuOpen, openColMenuId]);

    // Permission gates
    const canCancel =
      isAdmin ||
      stages.includes("confirmation") ||
      stages.includes("dispatch");
    const canSchedule =
      isAdmin ||
      stages.includes("confirmation") ||
      stages.includes("dispatch");
    const canReportIncident =
      isAdmin ||
      stages.includes("confirmation") ||
      stages.includes("dispatch");
    const canCreateOrder =
      isAdmin || stages.includes("confirmation") || stages.length > 0;
    const canDragCards = isAdmin || stages.length > 0;

    // Stage options with live counts (including Programados + Closed)
    const allStageOptions = useMemo(() => {
      const list: Array<{ id: string; label: string; color: string }> = [
        ...ordersStore.columns.map((c) => ({
          id: c.id,
          label: c.label,
          color: c.color,
        })),
        { id: "scheduled", label: "Programados", color: "#7C3AED" },
        { id: "delivered", label: STAGE_LABELS.delivered, color: "#059669" },
        { id: "cancelled", label: STAGE_LABELS.cancelled, color: "#EF4444" },
      ];
      return list;
    }, [ordersStore.columns]);

    const stageCounts = useMemo(() => {
      const map: Record<string, number> = {
        scheduled: 0,
      };
      for (const order of ordersStore.orders) {
        if (
          order.scheduledFor &&
          order.stage !== "delivered" &&
          order.stage !== "cancelled"
        ) {
          map.scheduled = (map.scheduled ?? 0) + 1;
          continue;
        }
        map[order.stage] = (map[order.stage] ?? 0) + 1;
      }
      return map;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ordersStore.orders, ordersStore.orders.length]);

    // Filter and sort orders
    const filteredAllOrders = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      const filtered = ordersStore.orders.filter((order) => {
        if (selectedStages.length > 0) {
          const isOrderScheduled =
            Boolean(order.scheduledFor) &&
            order.stage !== "delivered" &&
            order.stage !== "cancelled";
          const matchesScheduled =
            isOrderScheduled && selectedStages.includes("scheduled");
          const matchesStage =
            !isOrderScheduled && selectedStages.includes(order.stage);
          if (!matchesScheduled && !matchesStage) {
            return false;
          }
        }
        if (paymentFilter === "paid" && !order.paid) return false;
        if (paymentFilter === "pending" && order.paid) return false;
        if (!q) return true;
        return (
          order.code.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.customerPhone.toLowerCase().includes(q) ||
          (order.trackingNumber?.toLowerCase().includes(q) ?? false) ||
          (order.carrier?.toLowerCase().includes(q) ?? false) ||
          (order.courierName?.toLowerCase().includes(q) ?? false) ||
          order.items.some((i) => i.name.toLowerCase().includes(q))
        );
      });

      return filtered.slice().sort((a, b) => {
        const cmp = a.createdAt.localeCompare(b.createdAt);
        return sortDir === "desc" ? -cmp : cmp;
      });
    }, [ordersStore.orders, selectedStages, paymentFilter, searchQuery, sortDir]);

    const filteredActiveOrders = useMemo(
      () =>
        filteredAllOrders.filter(
          (o) =>
            !o.scheduledFor &&
            o.stage !== "delivered" &&
            o.stage !== "cancelled",
        ),
      [filteredAllOrders],
    );

    const visibleKanbanColumns = useMemo(
      () =>
        ordersStore.columns.filter(
          (col) =>
            selectedStages.length === 0 || selectedStages.includes(col.id),
        ),
      [ordersStore.columns, selectedStages],
    );

    const activeOrder = selected
      ? (ordersStore.byId(selected) ?? ordersStore.byCode(selected) ?? null)
      : null;

    const activeFilterCount =
      selectedStages.length + (paymentFilter !== "all" ? 1 : 0);

    const hasActiveFilters =
      selectedStages.length > 0 ||
      paymentFilter !== "all" ||
      searchQuery.trim().length > 0;

    const resetFilters = () => {
      setSelectedStages([]);
      setPaymentFilter("all");
      setSearchQuery("");
      setSearchExpanded(false);
      setFiltersMenuOpen(false);
    };

    const toggleStageFilter = (stageId: string) => {
      setSelectedStages((prev) => {
        const exists = prev.includes(stageId);
        const next = exists
          ? prev.filter((id) => id !== stageId)
          : [...prev, stageId];

        // Sync OrdersListView activeGroup immediately so selecting any stage
        // ("En camino", "Programados", "Finalizadas", etc.) shows matching rows
        if (!exists) {
          setActiveGroup(stageToListGroup(stageId));
        } else if (next.length > 0) {
          setActiveGroup(stageToListGroup(next[next.length - 1]));
        }
        return next;
      });
    };

    const handleListGroupChange = (nextGroup: ListGroupId) => {
      setActiveGroup(nextGroup);
      // Clear toolbar stage filters if they belong to a different group so tabs never fight
      if (
        selectedStages.length > 0 &&
        !selectedStages.some((stageId) => stageToListGroup(stageId) === nextGroup)
      ) {
        setSelectedStages([]);
      }
    };

    // Order actions
    const handleTogglePaid = (order: Order) => {
      ordersStore.togglePaid(order.id, operatorName);
      const updated = ordersStore.byId(order.id);
      if (updated?.paid) {
        conversationsStore?.notifyOrderEvent(updated, "paid", businessName);
      }
    };

    const handleAdvanceOrder = (order: Order, nextStage: OrderStage) => {
      if (nextStage === "delivered") {
        setDeliverTarget(order);
        return;
      }
      const res = ordersStore.moveOrder(
        order.id,
        nextStage,
        operatorName,
        isAdmin ? undefined : stages,
      );
      if (!res.ok) {
        showToast(res.error ?? "No se pudo avanzar el pedido.", "error");
        return;
      }
      const updated = ordersStore.byId(order.id);
      if (updated) {
        conversationsStore?.notifyOrderEvent(
          updated,
          stageToNotificationEvent(nextStage),
          businessName,
        );
      }
      const colLabel =
        ordersStore.columns.find((c) => c.id === nextStage)?.label ??
        STAGE_LABELS[nextStage] ??
        nextStage;
      showToast(`${order.code} movido a ${colLabel}.`);
    };

    const handleDropOnColumn = (e: React.DragEvent, targetColumn: OrderColumn) => {
      e.preventDefault();
      const orderId = e.dataTransfer.getData("text/plain") || draggedOrderId;
      setDraggedOrderId(null);
      setDragOverColumnId(null);
      if (!orderId) return;

      const order = ordersStore.byId(orderId);
      if (!order || order.stage === targetColumn.id) return;

      if (!isAdmin && !canOperatorMoveTo(targetColumn.id, stages)) {
        showToast(
          `No tienes permiso para mover pedidos a «${targetColumn.label}».`,
          "error",
        );
        return;
      }

      const res = ordersStore.moveOrder(
        order.id,
        targetColumn.id,
        operatorName,
        isAdmin ? undefined : stages,
      );
      if (!res.ok) {
        showToast(res.error ?? "No se pudo mover el pedido.", "error");
        return;
      }

      const updated = ordersStore.byId(order.id);
      if (updated) {
        conversationsStore?.notifyOrderEvent(
          updated,
          stageToNotificationEvent(targetColumn.id),
          businessName,
        );
      }

      setJustDroppedId(order.id);
      window.setTimeout(
        () => setJustDroppedId((curr) => (curr === order.id ? null : curr)),
        1200,
      );
      showToast(`${order.code} movido a ${targetColumn.label}.`);
    };

    const handleDownloadCsv = () => {
      const target =
        viewMode === "kanban" ? filteredActiveOrders : filteredAllOrders;
      if (target.length === 0) {
        showToast("No hay pedidos visibles para exportar.", "error");
        return;
      }
      const mode =
        viewMode === "lista" && activeGroup === "preparing"
          ? "guides"
          : "orders";
      const filename = exportOrdersToCsv(target, ordersStore.columns, mode);
      showToast(`Exportado correctamente (${filename}).`);
    };

    const scheduledCount = ordersStore.scheduledOrders.length;
    const isScrollableKanban = visibleKanbanColumns.length > 5;
    const onlyScheduledFiltered =
      selectedStages.length > 0 &&
      selectedStages.every((s) => s === "scheduled");

    return (
      <div className="flex flex-col gap-4 font-sans">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-title dark:text-white">
              Gestión de pedidos
            </h1>
            <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
              Administra el tablero operativo, seguimiento de entregas y pedidos programados de{" "}
              <strong className="font-semibold text-ink-body dark:text-gray-200">
                {businessName}
              </strong>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Purple Programados pill ONLY when scheduledOrders.length > 0 */}
            {scheduledCount > 0 && (
              <button
                type="button"
                onClick={() => setScheduledListOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 text-xs font-semibold text-violet-700 shadow-theme-xs transition-colors hover:bg-violet-100 cursor-pointer dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25"
              >
                <CalendarDaysIcon className="size-4 text-violet-600 dark:text-violet-300" />
                <span>Programados</span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10.5px] font-bold text-white tabular-nums">
                  {scheduledCount}
                </span>
              </button>
            )}

            {canCreateOrder && (
              <Button
                variant="primary"
                size="md"
                startIcon={<PlusIcon className="size-4" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Nuevo pedido
              </Button>
            )}
          </div>
        </header>

        {/* Toast banner */}
        {toast && (
          <div
            role="status"
            className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-theme-xs ${
              toast.tone === "error"
                ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.tone === "error" ? (
                <ExclamationTriangleIcon className="size-4 shrink-0" />
              ) : (
                <CheckCircleIcon className="size-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Cerrar aviso"
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <XMarkIcon className="size-4" />
            </button>
          </div>
        )}

        {/* Compact StockFlow Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle: Inicio (Kanban) / Lista */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200/80 bg-gray-100/90 p-1 dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              aria-pressed={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white text-ink-title shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:text-ink-body dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <GridIcon className="size-3.5" />
              Inicio
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "lista"}
              onClick={() => setViewMode("lista")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "lista"
                  ? "bg-white text-ink-title shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:text-ink-body dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <ListIcon className="size-3.5" />
              Lista
            </button>
          </div>

          {/* Expandable Search */}
          <div
            className={`relative flex items-center transition-all duration-200 ${
              searchExpanded || searchQuery ? "w-64 sm:w-72" : "w-10"
            }`}
          >
            {searchExpanded || searchQuery ? (
              <div className="relative w-full">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery.trim()) setSearchExpanded(false);
                  }}
                  placeholder="Buscar cliente, código, guía…"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-8 text-xs text-ink-body shadow-theme-xs outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchExpanded(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <XMarkIcon className="size-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                aria-label="Buscar pedidos"
                title="Buscar pedidos"
                onClick={() => setSearchExpanded(true)}
                className="flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-theme-xs transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <MagnifyingGlassIcon className="size-4" />
              </button>
            )}
          </div>

          {/* Refresh / Reset Filters */}
          <button
            type="button"
            title="Restablecer filtros y refrescar"
            aria-label="Restablecer filtros"
            onClick={() => {
              resetFilters();
              ordersStore.tickScheduledOrders();
              showToast("Tablero actualizado.");
            }}
            className="flex size-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-theme-xs transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowPathIcon className="size-4" />
          </button>

          {/* Unified Estados & Pago Filter Dropdown */}
          <div ref={filtersDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersMenuOpen((v) => !v)}
              aria-expanded={filtersMenuOpen}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-theme-xs transition-colors cursor-pointer ${
                activeFilterCount > 0
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <FunnelIcon className="size-3.5" />
              <span>Estados</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filtersMenuOpen && (
              <div className="absolute left-0 top-11 z-40 w-64 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-1.5 flex items-center justify-between px-1.5 pt-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
                    Filtrar por etapa
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStages([]);
                        setPaymentFilter("all");
                      }}
                      className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer dark:text-brand-400"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="space-y-0.5">
                  {allStageOptions.map((stage) => {
                    const checked = selectedStages.includes(stage.id);
                    const count = stageCounts[stage.id] ?? 0;
                    return (
                      <label
                        key={stage.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStageFilter(stage.id)}
                            className="size-3.5 rounded accent-brand-500"
                          />
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="font-medium text-ink-body dark:text-gray-200">
                            {stage.label}
                          </span>
                        </span>
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Payment filter chips inside dropdown (no redundant select) */}
                <div className="mt-2.5 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                  <span className="mb-1.5 block px-1.5 text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
                    Estado de pago
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: "all", label: "Todos" },
                        { id: "paid", label: "Pagados" },
                        { id: "pending", label: "Pendientes" },
                      ] as const
                    ).map((opt) => {
                      const active = paymentFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPaymentFilter(opt.id)}
                          className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                            active
                              ? "bg-brand-500 text-white shadow-theme-xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200/80 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sort asc/desc toggle */}
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            title={
              sortDir === "desc"
                ? "Ordenar: más antiguos primero"
                : "Ordenar: más recientes primero"
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {sortDir === "desc" ? (
              <BarsArrowDownIcon className="size-4 text-gray-500" />
            ) : (
              <BarsArrowUpIcon className="size-4 text-gray-500" />
            )}
            <span className="hidden sm:inline">
              {sortDir === "desc" ? "Más recientes" : "Más antiguos"}
            </span>
          </button>

          {/* CSV download button */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            title="Descargar pedidos en CSV"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ArrowDownTrayIcon className="size-4 text-gray-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Right-aligned contextual actions: + Nueva columna (admin only in Kanban) + Incidents shortcut */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {viewMode === "kanban" && isAdmin && (
              <button
                type="button"
                onClick={() => setColumnModal({ open: true, mode: "create" })}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:border-brand-400 hover:bg-brand-25 hover:text-brand-600 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-brand-500"
              >
                <PlusIcon className="size-4" />
                <span>Nueva columna</span>
              </button>
            )}

            {incidentsStore.pendingCount > 0 && (
              <button
                type="button"
                onClick={openIncidents}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
              >
                <ExclamationTriangleIcon className="size-4" />
                <span>
                  {incidentsStore.pendingCount}{" "}
                  {incidentsStore.pendingCount === 1
                    ? "novedad abierta"
                    : "novedades abiertas"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedStages.map((stageId) => {
              const label =
                allStageOptions.find((s) => s.id === stageId)?.label ?? stageId;
              return (
                <span
                  key={stageId}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => toggleStageFilter(stageId)}
                    aria-label={`Quitar filtro ${label}`}
                    className="hover:text-brand-900 cursor-pointer"
                  >
                    <XMarkIcon className="size-3" />
                  </button>
                </span>
              );
            })}

            {paymentFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                Pago: {paymentFilter === "paid" ? "Pagados" : "Pendientes"}
                <button
                  type="button"
                  onClick={() => setPaymentFilter("all")}
                  aria-label="Quitar filtro de pago"
                  className="hover:text-brand-900 cursor-pointer"
                >
                  <XMarkIcon className="size-3" />
                </button>
              </span>
            )}

            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                Búsqueda: «{searchQuery.trim()}»
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Quitar búsqueda"
                  className="cursor-pointer"
                >
                  <XMarkIcon className="size-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="ml-1 text-xs font-semibold text-brand-600 hover:underline cursor-pointer dark:text-brand-400"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Main Workspace: Kanban vs Lista */}
        {viewMode === "kanban" ? (
          visibleKanbanColumns.length === 0 ? (
            /* Explanatory empty state when filtering only closed or scheduled stages in Kanban */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300">
                <ListIcon className="size-6" />
              </span>
              <h2 className="mt-4 text-base font-bold text-ink-title dark:text-white">
                {onlyScheduledFiltered
                  ? "Los pedidos programados se gestionan en Lista"
                  : "Los pedidos finalizados viven en la vista de Lista e Historial"}
              </h2>
              <p className="mt-1.5 max-w-md text-xs text-gray-500 dark:text-gray-400">
                {onlyScheduledFiltered
                  ? "El tablero Kanban muestra únicamente pedidos activos en curso. Cambia a la vista de Lista para revisar o activar tus pedidos programados."
                  : "El tablero Kanban muestra los pedidos activos del día. Cambia a la vista de Lista para consultar pedidos entregados y cancelados con sus motivos y métricas."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  startIcon={<ListIcon className="size-4" />}
                  onClick={() => {
                    setActiveGroup(onlyScheduledFiltered ? "scheduled" : "closed");
                    setViewMode("lista");
                  }}
                >
                  Ver en Lista / Historial
                </Button>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Volver al tablero activo
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={
                isScrollableKanban
                  ? "flex items-start gap-3.5 overflow-x-auto pb-4 custom-scrollbar"
                  : `${kanbanGridClass(visibleKanbanColumns.length)} items-start pb-4`
              }
            >
              {visibleKanbanColumns.map((column, colIdx, visibleCols) => {
                const colOrders = filteredActiveOrders.filter(
                  (order) => order.stage === column.id,
                );
                const canDropHere =
                  Boolean(draggedOrderId) &&
                  (isAdmin || canOperatorMoveTo(column.id, stages));
                const isDragOver = dragOverColumnId === column.id;
                const realIdx = ordersStore.columns.findIndex(
                  (c) => c.id === column.id,
                );

                return (
                  <section
                    key={column.id}
                    onDragOver={(e) => {
                      if (!draggedOrderId) return;
                      e.preventDefault();
                      if (dragOverColumnId !== column.id) {
                        setDragOverColumnId(column.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverColumnId((curr) =>
                          curr === column.id ? null : curr,
                        );
                      }
                    }}
                    onDrop={(e) => handleDropOnColumn(e, column)}
                    className={`flex min-w-0 flex-col rounded-2xl border p-3 transition-all duration-150 ${
                      isScrollableKanban ? "w-[290px] shrink-0" : "w-full"
                    } ${
                      isDragOver
                        ? canDropHere
                          ? "border-brand-500 bg-brand-25/80 ring-2 ring-brand-500/25 dark:bg-brand-500/10"
                          : "border-error-400 bg-error-25/70 dark:bg-error-500/10"
                        : "border-gray-200/90 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/50"
                    }`}
                  >
                    {/* Column Header */}
                    <div className="mb-3 flex items-center justify-between gap-2 px-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        <h2 className="truncate text-xs font-bold uppercase tracking-wide text-ink-body dark:text-white">
                          {column.label}
                        </h2>
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold tabular-nums text-gray-600 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                          {colOrders.length}
                        </span>
                      </div>

                      {/* Admin-only Column ⋯ CRUD menu */}
                      {isAdmin && (
                        <div
                          ref={
                            openColMenuId === column.id ? colMenuRef : undefined
                          }
                          className="relative shrink-0"
                        >
                          <button
                            type="button"
                            aria-label={`Opciones de columna ${column.label}`}
                            onClick={() =>
                              setOpenColMenuId((prev) =>
                                prev === column.id ? null : column.id,
                              )
                            }
                            className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
                          >
                            <EllipsisHorizontalIcon className="size-4" />
                          </button>

                          {openColMenuId === column.id && (
                            <div
                              role="menu"
                              className="absolute right-0 top-8 z-40 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenColMenuId(null);
                                  setColumnModal({
                                    open: true,
                                    mode: "rename",
                                    columnId: column.id,
                                    initialLabel: column.label,
                                    initialColor: column.color,
                                  });
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <PencilIcon className="size-3.5 text-gray-400" />
                                Renombrar
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                disabled={realIdx <= 0}
                                onClick={() => {
                                  setOpenColMenuId(null);
                                  ordersStore.moveColumn(column.id, "left");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <ArrowLeftIcon className="size-3.5 text-gray-400" />
                                Mover izquierda
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                disabled={
                                  realIdx >= ordersStore.columns.length - 1 ||
                                  (colIdx === visibleCols.length - 1 &&
                                    realIdx >= ordersStore.columns.length - 1)
                                }
                                onClick={() => {
                                  setOpenColMenuId(null);
                                  ordersStore.moveColumn(column.id, "right");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <ArrowRightIcon className="size-3.5 text-gray-400" />
                                Mover derecha
                              </button>

                              {!column.isDefault && (
                                <>
                                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenColMenuId(null);
                                      const res = ordersStore.deleteColumn(
                                        column.id,
                                      );
                                      if (!res.ok) {
                                        showToast(
                                          res.error ?? "No se pudo eliminar.",
                                          "error",
                                        );
                                      } else {
                                        showToast(
                                          `Columna «${column.label}» eliminada.`,
                                        );
                                      }
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-error-600 hover:bg-error-50 cursor-pointer dark:text-error-400 dark:hover:bg-error-500/10"
                                  >
                                    <TrashIcon className="size-3.5" />
                                    Eliminar columna
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Internally scrollable Cards Stack */}
                    <div className="flex max-h-[calc(100vh-17rem)] min-h-[220px] flex-col gap-2.5 overflow-y-auto pr-0.5 custom-scrollbar">
                      {colOrders.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200/90 px-4 py-10 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                          {isDragOver
                            ? canDropHere
                              ? "Suelta aquí para mover"
                              : "Sin permiso para esta etapa"
                            : "Sin pedidos en esta etapa"}
                        </div>
                      ) : (
                        colOrders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            columns={ordersStore.columns}
                            columnColor={column.color}
                            allowedStages={
                              isAdmin
                                ? ["confirmation", "preparation", "dispatch"]
                                : stages
                            }
                            canDrag={canDragCards}
                            isDragging={draggedOrderId === order.id}
                            isJustDropped={
                              justDroppedId === order.id ||
                              focusedOrderId === order.id
                            }
                            canCancel={canCancel}
                            canSchedule={canSchedule}
                            canReportIncident={canReportIncident}
                            onSelect={(o) => setSelected(o.id)}
                            onTogglePaid={handleTogglePaid}
                            onAdvance={handleAdvanceOrder}
                            onSchedule={(o) => setScheduleTarget(o)}
                            onReportIncident={(o) => setIncidentTarget(o)}
                            onCancel={(o) => setCancelTarget(o)}
                            onOpenChat={onOpenChat}
                            onDragStart={(e, o) => {
                              e.dataTransfer.setData("text/plain", o.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggedOrderId(o.id);
                            }}
                            onDragEnd={() => {
                              setDraggedOrderId(null);
                              setDragOverColumnId(null);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </section>
                );
              })}

              {isScrollableKanban && isAdmin && (
                <button
                  type="button"
                  onClick={() => setColumnModal({ open: true, mode: "create" })}
                  className="flex h-14 w-56 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 text-xs font-bold text-gray-600 transition-colors hover:border-brand-400 hover:bg-brand-25 hover:text-brand-600 cursor-pointer dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300 dark:hover:border-brand-500"
                >
                  <PlusIcon className="size-4" />
                  Nueva columna
                </button>
              )}
            </div>
          )
        ) : (
          <OrdersListView
            orders={filteredAllOrders}
            columns={ordersStore.columns}
            allowedStages={
              isAdmin ? ["confirmation", "preparation", "dispatch"] : stages
            }
            activeGroup={activeGroup}
            onGroupChange={handleListGroupChange}
            canCancel={canCancel}
            canSchedule={canSchedule}
            canReportIncident={canReportIncident}
            onSelect={(o) => setSelected(o.id)}
            onTogglePaid={handleTogglePaid}
            onAdvance={handleAdvanceOrder}
            onActivateScheduled={(o) => {
              ordersStore.activateScheduledOrder(o.id, operatorName);
              showToast(`Pedido ${o.code} activado en el tablero.`);
            }}
            onReschedule={(o) => setScheduleTarget(o)}
            onReportIncident={(o) => setIncidentTarget(o)}
            onRetryDelivery={(o) => {
              const res = ordersStore.moveOrder(
                o.id,
                "ready",
                operatorName,
                isAdmin ? undefined : stages,
              );
              if (!res.ok) {
                showToast(
                  res.error ?? "No se pudo reintentar la entrega.",
                  "error",
                );
              } else {
                const updated = ordersStore.byId(o.id);
                if (updated) {
                  conversationsStore?.notifyOrderEvent(
                    updated,
                    "ready",
                    businessName,
                  );
                }
                showToast(
                  `${o.code} devuelto a Listo para reintento de entrega.`,
                );
              }
            }}
            onUnassignCarrier={(o) => {
              ordersStore.unassignCarrier(o.id, operatorName);
              showToast(`Transportadora desasignada de ${o.code}.`);
            }}
            onCancel={(o) => setCancelTarget(o)}
            onBulkCancel={(ids) => setBulkCancelIds(ids)}
            onOpenChat={onOpenChat}
            onExportSuccess={(msg) => showToast(msg)}
          />
        )}

        {/* Modals */}
        <CreateOrderModal
          open={createModalOpen}
          businessName={businessName}
          businessId={businessId}
          operatorName={operatorName}
          ordersStore={ordersStore}
          catalogProducts={catalogProducts}
          modalities={modalities}
          onSendReceiptToChat={
            conversationsStore || onOpenChat
              ? (order, message) => {
                  conversationsStore?.sendOrderReceiptToChat(
                    order.customerPhone,
                    order,
                    message,
                    operatorName,
                    operatorName,
                  );
                  showToast(`Comprobante de ${order.code} enviado al chat.`);
                  onOpenChat?.(order);
                }
              : undefined
          }
          onClose={() => setCreateModalOpen(false)}
          onOpenCatalog={openCatalog}
          onGoToDetail={(created) => setSelected(created.id)}
        />

        <OrderDetailModal
          open={Boolean(activeOrder)}
          order={activeOrder}
          businessName={businessName}
          businessId={businessId}
          operatorName={operatorName}
          allowedStages={
            isAdmin ? ["confirmation", "preparation", "dispatch"] : stages
          }
          ordersStore={ordersStore}
          incidentsStore={incidentsStore}
          conversationsStore={conversationsStore}
          onClose={() => {
            setSelected("");
            if (searchParams.has("detalle")) {
              const next = new URLSearchParams(searchParams);
              next.delete("detalle");
              lastWrittenQueryRef.current = next.toString();
              setSearchParams(next, { replace: true });
            }
          }}
          onOpenChat={onOpenChat}
          onOpenDeliveryIncident={
            canReportIncident ? (o) => setIncidentTarget(o) : undefined
          }
          onOpenSchedule={canSchedule ? (o) => setScheduleTarget(o) : undefined}
          onOpenCancel={canCancel ? (o) => setCancelTarget(o) : undefined}
          onOpenDeliver={(o) => setDeliverTarget(o)}
        />

        <ScheduleOrderModal
          open={Boolean(scheduleTarget)}
          orderCode={scheduleTarget?.code}
          initialIso={scheduleTarget?.scheduledFor}
          scheduledOrders={ordersStore.scheduledOrders}
          onViewOrder={(orderId) => {
            setScheduleTarget(null);
            setSelected(orderId);
          }}
          onClose={() => setScheduleTarget(null)}
          onConfirm={(iso) => {
            if (scheduleTarget) {
              ordersStore.scheduleOrder(scheduleTarget.id, iso, operatorName);
              showToast(`Pedido ${scheduleTarget.code} programado correctamente.`);
            }
            setScheduleTarget(null);
          }}
        />

        <ScheduledOrdersModal
          open={scheduledListOpen}
          ordersStore={ordersStore}
          operatorName={operatorName}
          onClose={() => setScheduledListOpen(false)}
          onSelectOrder={(o) => setSelected(o.id)}
          onReschedule={(o) => setScheduleTarget(o)}
          onCancelOrder={(o) => setCancelTarget(o)}
          onActivated={(o) =>
            showToast(`Pedido ${o.code} activado manualmente en el tablero.`)
          }
        />

        <DeliveryIncidentModal
          open={Boolean(incidentTarget)}
          order={incidentTarget}
          operatorName={operatorName}
          allowedStages={stages}
          isAdmin={isAdmin}
          ordersStore={ordersStore}
          incidentsStore={incidentsStore}
          onClose={() => setIncidentTarget(null)}
          onSubmitted={(outcome, o) => {
            const updated = ordersStore.byId(o.id) ?? o;
            conversationsStore?.notifyOrderEvent(
              updated,
              "delivery_incident",
              businessName,
            );
            showToast(
              outcome === "cancel"
                ? `Novedad registrada y pedido ${o.code} cancelado.`
                : `Novedad registrada. ${o.code} devuelto a Listo para reintento.`,
            );
          }}
        />

        <CancelOrderModal
          open={Boolean(cancelTarget) || bulkCancelIds.length > 0}
          order={cancelTarget}
          bulkCount={bulkCancelIds.length}
          onClose={() => {
            setCancelTarget(null);
            setBulkCancelIds([]);
          }}
          onConfirm={(reason) => {
            if (cancelTarget) {
              ordersStore.cancelOrder(cancelTarget.id, reason, operatorName);
              const updated = ordersStore.byId(cancelTarget.id);
              if (updated) {
                conversationsStore?.notifyOrderEvent(
                  updated,
                  "cancelled",
                  businessName,
                );
              }
              showToast(`Pedido ${cancelTarget.code} cancelado.`);
              setCancelTarget(null);
            } else if (bulkCancelIds.length > 0) {
              const idsToNotify = [...bulkCancelIds];
              const count = idsToNotify.length;
              ordersStore.bulkCancelOrders(idsToNotify, reason, operatorName);
              for (const id of idsToNotify) {
                const updated = ordersStore.byId(id);
                if (updated) {
                  conversationsStore?.notifyOrderEvent(
                    updated,
                    "cancelled",
                    businessName,
                  );
                }
              }
              showToast(
                `${count} ${count === 1 ? "pedido cancelado" : "pedidos cancelados"}.`,
              );
              setBulkCancelIds([]);
            }
          }}
        />

        <DeliverOrderModal
          open={Boolean(deliverTarget)}
          order={deliverTarget}
          onClose={() => setDeliverTarget(null)}
          onConfirm={() => {
            if (deliverTarget) {
              ordersStore.deliverOrder(deliverTarget.id, operatorName);
              const updated = ordersStore.byId(deliverTarget.id);
              if (updated) {
                conversationsStore?.notifyOrderEvent(
                  updated,
                  "delivered",
                  businessName,
                );
              }
              showToast(`Pedido ${deliverTarget.code} marcado como entregado.`);
              if (selected === deliverTarget.id) setSelected("");
            }
            setDeliverTarget(null);
          }}
        />

        <ColumnFormModal
          open={columnModal.open}
          mode={columnModal.mode}
          initialLabel={columnModal.initialLabel}
          initialColor={columnModal.initialColor}
          onClose={() => setColumnModal((prev) => ({ ...prev, open: false }))}
          onSubmit={(label, color) => {
            if (columnModal.mode === "create") {
              const res = ordersStore.addColumn(label, color);
              if (res.ok) showToast(`Columna «${label}» creada.`);
              return res;
            }
            if (columnModal.columnId) {
              const res = ordersStore.renameColumn(columnModal.columnId, label);
              if (res.ok) showToast(`Columna renombrada a «${label}».`);
              return res;
            }
            return { ok: false, error: "Columna no encontrada." };
          }}
        />
      </div>
    );
  },
);

export default OrdersPage;
