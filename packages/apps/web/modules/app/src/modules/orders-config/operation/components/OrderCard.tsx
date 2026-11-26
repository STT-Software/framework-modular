import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
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
  UserIcon,
} from "@heroicons/react/24/outline";
import type { OrderOperatorStage } from "../../types";
import {
  canOperatorMoveTo,
  CHANNEL_LABELS,
  formatCOP,
  MODALITY_LABELS,
  nextStageFor,
  STAGE_COLORS,
  STAGE_LABELS,
  STAGE_PROGRESS,
  type Order,
  type OrderColumn,
  type OrderStage,
} from "../domain/order";

export interface OrderCardProps {
  order: Order;
  columns: OrderColumn[];
  columnColor?: string;
  allowedStages: OrderOperatorStage[];
  canDrag: boolean;
  isDragging?: boolean;
  isJustDropped?: boolean;
  canCancel?: boolean;
  canSchedule?: boolean;
  canReportIncident?: boolean;
  onSelect: (order: Order) => void;
  onTogglePaid: (order: Order) => void;
  onAdvance: (order: Order, nextStage: OrderStage) => void;
  onSchedule: (order: Order) => void;
  onReportIncident: (order: Order) => void;
  onCancel: (order: Order) => void;
  onOpenChat?: (order: Order) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, order: Order) => void;
  onDragEnd: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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

