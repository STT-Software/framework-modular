import { useEffect, useState } from "react";
import {
  ArrowPathIcon,
  ChatBubbleLeftEllipsisIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MapPinIcon,
  NoSymbolIcon,
  PhoneXMarkIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import type { OrderOperatorStage } from "../../types";
import {
  DELIVERY_FAILURE_MOTIVES,
  type DeliveryFailureMotiveId,
  type DeliveryFailureOutcome,
} from "../domain/incidentDomain";
import {
  canOperatorMoveTo,
  formatCOP,
  type Order,
  type OrderAddress,
} from "../domain/order";
import type { IncidentStore } from "../stores/IncidentStore";
import type { OrdersStore } from "../stores/OrdersStore";
import { Modal } from "./Dialog";

export interface DeliveryIncidentModalProps {
  open: boolean;
  order: Order | null;
  operatorName: string;
  allowedStages: OrderOperatorStage[];
  isAdmin?: boolean;
  ordersStore: OrdersStore;
  incidentsStore: IncidentStore;
  onClose: () => void;
  onSubmitted?: (outcome: DeliveryFailureOutcome, order: Order) => void;
}

const MOTIVE_ICONS: Record<DeliveryFailureMotiveId, typeof PhoneXMarkIcon> = {
  no_answer: PhoneXMarkIcon,
  wrong_address: MapPinIcon,
  rejected: NoSymbolIcon,
  incomplete_info: InformationCircleIcon,
  other: ChatBubbleLeftEllipsisIcon,
};

const OTHER_DETAIL_MIN_LENGTH = 3;

function formatAddressLine(address?: OrderAddress): string {
  if (!address?.street) return "Sin dirección registrada";
  return [address.street, address.neighborhood, address.reference]
    .filter(Boolean)
    .join(" · ");
}

export function DeliveryIncidentModal({
  open,
  order,
  operatorName,
  allowedStages,
  isAdmin = false,
  ordersStore,
  incidentsStore,
  onClose,
  onSubmitted,
}: DeliveryIncidentModalProps) {
  const [motiveId, setMotiveId] = useState<DeliveryFailureMotiveId>("no_answer");
  const [detail, setDetail] = useState("");
  const [outcome, setOutcome] = useState<DeliveryFailureOutcome>("retry");
  const [error, setError] = useState<string | null>(null);

  const canRetry =
    isAdmin ||
    canOperatorMoveTo("ready", allowedStages) ||
    allowedStages.includes("dispatch");
  const canCancel =
    isAdmin ||
    allowedStages.includes("confirmation") ||
    allowedStages.includes("dispatch");

  useEffect(() => {
    if (!open) return;
    setMotiveId("no_answer");
    setDetail("");
    setOutcome(canRetry ? "retry" : "cancel");
    setError(null);
  }, [open, order?.id, canRetry]);

  if (!open || !order) return null;

  const selectedMotive =
    DELIVERY_FAILURE_MOTIVES.find((m) => m.id === motiveId) ??
    DELIVERY_FAILURE_MOTIVES[0];

  const cleanDetail = detail.trim();
  const isOtherDetailMissing =
    motiveId === "other" && cleanDetail.length < OTHER_DETAIL_MIN_LENGTH;
  const isOutcomeBlocked =
    (outcome === "retry" && !canRetry) || (outcome === "cancel" && !canCancel);
  const submitDisabled = isOtherDetailMissing || isOutcomeBlocked;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isOtherDetailMissing) {
      setError(
        `Describe el motivo de la novedad (mínimo ${OTHER_DETAIL_MIN_LENGTH} caracteres).`,
      );
      return;
    }

    if (outcome === "retry" && !canRetry) {
      setError("No tienes permisos para devolver el pedido a preparación.");
      return;
    }

    if (outcome === "cancel" && !canCancel) {
      setError("No tienes permisos para cancelar pedidos.");
      return;
    }

    const updated = ordersStore.recordDeliveryFailure(
      order.id,
      selectedMotive.label,
      cleanDetail,
      outcome,
      operatorName,
    );

    incidentsStore.record({
      orderNumber: order.code,
      customer: order.customerName,
      carrier: order.carrier?.trim() || "Envío propio",
      trackingNumber: order.trackingNumber?.trim() || `SIN-GUIA-${order.code}`,
      reason: cleanDetail
        ? `${selectedMotive.label} — ${cleanDetail}`
        : selectedMotive.label,
      address: formatAddressLine(order.address),
      phone: order.customerPhone,
      city: order.address?.city || order.address?.department || "Sin ciudad",
    });

    onSubmitted?.(outcome, updated ?? order);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      label={`Reportar novedad de entrega · ${order.code}`}
      className="w-[min(95vw,40rem)] overflow-hidden p-0"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <ExclamationTriangleIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-title dark:text-white">
                Reportar novedad de entrega
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Registra lo ocurrido con el pedido{" "}
                <strong className="font-mono">{order.code}</strong> (
                {order.customerName} · {formatCOP(order.total)}). Se creará una
                novedad en el módulo de gestión.
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Structured 5 motives */}
          <div>
            <span className="block text-xs font-bold text-ink-body dark:text-gray-200">
              1. ¿Qué ocurrió en el intento de entrega?
            </span>
            <div className="mt-2.5 space-y-2">
              {DELIVERY_FAILURE_MOTIVES.map((motive) => {
                const Icon = MOTIVE_ICONS[motive.id];
                const checked = motiveId === motive.id;
                return (
                  <label
                    key={motive.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-brand-500 bg-brand-25/70 ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-500/10"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery-failure-motive"
                      value={motive.id}
                      checked={checked}
                      onChange={() => {
                        setMotiveId(motive.id);
                        if (error) setError(null);
                      }}
                      className="mt-0.5 accent-brand-500"
                    />
                    <span
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                        checked
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-ink-body dark:text-white">
                        {motive.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
                        {motive.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Detail input (mandatory for "other") */}
          <div>
            <label
              htmlFor="incident-detail-input"
              className="block text-xs font-bold text-ink-body dark:text-gray-200"
            >
              Detalle adicional{" "}
              {motiveId === "other" ? (
                <span className="text-error-500">*</span>
              ) : (
                <span className="font-normal text-gray-400">(opcional)</span>
              )}
            </label>
            <textarea
              id="incident-detail-input"
              rows={2}
              value={detail}
              onChange={(e) => {
                setDetail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={
                motiveId === "other"
                  ? "Describe exactamente lo sucedido con el mensajero o el destinatario…"
                  : "Ej. Portería indicó que el cliente llega después de las 5:00 p. m."
              }
              className={`mt-1.5 w-full resize-none rounded-xl border bg-white px-3 py-2 text-xs text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:ring-2 dark:bg-gray-900 dark:text-gray-100 ${
                isOtherDetailMissing
                  ? "border-amber-300 focus:border-amber-400 focus:ring-amber-500/20 dark:border-amber-500/40"
                  : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700"
              }`}
            />
            {isOtherDetailMissing && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <InformationCircleIcon className="size-3.5 shrink-0" />
                <span>
                  Escribe al menos {OTHER_DETAIL_MIN_LENGTH} caracteres para describir el motivo y habilitar el registro.
                </span>
              </p>
            )}
          </div>

          {/* 2 permission-gated outcomes */}
          <div>
            <span className="block text-xs font-bold text-ink-body dark:text-gray-200">
              2. Acción a tomar con el pedido
            </span>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={!canRetry}
                  onClick={() => {
                    setOutcome("retry");
                    if (error) setError(null);
                  }}
                  className={`flex flex-1 items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors ${
                    !canRetry
                      ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900"
                      : outcome === "retry"
                        ? "border-brand-500 bg-brand-25 ring-1 ring-brand-500/25 cursor-pointer dark:bg-brand-500/10"
                        : "border-gray-200 bg-white hover:border-gray-300 cursor-pointer dark:border-gray-800 dark:bg-gray-900"
                  }`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <ArrowPathIcon className="size-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-ink-body dark:text-white">
                      Reintentar entrega
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Devuelve el pedido a <strong>Listo</strong> y lo marca como urgente.
                    </div>
                  </div>
                </button>
                {!canRetry && (
                  <p className="mt-1.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                    Sin permiso: tu operador necesita acceso a la etapa de{" "}
                    <strong>Preparación</strong> o <strong>Despacho</strong> para devolver el pedido a Listo.
                  </p>
                )}
              </div>

              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={!canCancel}
                  onClick={() => {
                    setOutcome("cancel");
                    if (error) setError(null);
                  }}
                  className={`flex flex-1 items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors ${
                    !canCancel
                      ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900"
                      : outcome === "cancel"
                        ? "border-error-500 bg-error-25 ring-1 ring-error-500/25 cursor-pointer dark:bg-error-500/10"
                        : "border-gray-200 bg-white hover:border-gray-300 cursor-pointer dark:border-gray-800 dark:bg-gray-900"
                  }`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
                    <NoSymbolIcon className="size-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-ink-body dark:text-white">
                      Cancelar pedido
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Cierra el pedido como <strong>Cancelado</strong> registrando este motivo.
                    </div>
                  </div>
                </button>
                {!canCancel && (
                  <p className="mt-1.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                    Sin permiso: tu operador necesita acceso a{" "}
                    <strong>Confirmación</strong>, <strong>Despacho</strong> o rol administrador para cancelar pedidos.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          {error && (
            <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-error-50 px-3 py-2 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-400">
              <ExclamationTriangleIcon className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant={outcome === "cancel" ? "destructive" : "primary"}
              size="sm"
              type="submit"
              disabled={submitDisabled}
            >
              {outcome === "cancel"
                ? "Registrar novedad y cancelar"
                : "Registrar y reintentar"}
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}

export default DeliveryIncidentModal;
