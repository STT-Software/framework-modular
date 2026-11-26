import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  SquaresPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import { formatCOP, type Order } from "../domain/order";
import { Modal } from "./Dialog";

// ---------------------------------------------------------------------------
// CancelOrderModal (single or bulk)
// ---------------------------------------------------------------------------

export interface CancelOrderModalProps {
  open: boolean;
  order?: Order | null;
  bulkCount?: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelOrderModal({
  open,
  order,
  bulkCount = 0,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, order?.id, bulkCount]);

  if (!open) return null;

  const isBulk = !order && bulkCount > 0;
  const title = isBulk
    ? `Cancelar ${bulkCount} ${bulkCount === 1 ? "pedido" : "pedidos"}`
    : `Cancelar pedido ${order?.code ?? ""}`;

  return (
    <Modal isOpen onClose={onClose} label={title} className="w-[min(94vw,30rem)] overflow-hidden p-0">
      <div className="flex flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
              <NoSymbolIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-title dark:text-white">{title}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {isBulk
                  ? "Los pedidos seleccionados pasarán al estado Cancelado."
                  : `El pedido de ${order?.customerName ?? "cliente"} pasará a Finalizadas como Cancelado.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        </header>

        <div className="space-y-3 p-6">
          {order && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-gray-50 px-3.5 py-2.5 text-xs dark:border-gray-800 dark:bg-gray-950/50">
              <span className="font-semibold text-ink-body dark:text-gray-100">
                {order.code} · {order.customerName}
              </span>
              <span className="font-bold tabular-nums text-ink-body dark:text-white">
                {formatCOP(order.total)}
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="cancel-order-reason"
              className="block text-xs font-bold text-ink-body dark:text-gray-200"
            >
              Motivo de cancelación <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              id="cancel-order-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Cliente solicitó cancelar o reprogramar para otra fecha…"
              className="mt-1.5 w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Volver
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onConfirm(reason.trim())}>
            {isBulk ? `Cancelar (${bulkCount})` : "Confirmar cancelación"}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// DeliverOrderModal (irreversible confirmation)
// ---------------------------------------------------------------------------

export interface DeliverOrderModalProps {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeliverOrderModal({
  open,
  order,
  onClose,
  onConfirm,
}: DeliverOrderModalProps) {
  if (!open || !order) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      label={`Confirmar entrega de ${order.code}`}
      className="w-[min(94vw,29rem)] overflow-hidden p-0"
    >
      <div className="flex flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircleIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-title dark:text-white">
                Marcar como entregado
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Esta acción cierra el ciclo operativo del pedido y lo mueve a Finalizadas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        </header>

        <div className="space-y-3 p-6">
          <div className="rounded-xl border border-gray-200/80 bg-gray-50 p-3.5 text-xs dark:border-gray-800 dark:bg-gray-950/50">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-ink-title dark:text-brand-400">
                {order.code}
              </span>
              <span className="font-bold tabular-nums text-ink-body dark:text-white">
                {formatCOP(order.total)}
              </span>
            </div>
            <div className="mt-1 font-semibold text-ink-body dark:text-gray-100">
              {order.customerName}
            </div>
            <div className="mt-0.5 text-gray-500 dark:text-gray-400">
              {order.items.reduce((s, i) => s + i.quantity, 0)} productos ·{" "}
              {order.paid ? "Pagado" : "Pago pendiente"}
            </div>
          </div>

          {!order.paid && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Este pedido aún figura como <strong>pendiente de pago</strong>. Verifica el cobro antes de finalizar la entrega.
              </span>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Confirmar entrega
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ColumnFormModal (create or rename Kanban column)
// ---------------------------------------------------------------------------

const COLUMN_COLOR_SWATCHES = [
  "#0EA5E9",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#10B981",
  "#6366F1",
  "#EAB308",
  "#FF3F1A",
];

export interface ColumnFormModalProps {
  open: boolean;
  mode: "create" | "rename";
  initialLabel?: string;
  initialColor?: string;
  onClose: () => void;
  onSubmit: (label: string, color: string) => { ok: boolean; error?: string };
}

export function ColumnFormModal({
  open,
  mode,
  initialLabel = "",
  initialColor = "#0EA5E9",
  onClose,
  onSubmit,
}: ColumnFormModalProps) {
  const [label, setLabel] = useState(initialLabel);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel);
    setColor(initialColor || COLUMN_COLOR_SWATCHES[0]);
    setError(null);
  }, [open, initialLabel, initialColor, mode]);

  if (!open) return null;

  const title = mode === "create" ? "Nueva columna del tablero" : "Renombrar columna";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onSubmit(label.trim(), color);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar la columna.");
      return;
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} label={title} className="w-[min(94vw,27rem)] overflow-hidden p-0">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
              <SquaresPlusIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-title dark:text-white">{title}</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {mode === "create"
                  ? "Agrega una etapa personalizada a tu flujo operativo."
                  : "Actualiza el nombre visible de esta columna."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        </header>

        <div className="space-y-4 p-6">
          <div>
            <label
              htmlFor="kanban-column-label"
              className="block text-xs font-bold text-ink-body dark:text-gray-200"
            >
              Nombre de la columna
            </label>
            <input
              id="kanban-column-label"
              type="text"
              autoFocus
              maxLength={40}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ej. Empacando, Control de calidad…"
              className="mt-1.5 h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {mode === "create" && (
            <div>
              <span className="block text-xs font-bold text-ink-body dark:text-gray-200">
                Color identificador
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLUMN_COLOR_SWATCHES.map((swatch) => {
                  const selected = color === swatch;
                  return (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      aria-label={`Color ${swatch}`}
                      className={`size-7 rounded-full transition-transform cursor-pointer ${
                        selected ? "scale-110 ring-2 ring-gray-900 ring-offset-2 dark:ring-white dark:ring-offset-gray-900" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-400">
              <ExclamationTriangleIcon className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit">
            {mode === "create" ? "Crear columna" : "Guardar nombre"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