export const OrderCard = observer(
  ({
    order,
    columns,
    columnColor,
    allowedStages,
    canDrag,
    isDragging = false,
    isJustDropped = false,
    canCancel: canCancelProp,
    canSchedule: canScheduleProp,
    canReportIncident: canReportIncidentProp,
    onSelect,
    onTogglePaid,
    onAdvance,
    onSchedule,
    onReportIncident,
    onCancel,
    onOpenChat,
    onDragStart,
    onDragEnd,
  }: OrderCardProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!menuOpen) return;
      const handleOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [menuOpen]);

    const isClosed = order.stage === "delivered" || order.stage === "cancelled";
    const nextStage = resolveNextStage(order, columns);
    const canAdvance = Boolean(nextStage && canOperatorMoveTo(nextStage, allowedStages));
    const defaultOpAction =
      allowedStages.includes("confirmation") || allowedStages.includes("dispatch");
    const canCancel = !isClosed && (canCancelProp ?? defaultOpAction);
    const canSchedule = !isClosed && (canScheduleProp ?? defaultOpAction);
    const canReportIncident =
      !isClosed &&
      order.modality === "delivery" &&
      (canReportIncidentProp ?? defaultOpAction);

    const stageLabel = resolveStageLabel(order.stage, columns);
    const stageColor = columnColor ?? STAGE_COLORS[order.stage] ?? "#FF3F1A";
    const progress = STAGE_PROGRESS[order.stage] ?? 55;
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const nextLabel = nextStage ? resolveStageLabel(nextStage, columns) : null;

    const modalityPillClass =
      order.modality === "delivery"
        ? "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
        : order.modality === "pickup"
          ? "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";

    const firstItemName = order.items[0]?.name ?? "Sin productos";
    const cleanCode = order.code.replace(/^#/, "");

    if (isDragging) {
      return (
        <div
          onDragEnd={onDragEnd}
          className="flex min-h-[156px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-300 bg-brand-25/60 px-4 py-6 text-center dark:border-brand-500/40 dark:bg-brand-500/10"
        >
          <span className="text-xs font-bold text-brand-600 dark:text-brand-300">
            Moviendo #{cleanCode}...
          </span>
          <span className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Suelta en otra columna para actualizar
          </span>
        </div>
      );
    }

    return (
      <div
        role="button"
        tabIndex={0}
        draggable={canDrag && !isClosed}
        onDragStart={(e) => {
          if (!canDrag || isClosed) {
            e.preventDefault();
            return;
          }
          onDragStart(e, order);
        }}
        onDragEnd={onDragEnd}
        onClick={() => onSelect(order)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(order);
          }
        }}
        className={`group relative flex flex-col gap-2.5 rounded-2xl border bg-white p-3.5 text-left shadow-theme-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-theme-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-gray-900 dark:hover:border-gray-700 ${
          canDrag && !isClosed ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${
          isJustDropped
            ? "border-brand-500 ring-2 ring-brand-500/35 bg-brand-25/60 dark:bg-brand-500/10"
            : "border-gray-200/90 dark:border-gray-800"
        }`}
      >
        {/* Top row: Clean pastel pills + 3-dot menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${modalityPillClass}`}
            >
              {MODALITY_LABELS[order.modality]}
            </span>

            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
              style={{
                backgroundColor: `${stageColor}16`,
                color: stageColor,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: stageColor }}
              />
              {stageLabel}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePaid(order);
              }}
              title={
                order.paid
                  ? "Marcar como pendiente de pago"
                  : "Marcar como pagado"
              }
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
                order.paid
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
              }`}
            >
              {order.paid ? (
                <CheckCircleIcon className="size-3 shrink-0" />
              ) : (
                <ClockIcon className="size-3 shrink-0" />
              )}
              {order.paid ? "Pagado" : "Pendiente"}
            </button>

            {order.urgent && !isClosed && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-error-50 px-2 py-0.5 text-[10px] font-bold text-error-600 dark:bg-error-500/15 dark:text-error-400">
                <FireIcon className="size-3 shrink-0" />
                Urgente
              </span>
            )}
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={`Acciones para ${order.code}`}
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <EllipsisHorizontalIcon className="size-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-8 z-40 w-52 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelect(order);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <EyeIcon className="size-3.5 text-gray-400" />
                  Ver detalle
                </button>

                {onOpenChat && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenChat(order);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 cursor-pointer dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                  >
                    <ChatBubbleLeftRightIcon className="size-3.5" />
                    Abrir chat (WhatsApp)
                  </button>
                )}

                {canAdvance && nextStage && nextLabel && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onAdvance(order, nextStage);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 cursor-pointer dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    <ArrowRightIcon className="size-3.5" />
                    Avanzar a {nextLabel}
                  </button>
                )}

                {canSchedule && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSchedule(order);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <CalendarDaysIcon className="size-3.5 text-gray-400" />
                    Programar
                  </button>
                )}

                {canReportIncident && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReportIncident(order);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 cursor-pointer dark:text-amber-300 dark:hover:bg-amber-500/10"
                  >
                    <ExclamationTriangleIcon className="size-3.5" />
                    Reportar novedad de entrega
                  </button>
                )}

                {canCancel && (
                  <>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onCancel(order);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-error-600 transition-colors hover:bg-error-50 cursor-pointer dark:text-error-400 dark:hover:bg-error-500/10"
                    >
                      <NoSymbolIcon className="size-3.5" />
                      Cancelar pedido
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Order code & customer */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-bold tracking-wide text-gray-400 dark:text-gray-500">
              {order.code}
            </span>
            {order.carrier && order.modality === "delivery" && (
              <span className="truncate text-[10.5px] font-medium text-gray-500 dark:text-gray-400">
                {order.courierName
                  ? `${order.carrier} · ${order.courierName}`
                  : order.carrier}
              </span>
            )}
            {order.modality === "onsite" && order.table && (
              <span className="truncate text-[10.5px] font-medium text-amber-700 dark:text-amber-300">
                {order.table}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate text-sm font-bold text-ink-body dark:text-white">
            {order.customerName}
          </h3>
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {firstItemName}
            {order.items.length > 1 ? ` +${order.items.length - 1} más` : ""} ·{" "}
            {totalUnits} {totalUnits === 1 ? "ud." : "uds."}
          </p>
        </div>

        {/* Progress bar with explicit Progreso + % label */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Progreso
            </span>
            <span className="font-bold tabular-nums text-[#1C1C1F] dark:text-gray-100">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-[#1C1C1F] transition-all duration-300 dark:bg-white"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Compact Footer: Avatar + Channel + Chat + Inline Advance Pill + COP Total */}
        <div className="flex items-center justify-between gap-1.5 border-t border-gray-100 pt-2.5 dark:border-gray-800/80">
          <div className="flex min-w-0 items-center">
            <span
              title={order.customerName}
              className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#190088] text-[9.5px] font-bold text-white shadow-theme-xs dark:border-gray-900 dark:bg-brand-500"
            >
              {getInitials(order.customerName)}
            </span>
            <span
              className={`-ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border-2 border-white px-1.5 py-0.5 text-[9.5px] font-semibold dark:border-gray-900 ${
                order.channel === "whatsapp"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {order.channel === "operator" && <UserIcon className="size-2.5" />}
              {CHANNEL_LABELS[order.channel]}
            </span>
            {onOpenChat && (
              <button
                type="button"
                title="Abrir chat (WhatsApp)"
                aria-label={`Abrir chat con ${order.customerName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChat(order);
                }}
                className="ml-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 cursor-pointer dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
              >
                <ChatBubbleLeftRightIcon className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {canAdvance && nextStage && nextLabel && (
              <button
                type="button"
                title={`Avanzar a ${nextLabel}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance(order, nextStage);
                }}
                className="inline-flex h-6 max-w-[116px] items-center gap-1 rounded-full bg-brand-50 px-2 text-[10.5px] font-bold text-brand-600 transition-colors hover:bg-brand-500 hover:text-white cursor-pointer dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500 dark:hover:text-white"
              >
                <span className="truncate">{nextLabel}</span>
                <ArrowRightIcon className="size-3 shrink-0" />
              </button>
            )}

            <span className="text-xs font-bold tabular-nums text-ink-body dark:text-white">
              {formatCOP(order.total)}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

export default OrderCard;
