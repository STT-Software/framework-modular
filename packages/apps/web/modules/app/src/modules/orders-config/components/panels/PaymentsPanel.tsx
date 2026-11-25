import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Link } from "react-router";
import { Checkbox } from "@/elements/form/checkbox";
import { type PaymentMethodId } from "../../types";
import { isConfirmationExpiryApplicable, isTransferReceiptApplicable, validateStep } from "../../validation";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";

export const PaymentsPanel = observer(({ state, store }: { state: OrdersConfigState; store: OrdersConfigStore }) => {
  const [paymentMethodFeedback, setPaymentMethodFeedback] = useState<string | null>(null);
  const handleTogglePaymentMethod = (method: PaymentMethodId) => {
    const result = store.togglePaymentMethod(method);
    if (!result.ok) {
      setPaymentMethodFeedback(result.message);
      return;
    }
    setPaymentMethodFeedback(null);
  };
  const paymentsIssues = validateStep(state, "payments");
  const prepaymentIssue = paymentsIssues.find((i) => i.field === "requirePrepaymentBeforePrep");
  const showTransferReceipt = isTransferReceiptApplicable(state);
  const showConfirmationExpiry = isConfirmationExpiryApplicable(state);
  const showAutoWithoutPrepaymentNote =
    state.fulfillment.confirmationMode === "automatic" && !state.payments.requirePrepaymentBeforePrep;

  return (
    <div>
      <h3 className="oc-section-title">Métodos de pago aceptados</h3>
      <div className="oc-grid-2">
        {(
          [
            {
              id: "cash_on_delivery",
              title: "Pago contra entrega",
              desc: "El cliente paga en efectivo o datáfono al recibir su pedido.",
            },
            {
              id: "bank_transfer",
              title: "Transferencia bancaria",
              desc: "Transferencia directa a cuenta bancaria o billetera digital.",
            },
            {
              id: "payment_link",
              title: "Link de pago en línea",
              desc: "Cobro anticipado mediante enlace de pago con tarjeta o pasarela.",
            },
            {
              id: "in_store",
              title: "Pago en el establecimiento",
              desc: "El cliente paga al retirar en tienda o al consumir en el local.",
            },
          ] as const
        ).map((method) => {
          const isSelected = state.payments.methods.includes(method.id);
          return (
            <button
              key={method.id}
              type="button"
              aria-pressed={isSelected}
              className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => handleTogglePaymentMethod(method.id)}
            >
              <strong>{method.title}</strong>
              <p>{method.desc}</p>
              <div className="oc-modality-status">
                {isSelected ? "✓ Habilitado" : "+ Habilitar"}
              </div>
            </button>
          );
        })}
      </div>

      {paymentMethodFeedback && (
        <div className="oc-alert-warning" role="alert">
          <span>{paymentMethodFeedback}</span>
        </div>
      )}

      <div className="oc-section-block">
        <h3 className="oc-section-title">Validación de pagos</h3>
        {showTransferReceipt && (
          <div className="oc-toggle-box">
            <Checkbox
              id="oc-requireTransferReceipt"
              checked={state.payments.requireTransferReceipt}
              onChange={(checked) => store.setRequireTransferReceipt(checked)}
              label="Exigir comprobante de transferencia antes de aprobar"
            />
            <span className="oc-toggle-hint">
              Se solicitará soporte o comprobante antes de confirmar pedidos pagados por transferencia.
            </span>
          </div>
        )}

        <div className="oc-toggle-box">
          <Checkbox
            id="oc-requirePrepaymentBeforePrep"
            checked={state.payments.requirePrepaymentBeforePrep}
            onChange={(checked) => store.setRequirePrepaymentBeforePrep(checked)}
            label="Exigir pago confirmado antes de pasar a preparación"
          />
          <span className="oc-toggle-hint">
            Requiere al menos un método de pago anticipado activo (Transferencia bancaria o Link de pago).
          </span>
          {prepaymentIssue && (
            <div className="oc-alert-error" role="alert">
              <span>{prepaymentIssue.message}</span>
            </div>
          )}
        </div>

        {showAutoWithoutPrepaymentNote && (
          <div className="oc-info-banner" role="note">
            <strong>Nota operativa:</strong> tienes confirmación automática activa y sin pago previo
            obligatorio. Los pedidos pasarán directamente a preparación sin validar el pago antes.
          </div>
        )}
      </div>

      {showConfirmationExpiry && (
        <div className="oc-section-block">
          <h3 className="oc-section-title">Si vence el tiempo de confirmación</h3>
          <div className="oc-grid-2">
            {(
              [
                {
                  id: "alert_only",
                  title: "Solo alertar al equipo",
                  desc: "El pedido queda resaltado como vencido hasta que un operador lo atienda.",
                },
                {
                  id: "auto_cancel",
                  title: "Cancelar pedido automáticamente",
                  desc: "El pedido se cancela automáticamente y se informa al cliente al vencer el plazo.",
                },
              ] as const
            ).map((option) => {
              const isSelected = state.payments.confirmationExpiryAction === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => store.setConfirmationExpiryAction(option.id)}
                >
                  <strong>{option.title}</strong>
                  <p>{option.desc}</p>
                  <i>✓</i>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="oc-section-block">
        <h3 className="oc-section-title">¿Hasta qué etapa se permite cancelar un pedido?</h3>
        <div className="oc-grid-2">
          {(
            [
              {
                id: "before_confirmation",
                title: "Solo antes de confirmar",
                desc: "El cliente puede cancelar únicamente mientras el pedido está pendiente de aprobación.",
              },
              {
                id: "before_preparation",
                title: "Antes de iniciar preparación",
                desc: "Se permiten cancelaciones siempre que no haya comenzado la preparación.",
              },
              {
                id: "before_dispatch",
                title: "Antes del despacho",
                desc: "Se permite cancelar hasta antes de entregar el pedido a mensajería o transportadora.",
              },
              {
                id: "never",
                title: "No permitir cancelaciones",
                desc: "Las solicitudes de cancelación deben gestionarse directamente con soporte.",
              },
            ] as const
          ).map((option) => {
            const isSelected = state.payments.cancellationLimit === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => store.setCancellationLimit(option.id)}
              >
                <strong>{option.title}</strong>
                <p>{option.desc}</p>
                <i>✓</i>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
