import { observer } from "mobx-react-lite";
import { Checkbox } from "@/elements/form/checkbox";
import { Input } from "@/elements/form/input";
import { isFreightRiskThresholdApplicable, isWhatsappChannelApplicable, ORDERS_CONFIG_LIMITS, validateStep } from "../../validation";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";
import { parseNumericInput, numericValue } from "./panelPresentation";

export const ConfirmationPanel = observer(({ state, store }: { state: OrdersConfigState; store: OrdersConfigStore }) => {
  const currency = store.currency;
  const fulfillmentIssues = validateStep(state, "fulfillment");
  const whatsappIssue = fulfillmentIssues.find((i) => i.field === "whatsappNumber");
  const riskIssue = fulfillmentIssues.find((i) => i.field === "maxShippingCostRisk");
  const showWhatsappChannel = isWhatsappChannelApplicable(state);
  const showFreightRisk = isFreightRiskThresholdApplicable(state);

  return (
    <div>
      <h3 className="oc-section-title">Confirmación de órdenes</h3>
      <div className="oc-grid-3">
        {(
          [
            {
              id: "manual",
              title: "Revisión manual",
              desc: "Un operador revisa y aprueba cada pedido antes de pasar a la preparación.",
            },
            {
              id: "automatic",
              title: "Automática directa",
              desc: "Los pedidos entran confirmados directo a la cocina o bodega.",
            },
            {
              id: "agent",
              title: "Por agente de WhatsApp",
              desc: "Un asistente interactivo verifica detalles y confirma con el cliente.",
            },
          ] as const
        ).map((f) => {
          const isSelected = state.fulfillment.confirmationMode === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={isSelected}
              className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
              onClick={() => store.setConfirmationMode(f.id)}
            >
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
              <i>✓</i>
            </button>
          );
        })}
      </div>

      {showWhatsappChannel && (
        <div className="oc-inline-panel">
          <div className={`oc-field ${whatsappIssue ? "has-error" : ""}`}>
            <label htmlFor="oc-whatsappNumber">Número de WhatsApp del agente:</label>
            <Input
              id="oc-whatsappNumber"
              type="tel"
              placeholder="+57 300 123 4567"
              value={state.fulfillment.whatsappNumber}
              error={Boolean(whatsappIssue)}
              hint={
                whatsappIssue?.message ??
                "Línea de WhatsApp desde la que el agente confirmará pedidos con tus clientes."
              }
              onChange={(e) => store.setWhatsappNumber(e.target.value)}
            />
          </div>
        </div>
      )}

      {showFreightRisk && (
        <div className="oc-section-block">
          <div className="oc-toggle-box">
            <Checkbox
              id="oc-riskThresholdActive"
              checked={state.fulfillment.riskThresholdActive}
              onChange={(checked) => store.setRiskThreshold(checked)}
              label="Exigir confirmación manual en órdenes con alto costo de flete"
            />
            <span className="oc-toggle-hint">
              Cuando el costo del envío supere el tope configurado, el pedido requerirá revisión manual.
            </span>
            {state.fulfillment.riskThresholdActive && (
              <div className="oc-toggle-nested">
                <div className={`oc-field ${riskIssue ? "has-error" : ""}`}>
                  <label htmlFor="oc-maxShippingCostRisk">
                    {`Tope máximo de envío (${currency}):`}
                  </label>
                  <Input
                    id="oc-maxShippingCostRisk"
                    type="number"
                    min={String(ORDERS_CONFIG_LIMITS.maxShippingCostRisk.min)}
                    max={String(ORDERS_CONFIG_LIMITS.maxShippingCostRisk.max)}
                    step={1}
                    value={numericValue(state.fulfillment.maxShippingCostRisk)}
                    error={Boolean(riskIssue)}
                    hint={riskIssue?.message}
                    onChange={(e) =>
                      store.setRiskThreshold(true, parseNumericInput(e.target.value))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
