import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { observer } from "mobx-react-lite";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FireIcon,
  NoSymbolIcon,
  PlayIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { OrderOperatorStage } from "../../types";
import { buildCsv, downloadCsv, ymdLocal } from "../csv";
import { carrierByName } from "../domain/carrierDirectory";
import {
  canOperatorMoveTo,
  CHANNEL_LABELS,
  formatCOP,
  formatElapsedSLA,
  MODALITY_LABELS,
  nextStageFor,
  PAYMENT_METHOD_LABELS,
  STAGE_LABELS,
  type Order,
  type OrderColumn,
  type OrderStage,
} from "../domain/order";
import { CarrierLogo } from "./CarrierLogo";

export type ListGroupId =
  | "to_prepare"
  | "preparing"
  | "in_transit"
  | "scheduled"
  | "closed";

type SubFilterId =
  | "all"
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export interface OrdersListViewProps {
  orders: Order[];
  columns: OrderColumn[];
  allowedStages: OrderOperatorStage[];
  activeGroup?: ListGroupId;
  onGroupChange?: (group: ListGroupId) => void;
  canCancel?: boolean;
  canSchedule?: boolean;
  canReportIncident?: boolean;
  onSelect: (order: Order) => void;
  onTogglePaid: (order: Order) => void;
  onAdvance: (order: Order, nextStage: OrderStage) => void;
  onActivateScheduled: (order: Order) => void;
  onReschedule: (order: Order) => void;
  onReportIncident: (order: Order) => void;
  onRetryDelivery: (order: Order) => void;
  onUnassignCarrier: (order: Order) => void;
  onCancel: (order: Order) => void;
  onBulkCancel: (orderIds: string[]) => void;
  onOpenChat?: (order: Order) => void;
  onExportSuccess?: (message: string) => void;
}

const CONTEXTUAL_COLUMN_HEADERS: Record<ListGroupId, string> = {
  to_prepare: "Confirmación",
  preparing: "Preparación",
  in_transit: "Transportadora y guía",
  scheduled: "Fecha programada",
  closed: "Resultado y motivo",
};

function isScheduledOrder(order: Order): boolean {
  return (
    Boolean(order.scheduledFor) &&
    order.stage !== "delivered" &&
    order.stage !== "cancelled"
  );
}

export function resolveOrderListGroup(order: Order): ListGroupId {
  if (order.stage === "delivered" || order.stage === "cancelled") return "closed";
  if (isScheduledOrder(order)) return "scheduled";
  if (order.stage === "new" || order.stage === "confirmed") return "to_prepare";
  if (order.stage === "in_transit") return "in_transit";
  return "preparing";
}

function resolveNextStage(order: Order, columns: OrderColumn[]): OrderStage | null {
  let next = nextStageFor(order.stage, columns);
  if (next === "in_transit" && order.modality !== "delivery") {
    next = "delivered";
  }
  return next;
}

function resolveStageLabel(stage: OrderStage, columns: OrderColumn[]): string {
  return columns.find((col) => col.id === stage)?.label ?? STAGE_LABELS[stage] ?? stage;
}

function formatDateTimeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "";
  const diffSec = Math.floor((target - now.getTime()) / 1000);
  if (diffSec <= 0) return "Activando…";
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `En ${days} d ${hours} h`;
  if (hours > 0) return `En ${hours} h ${mins} min`;
  return `En ${Math.max(1, mins)} min`;
}

