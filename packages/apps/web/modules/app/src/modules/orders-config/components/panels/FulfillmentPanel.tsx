import { observer } from "mobx-react-lite";
import { Link, useNavigate } from "react-router";
import { Checkbox } from "@/elements/form/checkbox";
import { Input } from "@/elements/form/input";
import { Button } from "@/elements/ui/button";
import { isConfirmationSlaApplicable, isDispatchSlaApplicable, isFlatShippingFeeApplicable, isFreeShippingThresholdApplicable, ORDERS_CONFIG_LIMITS, validateStep } from "../../validation";
import type { OrdersConfigState } from "../../types";
import type { OrdersConfigStore } from "../../ordersConfig.store";
import { parseNumericInput, numericValue } from "./panelPresentation";

export const FulfillmentPanel = observer(({ state, store, businessId }: { state: OrdersConfigState; store: OrdersConfigStore; businessId: string | undefined }) => {
  const navigate = useNavigate();
  const currency = store.currency;
  const fulfillmentIssues = validateStep(state, "fulfillment");
  const slaIssues = validateStep(state, "sla");
  const deliveryChannelIssue = fulfillmentIssues.find((i) => i.field === "deliveryChannel");
  const flatFeeIssue = fulfillmentIssues.find((i) => i.field === "flatShippingFee");
  const freeThresholdIssue = fulfillmentIssues.find((i) => i.field === "freeShippingThreshold");
  const minOrderIssue = fulfillmentIssues.find((i) => i.field === "minimumOrderAmount");
  const prepIssue = slaIssues.find((i) => i.field === "preparationMinutes");
  const urgencyIssue = slaIssues.find((i) => i.field === "urgencyThresholdMinutes");
  const confirmIssue = slaIssues.find((i) => i.field === "confirmationMinutes");
  const dispatchIssue = slaIssues.find((i) => i.field === "dispatchMinutes");
  const outOfHoursIssue = slaIssues.find((i) => i.field === "outOfHoursMessage");

  const hasDelivery = state.modalities.includes("delivery");
  const hasPickup = state.modalities.includes("pickup");
  const showFlatShippingFee = isFlatShippingFeeApplicable(state);
  const showFreeShippingThreshold = isFreeShippingThresholdApplicable(state);
  const showConfirmationSla = isConfirmationSlaApplicable(state);
  const showDispatchSla = isDispatchSlaApplicable(state);

  return (
    <>
    {hasDelivery && (
      <>
        <div className="oc-section-block">
          <h3 className="oc-section-title">Canales de envío a domicilio</h3>
          <div className="oc-toggle-box" style={{ marginBottom: "16px" }}>
            <Checkbox
              id="oc-hasOwnCourier"
              checked={state.fulfillment.hasOwnCourier}
              onChange={(checked) => store.setHasOwnCourier(checked)}
              label="Contamos con mensajería propia"
            />
            <span className="oc-toggle-hint">
              Habilítalo si realizas entregas con domiciliarios propios además o en lugar de
              transportadoras externas.
            </span>
          </div>

          {deliveryChannelIssue && (
            <div className="oc-alert-error" role="alert" style={{ marginBottom: "16px" }}>
              <span>{deliveryChannelIssue.message}</span>
            </div>
          )}

          <h3 className="oc-section-title">Empresas de mensajería y transportadoras</h3>
          <div className="oc-record-list">
            {state.fulfillment.carriers.map((c) => (
              <div key={c.id} className="oc-record-row">
                <div className="oc-record-meta">
                  <strong>{c.name}</strong>
                  {c.isDefault && <span className="oc-badge-default">Predeterminada</span>}
                </div>
                <div className="oc-record-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => store.toggleCarrier(c.id)}
                  >
                    {c.enabled ? "Desactivar" : "Activar"}
                  </Button>
                  {c.enabled && !c.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="oc-favorite-btn"
                      onClick={() => store.setDefaultCarrier(c.id)}
                    >
                      Favorita
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="oc-section-block">
          <h3 className="oc-section-title">Costo de envío y pedido mínimo</h3>
          <div className="oc-grid-3">
            {(
              [
                {
                  id: "fixed",
                  title: "Tarifa fija de envío",
                  desc: "Se aplica un valor estándar de domicilio en todos los pedidos.",
                },
                {
                  id: "free_from",
                  title: "Gratis desde monto mínimo",
                  desc: "Cobras una tarifa base y el envío es gratis si el pedido supera un umbral.",
                },
                {
                  id: "to_confirm",
                  title: "Costo por confirmar con el cliente",
                  desc: "Calculas y acuerdas el valor del envío según destino al confirmar.",
                },
              ] as const
            ).map((option) => {
              const isSelected = state.fulfillment.shippingPricingMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                  onClick={() => store.setShippingPricingMode(option.id)}
                >
                  <strong>{option.title}</strong>
                  <p>{option.desc}</p>
                  <i>✓</i>
                </button>
              );
            })}
          </div>

          {(showFlatShippingFee || showFreeShippingThreshold) && (
            <div className="oc-grid-2" style={{ marginTop: "16px" }}>
              {showFlatShippingFee && (
                <div className={`oc-field ${flatFeeIssue ? "has-error" : ""}`}>
                  <label htmlFor="oc-flatShippingFee">
                    {state.fulfillment.shippingPricingMode === "free_from"
                      ? `Tarifa base de envío (${currency}):`
                      : `Tarifa fija de envío (${currency}):`}
                  </label>
                  <Input
                    id="oc-flatShippingFee"
                    type="number"
                    min={String(ORDERS_CONFIG_LIMITS.flatShippingFee.min)}
                    max={String(ORDERS_CONFIG_LIMITS.flatShippingFee.max)}
                    step={1}
                    value={numericValue(state.fulfillment.flatShippingFee)}
                    error={Boolean(flatFeeIssue)}
                    hint={flatFeeIssue?.message}
                    onChange={(e) => store.setFlatShippingFee(parseNumericInput(e.target.value))}
                  />
                </div>
              )}
              {showFreeShippingThreshold && (
                <div className={`oc-field ${freeThresholdIssue ? "has-error" : ""}`}>
                  <label htmlFor="oc-freeShippingThreshold">
                    {`Envío gratis desde (${currency}):`}
                  </label>
                  <Input
                    id="oc-freeShippingThreshold"
                    type="number"
                    min={String(ORDERS_CONFIG_LIMITS.freeShippingThreshold.min)}
                    max={String(ORDERS_CONFIG_LIMITS.freeShippingThreshold.max)}
                    step={1}
                    value={numericValue(state.fulfillment.freeShippingThreshold)}
                    error={Boolean(freeThresholdIssue)}
                    hint={freeThresholdIssue?.message}
                    onChange={(e) =>
                      store.setFreeShippingThreshold(parseNumericInput(e.target.value))
                    }
                  />
                </div>
              )}
            </div>
          )}

          <div className="oc-toggle-box" style={{ marginTop: "12px" }}>
            <Checkbox
              id="oc-minimumOrderActive"
              checked={state.fulfillment.minimumOrderActive}
              onChange={(checked) => store.setMinimumOrder(checked)}
              label="Exigir pedido mínimo para domicilio"
            />
            <span className="oc-toggle-hint">
              Define el monto mínimo de compra requerido para habilitar envíos a domicilio.
            </span>
            {state.fulfillment.minimumOrderActive && (
              <div className="oc-toggle-nested">
                <div className={`oc-field ${minOrderIssue ? "has-error" : ""}`}>
                  <label htmlFor="oc-minimumOrderAmount">
                    {`Monto mínimo de pedido (${currency}):`}
                  </label>
                  <Input
                    id="oc-minimumOrderAmount"
                    type="number"
                    min={String(ORDERS_CONFIG_LIMITS.minimumOrderAmount.min)}
                    max={String(ORDERS_CONFIG_LIMITS.minimumOrderAmount.max)}
                    step={1}
                    value={numericValue(state.fulfillment.minimumOrderAmount)}
                    error={Boolean(minOrderIssue)}
                    hint={minOrderIssue?.message}
                    onChange={(e) =>
                      store.setMinimumOrder(true, parseNumericInput(e.target.value))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

    {hasPickup && (
      <div className="oc-section-block">
        <h3 className="oc-section-title">Modalidad de retiro en local</h3>
        <div className="oc-grid-2">
          {(
            [
              {
                id: "eventual",
                title: "Retiro inmediato o eventual",
                desc: "El cliente pasa a recoger su pedido en cuanto recibe el aviso de que está listo.",
              },
              {
                id: "fixed",
                title: "Retiro por franjas horarias",
                desc: "Los retiros se organizan en horarios o ventanas fijas de entrega en tienda.",
              },
            ] as const
          ).map((option) => {
            const isSelected = state.fulfillment.pickupMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => store.setPickupMode(option.id)}
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
    <div>
      <h3 className="oc-section-title">Tiempos objetivo del proceso</h3>
      <div className="oc-grid-2">
        <div className={`oc-field ${prepIssue ? "has-error" : ""}`}>
          <label htmlFor="oc-preparationMinutes">
            Tiempo objetivo de preparación (minutos):
          </label>
          <Input
            id="oc-preparationMinutes"
            type="number"
            min={String(ORDERS_CONFIG_LIMITS.preparationMinutes.min)}
            max={String(ORDERS_CONFIG_LIMITS.preparationMinutes.max)}
            step={1}
            value={numericValue(state.sla.preparationMinutes)}
            error={Boolean(prepIssue)}
            hint={prepIssue?.message}
            onChange={(e) =>
              store.updateSla({ preparationMinutes: parseNumericInput(e.target.value) })
            }
          />
        </div>

        <div className={`oc-field ${urgencyIssue ? "has-error" : ""}`}>
          <label htmlFor="oc-urgencyThresholdMinutes">
            Umbral de urgencia en cola (minutos):
          </label>
          <Input
            id="oc-urgencyThresholdMinutes"
            type="number"
            min={String(ORDERS_CONFIG_LIMITS.urgencyThresholdMinutes.min)}
            max={String(ORDERS_CONFIG_LIMITS.urgencyThresholdMinutes.max)}
            step={1}
            value={numericValue(state.sla.urgencyThresholdMinutes)}
            error={Boolean(urgencyIssue)}
            hint={urgencyIssue?.message}
            onChange={(e) =>
              store.updateSla({ urgencyThresholdMinutes: parseNumericInput(e.target.value) })
            }
          />
        </div>

        {showConfirmationSla && (
          <div className={`oc-field ${confirmIssue ? "has-error" : ""}`}>
            <label htmlFor="oc-confirmationMinutes">
              Tiempo máximo para confirmación (minutos):
            </label>
            <Input
              id="oc-confirmationMinutes"
              type="number"
              min={String(ORDERS_CONFIG_LIMITS.confirmationMinutes.min)}
              max={String(ORDERS_CONFIG_LIMITS.confirmationMinutes.max)}
              step={1}
              value={numericValue(state.sla.confirmationMinutes)}
              error={Boolean(confirmIssue)}
              hint={confirmIssue?.message}
              onChange={(e) =>
                store.updateSla({ confirmationMinutes: parseNumericInput(e.target.value) })
              }
            />
          </div>
        )}

        {showDispatchSla && (
          <div className={`oc-field ${dispatchIssue ? "has-error" : ""}`}>
            <label htmlFor="oc-dispatchMinutes">Tiempo estimado de despacho (minutos):</label>
            <Input
              id="oc-dispatchMinutes"
              type="number"
              min={String(ORDERS_CONFIG_LIMITS.dispatchMinutes.min)}
              max={String(ORDERS_CONFIG_LIMITS.dispatchMinutes.max)}
              step={1}
              value={numericValue(state.sla.dispatchMinutes)}
              error={Boolean(dispatchIssue)}
              hint={dispatchIssue?.message}
              onChange={(e) =>
                store.updateSla({ dispatchMinutes: parseNumericInput(e.target.value) })
              }
            />
          </div>
        )}
      </div>

      <div className="oc-section-block">
        <h3 className="oc-section-title">Atención fuera de horario</h3>
        {store.schedule && (
          <div className="oc-schedule-bar">
            <div className="oc-schedule-bar-meta">
              <span
                className={`oc-schedule-pill ${
                  store.schedule.openNow === true
                    ? "is-open"
                    : store.schedule.openNow === false
                      ? "is-closed"
                      : "is-neutral"
                }`}
              >
                <i aria-hidden="true" />
                {store.schedule.openNow === true
                  ? "Abierto ahora"
                  : store.schedule.openNow === false
                    ? "Fuera de horario"
                    : "Horario por confirmar"}
              </span>
              <span>
                {`${
                  store.schedule.inherit ? "Hereda el horario del negocio" : "Horario propio de Pedidos"
                } · ${store.schedule.timezone.replaceAll("_", " ")}`}
              </span>
            </div>
            {businessId && (
              <Link
                to={`/business/setup/${businessId}/schedule`}
                className="oc-schedule-link"
                onClick={(event) => {
                  event.preventDefault();
                  if (store.saving) return;
                  void (async () => {
                    const ok = await store.flushDirtySections();
                    if (!ok) return;
                    navigate(`/business/setup/${businessId}/schedule`);
                  })();
                }}
              >
                Editar horario ↗
              </Link>
            )}
          </div>
        )}
        <div className="oc-grid-2" style={{ marginBottom: "16px" }}>
          {(
            [
              {
                id: "reject",
                title: "Bloquear pedidos y responder automáticamente",
                desc: "No se reciben pedidos fuera del horario de atención y se avisa al cliente.",
              },
              {
                id: "schedule",
                title: "Aceptar como pedido programado",
                desc: "Los clientes pueden dejar su pedido programado para el siguiente horario de atención.",
              },
            ] as const
          ).map((option) => {
            const isSelected = state.sla.outOfHoursPolicy === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => store.updateSla({ outOfHoursPolicy: option.id })}
              >
                <strong>{option.title}</strong>
                <p>{option.desc}</p>
                <i>✓</i>
              </button>
            );
          })}
        </div>

        <div className="oc-toggle-box">
          <Checkbox
            id="oc-outOfHoursAutoReply"
            checked={state.sla.outOfHoursAutoReply}
            onChange={(checked) => store.updateSla({ outOfHoursAutoReply: checked })}
            label="Enviar respuesta automática fuera de horario"
          />
          <span className="oc-toggle-hint">
            Informa automáticamente a tus clientes cuando escriben fuera del horario de atención.
          </span>
          {state.sla.outOfHoursAutoReply && (
            <div className="oc-toggle-nested">
              <div className={`oc-field ${outOfHoursIssue ? "has-error" : ""}`}>
                <label htmlFor="oc-outOfHoursMessage">Mensaje automático fuera de horario:</label>
                <textarea
                  id="oc-outOfHoursMessage"
                  rows={3}
                  placeholder="Escribe el mensaje que recibirán tus clientes fuera del horario de atención."
                  value={state.sla.outOfHoursMessage}
                  aria-invalid={Boolean(outOfHoursIssue)}
                  onChange={(e) => store.updateSla({ outOfHoursMessage: e.target.value })}
                />
                <span className="oc-field-counter">
                  {`${state.sla.outOfHoursMessage.trim().length} / ${ORDERS_CONFIG_LIMITS.outOfHoursMessage.max} caracteres`}
                </span>
                {outOfHoursIssue && (
                  <span className="oc-field-error" role="alert">
                    {outOfHoursIssue.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
});
