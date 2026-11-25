import { Link } from "react-router";
import { ALL_OPERATOR_STAGES, type CancellationStage, type ConfirmationExpiryAction, type ConfirmationMode, type ModalityType, type OnSiteMode, type OrderOperatorStage, type OutOfHoursPolicy, type PaymentMethodId, type PickupScheduleMode, type ShippingPricingMode } from "../../types";

export const modalityLabels: Record<ModalityType, string> = {
  delivery: "Envío a domicilio",
  pickup: "Retiro en local",
  on_site: "En el establecimiento",
};

export const onSiteModeLabels: Record<OnSiteMode, string> = {
  table_or_zone: "Mesa o zona identificada",
  counter: "Barra o mostrador",
};

export const confirmationLabels: Record<ConfirmationMode, string> = {
  manual: "Manual",
  automatic: "Automática",
  agent: "Por agente",
};

export const pickupModeLabels: Record<PickupScheduleMode, string> = {
  eventual: "Retiro inmediato o eventual",
  fixed: "Retiro por franjas horarias",
};

export const shippingPricingLabels: Record<ShippingPricingMode, string> = {
  fixed: "Tarifa fija de envío",
  free_from: "Gratis desde monto mínimo",
  to_confirm: "Costo por confirmar con el cliente",
};

export const paymentMethodLabels: Record<PaymentMethodId, string> = {
  cash_on_delivery: "Pago contra entrega",
  bank_transfer: "Transferencia bancaria",
  payment_link: "Link de pago en línea",
  in_store: "Pago en el establecimiento",
};

export const confirmationExpiryLabels: Record<ConfirmationExpiryAction, string> = {
  alert_only: "Solo alertar al equipo",
  auto_cancel: "Cancelar pedido automáticamente",
};

export const cancellationLimitLabels: Record<CancellationStage, string> = {
  before_confirmation: "Solo antes de confirmar",
  before_preparation: "Antes de iniciar preparación",
  before_dispatch: "Antes del despacho",
  never: "No permitir cancelaciones",
};

export const outOfHoursPolicyLabels: Record<OutOfHoursPolicy, string> = {
  reject: "Bloquear pedidos y responder automáticamente",
  schedule: "Aceptar como pedido programado para el siguiente horario",
};

export const operatorStageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

export function parseNumericInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  return Number(raw);
}

export function numericValue(value: number): string | number {
  return Number.isFinite(value) ? value : "";
}

export function toggleStageInList(current: OrderOperatorStage[], stage: OrderOperatorStage, checked: boolean): OrderOperatorStage[] {
  const next = new Set(current);
  if (checked) next.add(stage);
  else next.delete(stage);
  return ALL_OPERATOR_STAGES.filter((item) => next.has(item));
}

export function formatAmount(value: number, currency: string): string {
  return Number.isFinite(value) ? `${value.toLocaleString("es-CO")} ${currency}` : "—";
}

export function renderOperatorStages(stages: OrderOperatorStage[]) {
  if (stages.length === ALL_OPERATOR_STAGES.length) {
    return (
      <div className="oc-stage-badges">
        <span className="oc-stage-badge">Todas las etapas</span>
      </div>
    );
  }
  return (
    <div className="oc-stage-badges">
      {stages.map((stage) => (
        <span key={stage} className="oc-stage-badge">
          {operatorStageLabels[stage]}
        </span>
      ))}
    </div>
  );
}
