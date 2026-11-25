import { observer } from "mobx-react-lite";
import { Button } from "@/elements/ui/button";
import { PROFILE_DEFAULTS } from "../../constants";
import { isConfirmationExpiryApplicable, isConfirmationSlaApplicable, isDispatchSlaApplicable, isFlatShippingFeeApplicable, isFreeShippingThresholdApplicable, isFreightRiskThresholdApplicable, isOnSiteModeApplicable, isTransferReceiptApplicable, isWhatsappChannelApplicable, validateOrdersConfig } from "../../validation";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";
import { modalityLabels, onSiteModeLabels, confirmationLabels, pickupModeLabels, shippingPricingLabels, paymentMethodLabels, confirmationExpiryLabels, cancellationLimitLabels, outOfHoursPolicyLabels, formatAmount, renderOperatorStages } from "./panelPresentation";
import { issuePanel, STEPS, type WizardStep } from "../../wizard";

export const ReviewPanel = observer(({ state, store, goToStep }: { state: OrdersConfigState; store: OrdersConfigStore; goToStep: (step: WizardStep) => Promise<void> }) => {
  const currency = store.currency;
  const allIssues = validateOrdersConfig(state);
  const hasDelivery = state.modalities.includes("delivery");
  const hasPickup = state.modalities.includes("pickup");
  const showOnSiteMode = isOnSiteModeApplicable(state);
  const showWhatsappChannel = isWhatsappChannelApplicable(state);
  const showFreightRisk = isFreightRiskThresholdApplicable(state);
  const showFlatShippingFee = isFlatShippingFeeApplicable(state);
  const showFreeShippingThreshold = isFreeShippingThresholdApplicable(state);
  const showTransferReceipt = isTransferReceiptApplicable(state);
  const showConfirmationExpiry = isConfirmationExpiryApplicable(state);
  const showConfirmationSla = isConfirmationSlaApplicable(state);
  const showDispatchSla = isDispatchSlaApplicable(state);
  const enabledCarriers = state.fulfillment.carriers.filter((c) => c.enabled);
  const stepTitleById = Object.fromEntries(STEPS.map((s) => [s.id, s.short])) as Record<WizardStep, string>;

  return (
    <div>
      <h3 className="oc-section-title">Resumen de la configuración</h3>

      {allIssues.length > 0 && (
        <div className="oc-alert-error" role="alert" style={{ marginTop: 0, marginBottom: "20px" }}>
          <strong>Corrige estos ajustes antes de guardar la configuración:</strong>
          <ul className="oc-blocking-list">
            {allIssues.map((issue) => (
              <li key={`${issue.step}:${issue.field}`} className="oc-blocking-item">
                <span>{issue.message}</span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => void goToStep(issuePanel(issue))}
                >
                  {`Ir a ${stepTitleById[issuePanel(issue)]}`}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="oc-review-grid">
        {/* 1. Profile summary */}
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>Rubro / Perfil</h4>
            <button
              type="button"
              className="oc-text-button"
              onClick={() => void goToStep("profile")}
            >
              Editar
            </button>
          </div>
          <dl className="oc-summary-list">
            <div>
              <dt>Perfil activo</dt>
              <dd>{PROFILE_DEFAULTS[state.profile].name}</dd>
            </div>
          </dl>
        </section>

        {/* 2. Modalities summary */}
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>Modalidades de entrega</h4>
            <button
              type="button"
              className="oc-text-button"
              onClick={() => void goToStep("modalities")}
            >
              Editar
            </button>
          </div>
          <div className="oc-chip-list">
            {state.modalities.map((mode) => (
              <span key={mode} className="oc-chip">
                {modalityLabels[mode]}
              </span>
            ))}
          </div>
          {showOnSiteMode && (
            <dl className="oc-summary-list" style={{ marginTop: "12px" }}>
              <div>
                <dt>Atención en sitio</dt>
                <dd>{onSiteModeLabels[state.onSiteMode]}</dd>
              </div>
            </dl>
          )}
        </section>

        {/* 3. Confirmation & fulfillment summary */}
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>Confirmación</h4>
            <button
              type="button"
              className="oc-text-button"
              onClick={() => void goToStep("confirmation")}
            >
              Editar
            </button>
          </div>
          <dl className="oc-summary-list">
            <div>
              <dt>Confirmación de órdenes</dt>
              <dd>{confirmationLabels[state.fulfillment.confirmationMode]}</dd>
            </div>
            {showWhatsappChannel && (
              <div>
                <dt>WhatsApp del agente</dt>
                <dd>{state.fulfillment.whatsappNumber.trim() || "Sin definir"}</dd>
              </div>
            )}
            {showFreightRisk && (
              <div>
                <dt>Tope de riesgo en flete</dt>
                <dd>
                  {state.fulfillment.riskThresholdActive
                    ? formatAmount(state.fulfillment.maxShippingCostRisk, currency)
                    : "Sin tope adicional"}
                </dd>
              </div>
            )}
          </dl>
        </section>
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>Envíos</h4>
            <button
              type="button"
              className="oc-text-button"
              onClick={() => void goToStep("fulfillment")}
            >
              Editar
            </button>
          </div>
          <dl className="oc-summary-list">
            {hasDelivery && (
              <>
                <div>
                  <dt>Mensajería propia</dt>
                  <dd>{state.fulfillment.hasOwnCourier ? "Habilitada" : "Desactivada"}</dd>
                </div>
                <div>
                  <dt>Transportadoras activas</dt>
                  <dd>
                    {enabledCarriers.length > 0
                      ? enabledCarriers
                          .map((c) => (c.isDefault ? `${c.name} (predeterminada)` : c.name))
                          .join(", ")
                      : "Ninguna activa"}
                  </dd>
                </div>
                <div>
                  <dt>Política de tarifa de envío</dt>
                  <dd>{shippingPricingLabels[state.fulfillment.shippingPricingMode]}</dd>
                </div>
                {showFlatShippingFee && (
                  <div>
                    <dt>
                      {state.fulfillment.shippingPricingMode === "free_from"
                        ? "Tarifa base de envío"
                        : "Tarifa fija de envío"}
                    </dt>
                    <dd>{formatAmount(state.fulfillment.flatShippingFee, currency)}</dd>
                  </div>
                )}
                {showFreeShippingThreshold && (
                  <div>
                    <dt>Envío gratis desde</dt>
                    <dd>{formatAmount(state.fulfillment.freeShippingThreshold, currency)}</dd>
                  </div>
                )}
                <div>
                  <dt>Pedido mínimo para domicilio</dt>
                  <dd>
                    {state.fulfillment.minimumOrderActive
                      ? formatAmount(state.fulfillment.minimumOrderAmount, currency)
                      : "Sin monto mínimo"}
                  </dd>
                </div>
              </>
            )}
            {hasPickup && (
              <div>
                <dt>Retiro en local</dt>
                <dd>{pickupModeLabels[state.fulfillment.pickupMode]}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* 4. Payments & policies summary */}
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>Pagos y políticas</h4>
            <button
              type="button"
              className="oc-text-button"
              onClick={() => void goToStep("payments")}
            >
              Editar
            </button>
          </div>
          <div className="oc-chip-list" style={{ marginBottom: "12px" }}>
            {state.payments.methods.map((method) => (
              <span key={method} className="oc-chip">
                {paymentMethodLabels[method]}
              </span>
            ))}
          </div>
          <dl className="oc-summary-list">
            {showTransferReceipt && (
              <div>
                <dt>Comprobante de transferencia</dt>
                <dd>{state.payments.requireTransferReceipt ? "Obligatorio" : "Opcional"}</dd>
              </div>
            )}
            <div>
              <dt>Pago previo antes de preparar</dt>
              <dd>{state.payments.requirePrepaymentBeforePrep ? "Obligatorio" : "No requerido"}</dd>
            </div>
            {showConfirmationExpiry && (
              <div>
                <dt>Al vencer tiempo de confirmación</dt>
                <dd>{confirmationExpiryLabels[state.payments.confirmationExpiryAction]}</dd>
              </div>
            )}
            <div>
              <dt>Límite de cancelación</dt>
              <dd>{cancellationLimitLabels[state.payments.cancellationLimit]}</dd>
            </div>
          </dl>
        </section>

        {/* 5. Applicable SLAs & out-of-hours summary */}
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>Tiempos objetivo (SLA)</h4>
            <button type="button" className="oc-text-button" onClick={() => void goToStep("fulfillment")}>
              Editar
            </button>
          </div>
          <dl className="oc-summary-list">
            {showConfirmationSla && (
              <div>
                <dt>Confirmación máxima</dt>
                <dd>
                  {Number.isFinite(state.sla.confirmationMinutes)
                    ? `${state.sla.confirmationMinutes} min`
                    : "—"}
                </dd>
              </div>
            )}
            <div>
              <dt>Preparación objetivo</dt>
              <dd>
                {Number.isFinite(state.sla.preparationMinutes)
                  ? `${state.sla.preparationMinutes} min`
                  : "—"}
              </dd>
            </div>
            {showDispatchSla && (
              <div>
                <dt>Despacho estimado</dt>
                <dd>
                  {Number.isFinite(state.sla.dispatchMinutes)
                    ? `${state.sla.dispatchMinutes} min`
                    : "—"}
                </dd>
              </div>
            )}
            <div>
              <dt>Umbral de urgencia</dt>
              <dd>
                {Number.isFinite(state.sla.urgencyThresholdMinutes)
                  ? `${state.sla.urgencyThresholdMinutes} min`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Política fuera de horario</dt>
              <dd>{outOfHoursPolicyLabels[state.sla.outOfHoursPolicy]}</dd>
            </div>
            <div>
              <dt>Respuesta fuera de horario</dt>
              <dd>{state.sla.outOfHoursAutoReply ? "Activa" : "Desactivada"}</dd>
            </div>
          </dl>
          {state.sla.outOfHoursAutoReply && state.sla.outOfHoursMessage.trim() && (
            <div className="oc-quote-preview">{`«${state.sla.outOfHoursMessage.trim()}»`}</div>
          )}
        </section>

        {/* 6. Operators summary */}
        <section className="oc-review-card">
          <div className="oc-review-card-head">
            <h4>{`Operadores asignados (${state.operators.length})`}</h4>
            <button
              type="button"
              className="oc-text-button"
              onClick={() => void goToStep("operators")}
            >
              Editar
            </button>
          </div>
          {state.operators.length === 0 ? (
            <p style={{ color: "var(--oc-muted)" }}>
              Sin operadores adicionales. Operarás como administrador del negocio.
            </p>
          ) : (
            <div className="oc-review-operator-list">
              {state.operators.map((op) => (
                <div key={op.id} className="oc-review-operator-item">
                  <div>
                    <strong>{op.name}</strong>
                    <span className="oc-record-sub">{op.email}</span>
                    {renderOperatorStages(op.stages)}
                  </div>
                  {op.phone && <span className="oc-record-sub">{op.phone}</span>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {state.status === "ready" && allIssues.length === 0 && (
        <div className="oc-alert-success">
          ✓ Esta configuración se encuentra lista y preparada para operar.
        </div>
      )}
    </div>
  );
});