export function exportOrdersToCsv(
  orders: Order[],
  columns: OrderColumn[],
  mode: "orders" | "guides",
): string {
  const dateStamp = ymdLocal(new Date());
  if (mode === "guides") {
    const headers = [
      "Código",
      "Destinatario",
      "Teléfono",
      "Dirección",
      "Barrio",
      "Referencia",
      "Ciudad",
      "Departamento",
      "Transportadora",
      "Guía",
      "Recaudo",
      "Total COP",
      "Productos",
      "Notas",
    ];
    const rows = orders.map((o) => [
      o.code,
      o.customerName,
      o.customerPhone,
      o.address?.street ??
        (o.modality === "pickup" ? "Retiro en tienda" : o.table ?? "En sitio"),
      o.address?.neighborhood ?? "",
      o.address?.reference ?? "",
      o.address?.city ?? "",
      o.address?.department ?? "",
      o.carrier ?? "Sin asignar",
      o.trackingNumber ?? "",
      o.paid ? "Pagado" : PAYMENT_METHOD_LABELS[o.paymentMethod],
      o.total,
      o.items.map((i) => `${i.quantity}x ${i.name}`).join(" | "),
      o.notes ?? "",
    ]);
    const filename = `guias-${dateStamp}.csv`;
    downloadCsv(buildCsv(headers, rows), filename);
    return filename;
  }

  const headers = [
    "Código",
    "Estado",
    "Fecha creación",
    "Cliente",
    "Teléfono",
    "Modalidad",
    "Canal",
    "Productos",
    "Subtotal",
    "Envío",
    "Total COP",
    "Medio de pago",
    "Estado pago",
    "Transportadora",
    "Guía",
    "Notas",
  ];
  const rows = orders.map((o) => [
    o.code,
    resolveStageLabel(o.stage, columns),
    new Date(o.createdAt).toLocaleString("es-CO"),
    o.customerName,
    o.customerPhone,
    MODALITY_LABELS[o.modality],
    CHANNEL_LABELS[o.channel],
    o.items
      .map((i) => `${i.quantity}x ${i.name}${i.variant ? ` (${i.variant})` : ""}`)
      .join(" | "),
    o.subtotal,
    o.shippingFee,
    o.total,
    PAYMENT_METHOD_LABELS[o.paymentMethod],
    o.paid ? "Pagado" : "Pendiente",
    o.carrier ?? "",
    o.trackingNumber ?? "",
    o.notes ?? "",
  ]);
  const filename = `pedidos-${dateStamp}.csv`;
  downloadCsv(buildCsv(headers, rows), filename);
  return filename;
}

interface PortalMenuState {
  orderId: string;
  top?: number;
  bottom?: number;
  left: number;
}

const MENU_WIDTH = 228;
const MENU_ESTIMATED_HEIGHT = 310;

