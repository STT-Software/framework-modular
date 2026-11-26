import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  CalendarDaysIcon,
  ClockIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PlayIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import {
  formatCOP,
  MODALITY_LABELS,
  type Order,
  type OrderModality,
} from "../domain/order";
import type { OrdersStore } from "../stores/OrdersStore";
import { Modal } from "./Dialog";

export interface ScheduledOrdersModalProps {
  open: boolean;
  ordersStore: OrdersStore;
  operatorName: string;
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
  onReschedule: (order: Order) => void;
  onCancelOrder: (order: Order) => void;
  onActivated?: (order: Order) => void;
}

function formatCountdown(iso: string | null | undefined, now: Date): string {
  if (!iso) return "—";
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "—";
  const diffSec = Math.floor((target - now.getTime()) / 1000);
  if (diffSec <= 0) return "Activando…";

  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);

  if (days > 0) return `En ${days} d ${hours} h`;
  if (hours > 0) return `En ${hours} h ${mins} min`;
  return `En ${Math.max(1, mins)} min`;
}

export const ScheduledOrdersModal = observer(
  ({
    open,
    ordersStore,
    operatorName,
    onClose,
    onSelectOrder,
    onReschedule,
    onCancelOrder,
    onActivated,
  }: ScheduledOrdersModalProps) => {
    const [search, setSearch] = useState("");
    const [modalityFilter, setModalityFilter] = useState<OrderModality | "all">("all");
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
      if (!open) return;
      const timer = window.setInterval(() => setNow(new Date()), 15_000);
      return () => window.clearInterval(timer);
    }, [open]);

    const scheduled = ordersStore.scheduledOrders;

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      return scheduled.filter((order) => {
        if (modalityFilter !== "all" && order.modality !== modalityFilter) return false;
        if (!q) return true;
        return (
          order.code.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.customerPhone.toLowerCase().includes(q)
        );
      });
    }, [scheduled, search, modalityFilter]);

    if (!open) return null;

    return (
      <Modal
        isOpen
        onClose={onClose}
        label="Pedidos programados"
        className="w-[min(95vw,52rem)] overflow-hidden p-0"
      >
        <div className="flex max-h-[88dvh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                <CalendarDaysIcon className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink-title dark:text-white">
                    Pedidos programados
                  </h2>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                    {scheduled.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Se activarán automáticamente en el tablero al llegar su fecha y hora.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <XMarkIcon className="size-4" />
            </button>
          </header>

          {/* Search & modality filters */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-6 py-3 dark:border-gray-800 dark:bg-gray-950/40">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código, cliente o teléfono…"
                className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "delivery", label: MODALITY_LABELS.delivery },
                  { id: "pickup", label: MODALITY_LABELS.pickup },
                  { id: "onsite", label: MODALITY_LABELS.onsite },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModalityFilter(item.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    modalityFilter === item.id
                      ? "bg-brand-500 text-white shadow-theme-xs"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-12 text-center dark:border-gray-800">
                <CalendarDaysIcon className="size-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {scheduled.length === 0
                    ? "No tienes pedidos programados"
                    : "No hay pedidos que coincidan con el filtro"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Puedes programar un pedido desde el tablero o al crear uno nuevo.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((order) => {
                  const totalUnits = order.items.reduce((sum, i) => sum + i.quantity, 0);
                  const dateFormatted = order.scheduledFor
                    ? new Date(order.scheduledFor).toLocaleString("es-CO", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <div
                      key={order.id}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-theme-xs transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-ink-title dark:text-brand-400">
                            {order.code}
                          </span>
                          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                            <ClockIcon className="mr-1 inline size-3" />
                            {formatCountdown(order.scheduledFor, now)}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {MODALITY_LABELS[order.modality]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="text-sm font-bold text-ink-body dark:text-white">
                            {order.customerName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {order.customerPhone}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize">{dateFormatted}</span>
                          <span>·</span>
                          <span>
                            {totalUnits} {totalUnits === 1 ? "producto" : "productos"}
                          </span>
                          <span>·</span>
                          <span className="font-bold text-ink-body dark:text-white">
                            {formatCOP(order.total)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                        <Button
                          size="sm"
                          variant="primary"
                          startIcon={<PlayIcon className="size-3.5" />}
                          onClick={() => {
                            ordersStore.activateScheduledOrder(order.id, operatorName);
                            onActivated?.(order);
                          }}
                        >
                          Activar ahora
                        </Button>

                        <button
                          type="button"
                          onClick={() => onReschedule(order)}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <CalendarDaysIcon className="size-3.5" />
                          Reprogramar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectOrder(order);
                          }}
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${order.code}`}
                          className="flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <EyeIcon className="size-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onCancelOrder(order)}
                          title="Cancelar pedido"
                          aria-label={`Cancelar pedido ${order.code}`}
                          className="flex size-9 items-center justify-center rounded-lg border border-error-200 bg-error-50/60 text-error-600 transition-colors hover:bg-error-100 cursor-pointer dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
                        >
                          <NoSymbolIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </footer>
        </div>
      </Modal>
    );
  },
);

export default ScheduledOrdersModal;