export const OrdersListView = observer(
  ({
    orders,
    columns,
    allowedStages,
    activeGroup: controlledGroup,
    onGroupChange,
    canCancel: canCancelProp,
    canSchedule: canScheduleProp,
    canReportIncident: canReportIncidentProp,
    onSelect,
    onTogglePaid,
    onAdvance,
    onActivateScheduled,
    onReschedule,
    onReportIncident,
    onRetryDelivery,
    onUnassignCarrier,
    onCancel,
    onBulkCancel,
    onOpenChat,
    onExportSuccess,
  }: OrdersListViewProps) => {
    const [uncontrolledGroup, setUncontrolledGroup] =
      useState<ListGroupId>("to_prepare");
    const activeGroup = controlledGroup ?? uncontrolledGroup;

    const [subFilter, setSubFilter] = useState<SubFilterId>("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [portalMenu, setPortalMenu] = useState<PortalMenuState | null>(null);
    const [now, setNow] = useState<Date>(() => new Date());
    const portalMenuRef = useRef<HTMLDivElement>(null);

    const defaultOpAction =
      allowedStages.includes("confirmation") ||
      allowedStages.includes("dispatch");
    const canCancelAction = canCancelProp ?? defaultOpAction;
    const canScheduleAction = canScheduleProp ?? defaultOpAction;
    const canReportIncidentAction = canReportIncidentProp ?? defaultOpAction;

    // 1-second live SLA ticker
    useEffect(() => {
      const interval = window.setInterval(() => setNow(new Date()), 1000);
      return () => window.clearInterval(interval);
    }, []);

    // Reset subFilter & selection when group changes
    useEffect(() => {
      setSubFilter("all");
      setSelectedIds([]);
      setPortalMenu(null);
    }, [activeGroup]);

    // Close portal menu on Escape, outside click, scroll (any container), or resize
    useEffect(() => {
      if (!portalMenu) return;
      const handleMouseDown = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (portalMenuRef.current && target && portalMenuRef.current.contains(target)) {
          return;
        }
        if (target?.closest("[data-row-menu-trigger='true']")) {
          return;
        }
        setPortalMenu(null);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setPortalMenu(null);
      };
      const handleClose = () => setPortalMenu(null);

      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("keydown", handleKeyDown);
      window.addEventListener("scroll", handleClose, true);
      window.addEventListener("resize", handleClose);

      return () => {
        document.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("scroll", handleClose, true);
        window.removeEventListener("resize", handleClose);
      };
    }, [portalMenu]);

    // Bucket orders into the 5 groups
    const grouped = useMemo(() => {
      const buckets: Record<ListGroupId, Order[]> = {
        to_prepare: [],
        preparing: [],
        in_transit: [],
        scheduled: [],
        closed: [],
      };
      for (const order of orders) {
        buckets[resolveOrderListGroup(order)].push(order);
      }
      return buckets;
    }, [orders]);

    const currentGroupOrders = grouped[activeGroup];

    const subChips = useMemo(() => {
      if (activeGroup === "to_prepare") {
        const newCount = currentGroupOrders.filter((o) => o.stage === "new").length;
        const confCount = currentGroupOrders.filter(
          (o) => o.stage === "confirmed",
        ).length;
        return [
          { id: "all" as const, label: "Todos", count: currentGroupOrders.length },
          { id: "new" as const, label: "Nuevos", count: newCount },
          { id: "confirmed" as const, label: "Confirmados", count: confCount },
        ];
      }
      if (activeGroup === "preparing") {
        const prepCount = currentGroupOrders.filter(
          (o) => o.stage === "preparing",
        ).length;
        const readyCount = currentGroupOrders.filter(
          (o) => o.stage === "ready",
        ).length;
        return [
          { id: "all" as const, label: "Todos", count: currentGroupOrders.length },
          { id: "preparing" as const, label: "En preparación", count: prepCount },
          { id: "ready" as const, label: "Listos", count: readyCount },
        ];
      }
      if (activeGroup === "closed") {
        const delCount = currentGroupOrders.filter(
          (o) => o.stage === "delivered",
        ).length;
        const canCount = currentGroupOrders.filter(
          (o) => o.stage === "cancelled",
        ).length;
        return [
          { id: "all" as const, label: "Todas", count: currentGroupOrders.length },
          { id: "delivered" as const, label: "Entregadas", count: delCount },
          { id: "cancelled" as const, label: "Canceladas", count: canCount },
        ];
      }
      return [];
    }, [activeGroup, currentGroupOrders]);

    const visibleOrders = useMemo(() => {
      if (subFilter === "all") return currentGroupOrders;
      return currentGroupOrders.filter((o) => o.stage === subFilter);
    }, [currentGroupOrders, subFilter]);

    // Clear stale selections when filtered list changes
    useEffect(() => {
      const visibleSet = new Set(visibleOrders.map((o) => o.id));
      setSelectedIds((prev) => prev.filter((id) => visibleSet.has(id)));
    }, [visibleOrders]);

    const totalCopValue = useMemo(
      () => visibleOrders.reduce((sum, order) => sum + order.total, 0),
      [visibleOrders],
    );

    const allVisibleSelected =
      visibleOrders.length > 0 &&
      visibleOrders.every((o) => selectedIds.includes(o.id));

    const toggleSelectAll = () => {
      if (allVisibleSelected) {
        setSelectedIds([]);
      } else {
        setSelectedIds(visibleOrders.map((o) => o.id));
      }
    };

    const toggleRowSelection = (orderId: string) => {
      setSelectedIds((prev) =>
        prev.includes(orderId)
          ? prev.filter((id) => id !== orderId)
          : [...prev, orderId],
      );
    };

    const handleGroupSelect = (group: ListGroupId) => {
      if (controlledGroup === undefined) {
        setUncontrolledGroup(group);
      }
      onGroupChange?.(group);
      setSubFilter("all");
      setSelectedIds([]);
      setPortalMenu(null);
    };

    const handleToggleRowMenu = (
      event: React.MouseEvent<HTMLButtonElement>,
      orderId: string,
    ) => {
      event.stopPropagation();
      if (portalMenu?.orderId === orderId) {
        setPortalMenu(null);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const openUpward = rect.bottom + MENU_ESTIMATED_HEIGHT > viewportH - 16;
      const left = Math.max(
        12,
        Math.min(rect.right - MENU_WIDTH, viewportW - MENU_WIDTH - 12),
      );

      if (openUpward) {
        setPortalMenu({
          orderId,
          bottom: Math.max(12, viewportH - rect.top + 6),
          left,
        });
      } else {
        setPortalMenu({
          orderId,
          top: rect.bottom + 6,
          left,
        });
      }
    };

    const selectedOrders = visibleOrders.filter((o) => selectedIds.includes(o.id));
    const cancellableSelectedIds = selectedOrders
      .filter((o) => o.stage !== "delivered" && o.stage !== "cancelled")
      .map((o) => o.id);

    const handleBulkExport = () => {
      const mode = activeGroup === "preparing" ? "guides" : "orders";
      const filename = exportOrdersToCsv(selectedOrders, columns, mode);
      onExportSuccess?.(
        mode === "guides"
          ? `Planilla de guías descargada (${filename})`
          : `Listado de pedidos descargado (${filename})`,
      );
    };

    const groupTabs: Array<{ id: ListGroupId; label: string; count: number }> = [
      { id: "to_prepare", label: "Por preparar", count: grouped.to_prepare.length },
      { id: "preparing", label: "En preparación", count: grouped.preparing.length },
      { id: "in_transit", label: "En camino", count: grouped.in_transit.length },
      { id: "scheduled", label: "Programados", count: grouped.scheduled.length },
      { id: "closed", label: "Finalizadas", count: grouped.closed.length },
    ];

    const menuOrder = portalMenu
      ? visibleOrders.find((o) => o.id === portalMenu.orderId) ?? null
      : null;

    return (
      <div className="space-y-3 pb-16">
        {/* Top group tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Grupos de pedidos"
            className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200/80 bg-gray-50/80 p-1.5 dark:border-gray-800 dark:bg-gray-900/70"
          >
            {groupTabs.map((tab) => {
              const active = activeGroup === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleGroupSelect(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-white text-ink-title shadow-theme-xs ring-1 ring-gray-200/80 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                      : "text-gray-600 hover:text-ink-body dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums ${
                      active
                        ? "bg-brand-500 text-white"
                        : "bg-gray-200/80 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-xs shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <span className="text-gray-500 dark:text-gray-400">
              <strong className="font-bold text-ink-body dark:text-white">
                {visibleOrders.length}
              </strong>{" "}
              {visibleOrders.length === 1 ? "pedido" : "pedidos"}
            </span>
            <span className="h-3.5 w-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-gray-500 dark:text-gray-400">
              Valor:{" "}
              <strong className="font-bold tabular-nums text-ink-title dark:text-brand-400">
                {formatCOP(totalCopValue)}
              </strong>
            </span>
          </div>
        </div>

        {/* Sub-filter chips */}
        {subChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {subChips.map((chip) => {
              const active = subFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setSubFilter(chip.id);
                    setSelectedIds([]);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span className="text-[10.5px] opacity-75 tabular-nums">
                    ({chip.count})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Full StockFlow Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los pedidos visibles"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="size-4 rounded border-gray-300 accent-brand-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3">N. Orden</th>
                  <th className="px-3 py-3">Producto</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Comprador</th>
                  <th className="px-3 py-3">
                    {CONTEXTUAL_COLUMN_HEADERS[activeGroup]}
                  </th>
                  <th className="px-3 py-3">Modalidad / Pago</th>
                  <th className="px-3 py-3 text-right">Valor</th>
                  <th className="w-12 px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No hay pedidos en esta sección con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  visibleOrders.map((order) => {
                    const isSelected = selectedIds.includes(order.id);
                    const isClosed =
                      order.stage === "delivered" || order.stage === "cancelled";
                    const isScheduled = isScheduledOrder(order);
                    const carrierObj = order.carrier
                      ? carrierByName(order.carrier)
                      : undefined;
                    const totalUnits = order.items.reduce(
                      (s, i) => s + i.quantity,
                      0,
                    );
                    const firstItem = order.items[0];
                    const extraItemsCount = Math.max(0, order.items.length - 1);
                    const isUnpaidTransfer =
                      !order.paid && order.paymentMethod === "transfer";
                    const addressPreview =
                      order.modality === "delivery"
                        ? [order.address?.street, order.address?.city]
                            .filter(Boolean)
                            .join(" · ")
                        : order.modality === "onsite"
                          ? order.table || "En sitio"
                          : "Retiro en tienda";

                    return (
                      <tr
                        key={order.id}
                        onClick={() => onSelect(order)}
                        className={`transition-colors hover:bg-gray-50/80 cursor-pointer dark:hover:bg-white/[0.02] ${
                          isSelected ? "bg-brand-25/50 dark:bg-brand-500/10" : ""
                        }`}
                      >
                        {/* 1. Checkbox */}
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${order.code}`}
                            checked={isSelected}
                            onChange={() => toggleRowSelection(order.id)}
                            className="size-4 rounded border-gray-300 accent-brand-500 cursor-pointer"
                          />
                        </td>

                        {/* 2. N. Orden + Live SLA timer */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-ink-title dark:text-brand-400">
                              {order.code}
                            </span>
                            {order.urgent && !isClosed && (
                              <span
                                title="SLA Urgente"
                                className="inline-flex items-center gap-0.5 rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-bold text-error-600 dark:bg-error-500/15 dark:text-error-400"
                              >
                                <FireIcon className="size-2.5" />
                                Urgente
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[10.5px] tabular-nums">
                            {isClosed ? (
                              <span className="text-gray-400 dark:text-gray-500">
                                {resolveStageLabel(order.stage, columns)}
                              </span>
                            ) : isScheduled ? (
                              <span className="font-semibold text-violet-600 dark:text-violet-300">
                                {formatCountdown(order.scheduledFor, now)}
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${
                                  order.urgent
                                    ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                }`}
                              >
                                <ClockIcon className="size-2.5" />
                                {formatElapsedSLA(order.createdAt, now)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Producto (first item + +N count) */}
                        <td className="px-3 py-3">
                          <div className="max-w-[190px] truncate font-semibold text-ink-body dark:text-white">
                            {firstItem?.name ?? "Sin productos"}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                            <span>
                              {totalUnits}{" "}
                              {totalUnits === 1 ? "ud." : "uds."}
                            </span>
                            {extraItemsCount > 0 && (
                              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                +{extraItemsCount}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Fecha */}
                        <td className="whitespace-nowrap px-3 py-3 text-[11.5px] text-gray-600 dark:text-gray-300">
                          {formatDateTimeShort(order.createdAt)}
                        </td>

                        {/* 5. Comprador (name + address/city preview) */}
                        <td className="px-3 py-3">
                          <div className="max-w-[180px] truncate font-semibold text-ink-body dark:text-white">
                            {order.customerName}
                          </div>
                          <div className="mt-0.5 max-w-[195px] truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {addressPreview || order.customerPhone}
                          </div>
                        </td>

                        {/* 6. Contextual column */}
                        <td className="px-3 py-3">
                          {activeGroup === "to_prepare" && (
                            <div className="max-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    order.stage === "confirmed"
                                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                  }`}
                                >
                                  {order.stage === "confirmed"
                                    ? "Confirmado"
                                    : "Pendiente confirmar"}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                Canal: {CHANNEL_LABELS[order.channel]}
                              </div>
                            </div>
                          )}

                          {activeGroup === "preparing" && (
                            <div className="max-w-[200px]">
                              <div className="font-semibold text-ink-body dark:text-gray-100">
                                {resolveStageLabel(order.stage, columns)}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                {order.modality === "delivery"
                                  ? order.carrier || "Transportadora por asignar"
                                  : order.modality === "onsite"
                                    ? order.table || "Consumo en sitio"
                                    : "Retiro en mostrador"}
                              </div>
                            </div>
                          )}

                          {activeGroup === "in_transit" && (
                            <div className="flex items-center gap-2">
                              <CarrierLogo
                                carrier={carrierObj}
                                name={order.carrier}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-ink-body dark:text-gray-100">
                                  {order.carrier || "Sin asignar"}
                                  {order.courierName ? ` · ${order.courierName}` : ""}
                                </div>
                                <div className="truncate font-mono text-[10.5px] text-gray-500 dark:text-gray-400">
                                  {order.trackingNumber
                                    ? `Guía ${order.trackingNumber}`
                                    : "Sin guía registrada"}
                                </div>
                              </div>
                            </div>
                          )}

                          {activeGroup === "scheduled" && (
                            <div>
                              <div className="font-semibold capitalize text-ink-body dark:text-gray-100">
                                {formatDateTimeShort(order.scheduledFor)}
                              </div>
                              <div className="mt-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-300">
                                {formatCountdown(order.scheduledFor, now)}
                              </div>
                            </div>
                          )}

                          {activeGroup === "closed" && (
                            <div className="max-w-[220px]">
                              {order.stage === "delivered" ? (
                                <>
                                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                                    Entregado con éxito
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                    {formatDateTimeShort(
                                      order.deliveredAt ?? order.updatedAt,
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-semibold text-error-600 dark:text-error-400">
                                    Cancelado
                                  </div>
                                  <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                    {order.cancellationReason ||
                                      "Cancelado por operador"}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 7. Modalidad / Pago */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                order.modality === "delivery"
                                  ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                                  : order.modality === "pickup"
                                    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                              }`}
                            >
                              {MODALITY_LABELS[order.modality]}
                            </span>

                            <button
                              type="button"
                              onClick={() => onTogglePaid(order)}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
                                order.paid
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : isUnpaidTransfer
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 hover:bg-amber-200/80 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/40"
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300"
                              }`}
                            >
                              {order.paid ? (
                                <CheckCircleIcon className="size-3" />
                              ) : (
                                <ClockIcon className="size-3" />
                              )}
                              {order.paid
                                ? "Pagado"
                                : isUnpaidTransfer
                                  ? "Validar pago · Transferencia"
                                  : "Pendiente"}
                            </button>
                          </div>

                          {!isUnpaidTransfer && (
                            <div className="mt-0.5 text-[10.5px] text-gray-400 dark:text-gray-500">
                              {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                            </div>
                          )}
                        </td>

                        {/* 8. Valor COP */}
                        <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-ink-body dark:text-white">
                          {formatCOP(order.total)}
                        </td>

                        {/* 9. Acciones (Portal trigger) */}
                        <td
                          className="px-3 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            data-row-menu-trigger="true"
                            aria-label={`Más acciones para ${order.code}`}
                            aria-expanded={portalMenu?.orderId === order.id}
                            onClick={(e) => handleToggleRowMenu(e, order.id)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
                          >
                            <EllipsisHorizontalIcon className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portal-mounted row action menu (never clipped by overflow containers) */}
        {portalMenu &&
          menuOrder &&
          typeof document !== "undefined" &&
          createPortal(
            (() => {
              const isClosed =
                menuOrder.stage === "delivered" ||
                menuOrder.stage === "cancelled";
              const isScheduled = isScheduledOrder(menuOrder);
              const nextStage = resolveNextStage(menuOrder, columns);
              const nextLabel = nextStage
                ? resolveStageLabel(nextStage, columns)
                : null;
              const canAdvance = Boolean(
                !isScheduled &&
                  nextStage &&
                  canOperatorMoveTo(nextStage, allowedStages),
              );
              const canRetry =
                (menuOrder.stage === "in_transit" ||
                  menuOrder.stage === "cancelled") &&
                canOperatorMoveTo("ready", allowedStages);

              return (
                <div
                  ref={portalMenuRef}
                  role="menu"
                  style={{
                    position: "fixed",
                    top: portalMenu.top,
                    bottom: portalMenu.bottom,
                    left: portalMenu.left,
                    width: MENU_WIDTH,
                    zIndex: 9999,
                  }}
                  className="rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-xl dark:border-gray-700 dark:bg-gray-900"
                >
                  {isScheduled ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPortalMenu(null);
                        onActivateScheduled(menuOrder);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-brand-600 hover:bg-brand-50 cursor-pointer dark:text-brand-400 dark:hover:bg-brand-500/10"
                    >
                      <PlayIcon className="size-3.5" />
                      Activar ahora
                    </button>
                  ) : (
                    canAdvance &&
                    nextStage &&
                    nextLabel && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPortalMenu(null);
                          onAdvance(menuOrder, nextStage);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-brand-600 hover:bg-brand-50 cursor-pointer dark:text-brand-400 dark:hover:bg-brand-500/10"
                      >
                        <ArrowRightIcon className="size-3.5" />
                        Avanzar a {nextLabel}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPortalMenu(null);
                      onSelect(menuOrder);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <EyeIcon className="size-3.5 text-gray-400" />
                    Ver detalle
                  </button>

                  {onOpenChat && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPortalMenu(null);
                        onOpenChat(menuOrder);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    >
                      <ChatBubbleLeftRightIcon className="size-3.5" />
                      Abrir conversación
                    </button>
                  )}

                  {!isClosed && canScheduleAction && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPortalMenu(null);
                        onReschedule(menuOrder);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <CalendarDaysIcon className="size-3.5 text-gray-400" />
                      {isScheduled ? "Reprogramar" : "Programar"}
                    </button>
                  )}

                  {!isClosed &&
                    menuOrder.modality === "delivery" &&
                    canReportIncidentAction && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPortalMenu(null);
                          onReportIncident(menuOrder);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50 cursor-pointer dark:text-amber-300 dark:hover:bg-amber-500/10"
                      >
                        <ExclamationTriangleIcon className="size-3.5" />
                        Reportar novedad de entrega
                      </button>
                    )}

                  {canRetry && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPortalMenu(null);
                        onRetryDelivery(menuOrder);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <ArrowPathIcon className="size-3.5 text-gray-400" />
                      Reintentar entrega
                    </button>
                  )}

                  {!isClosed &&
                    (menuOrder.carrier || menuOrder.trackingNumber) &&
                    canReportIncidentAction && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPortalMenu(null);
                          onUnassignCarrier(menuOrder);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <TruckIcon className="size-3.5 text-gray-400" />
                        Desasignar transportadora
                      </button>
                    )}

                  {!isClosed && canCancelAction && (
                    <>
                      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setPortalMenu(null);
                          onCancel(menuOrder);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-error-600 hover:bg-error-50 cursor-pointer dark:text-error-400 dark:hover:bg-error-500/10"
                      >
                        <NoSymbolIcon className="size-3.5" />
                        Cancelar pedido
                      </button>
                    </>
                  )}
                </div>
              );
            })(),
            document.body,
          )}

        {/* Sleek Centered Fixed Floating Bulk Action Pill */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-full border border-gray-800/90 bg-[#1C1C1F] px-4 py-2 text-white shadow-theme-xl dark:border-gray-700 dark:bg-gray-900">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF3F1A] px-2 text-xs font-extrabold tabular-nums text-white">
              {selectedIds.length}
            </span>
            <span className="text-xs font-semibold text-gray-200">
              {selectedIds.length === 1 ? "seleccionado" : "seleccionados"}
            </span>

            <span className="h-4 w-px bg-white/15" />

            <button
              type="button"
              onClick={handleBulkExport}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              <ArrowDownTrayIcon className="size-3.5" />
              <span>
                {activeGroup === "preparing"
                  ? "Descargar CSV (guías)"
                  : "Descargar CSV"}
              </span>
            </button>

            {cancellableSelectedIds.length > 0 && canCancelAction && (
              <button
                type="button"
                onClick={() => onBulkCancel(cancellableSelectedIds)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-error-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-error-500 cursor-pointer"
              >
                <NoSymbolIcon className="size-3.5" />
                <span>
                  Cancelar seleccionados ({cancellableSelectedIds.length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              aria-label="Limpiar selección"
              className="flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <XMarkIcon className="size-4" />
            </button>
          </div>
        )}
      </div>
    );
  },
);

export default OrdersListView;
