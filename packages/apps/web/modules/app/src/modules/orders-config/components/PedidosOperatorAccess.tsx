import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { Button } from "@/elements/ui/button";
import { pedidosOperatorStore } from "../stores/pedidosOperator.store";
import { ALL_OPERATOR_STAGES, type ConfirmationMode, type ModalityType, type OrderOperatorStage } from "../types";
import { initialsOf } from "../validation";

const stageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

const modalityLabels: Record<ModalityType, string> = {
  delivery: "Envío a domicilio",
  pickup: "Retiro en local",
  on_site: "En el establecimiento",
};

const confirmationLabels: Record<ConfirmationMode, string> = {
  manual: "Revisión manual",
  automatic: "Automática",
  agent: "Por agente de WhatsApp",
};

/**
 * Read-only operator landing screen for Pedidos: shows the signed-in operator's profile,
 * assigned stages, active modalities, and schedule status without administrative controls.
 */
export const PedidosOperatorAccess = observer(
  ({ onSignOut, signingOut }: { onSignOut: () => void; signingOut: boolean }) => {
    const store = pedidosOperatorStore;
    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => headingRef.current?.focus({ preventScroll: true }), [store.status]);

    const view = store.view;
    const ready = store.status === "ready" && view !== null;
    const loading = store.status === "idle" || store.status === "loading";
    const firstName = ready ? (view.operator.name.trim().split(/\s+/)[0] || view.operator.name) : "";

    return (
      <main className="oc-access">
        <div className="oc-access-symbol" aria-hidden="true">
          <NectoLogo variant="mark" width={64} height={64} />
        </div>
        <span className="oc-eyebrow">ACCESO DE OPERADOR · PEDIDOS</span>
        <h1 ref={headingRef} tabIndex={-1}>
          {ready
            ? `Hola, ${firstName}.`
            : loading
              ? "Un momento…"
              : "Necesitas una asignación vigente."}
        </h1>
        <p>
          {ready
            ? `Tu acceso a ${view.business.name} está verificado.`
            : loading
              ? "Verificando tu acceso al módulo de Pedidos…"
              : store.status === "error"
                ? (store.error ?? "No pudimos abrir tu acceso.")
                : "Pide al administrador que revise tu acceso y tus etapas asignadas en Pedidos."}
        </p>

        {ready && (
          <>
            <div className="oc-card oc-access-card">
              <BrandCardDecor />
              <div className="oc-access-person">
                <span className="oc-person-avatar">{initialsOf(view.operator.name)}</span>
                <div>
                  <h2>{view.operator.name}</h2>
                  <p>{view.operator.email}</p>
                  {view.operator.phone && <p>{view.operator.phone}</p>}
                </div>
                <span className="oc-badge-role">Operador</span>
              </div>

              <div className="oc-access-section">
                <h3>Tus etapas asignadas</h3>
                <div className="oc-stage-badges">
                  {view.operator.stages.length === ALL_OPERATOR_STAGES.length ? (
                    <span className="oc-stage-badge">Todas las etapas</span>
                  ) : (
                    view.operator.stages.map((stage) => (
                      <span key={stage} className="oc-stage-badge">
                        {stageLabels[stage]}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="oc-access-section">
                <h3>Modalidades activas del negocio</h3>
                <div className="oc-chip-list">
                  {view.modalities.map((modality) => (
                    <span key={modality} className="oc-chip">
                      {modalityLabels[modality]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="oc-access-section">
                <h3>Estado de operación</h3>
                <div className="oc-access-meta-row">
                  <span
                    className={`oc-schedule-pill ${
                      view.schedule.openNow === true
                        ? "is-open"
                        : view.schedule.openNow === false
                          ? "is-closed"
                          : "is-neutral"
                    }`}
                  >
                    <i aria-hidden="true" />
                    {view.schedule.openNow === true
                      ? "Abierto ahora"
                      : view.schedule.openNow === false
                        ? "Fuera de horario"
                        : "Horario por confirmar"}
                  </span>
                  <span className="oc-access-meta-text">
                    {`Confirmación: ${confirmationLabels[view.confirmationMode]} · ${
                      view.schedule.inherit ? "Horario del negocio" : "Horario propio de Pedidos"
                    }`}
                  </span>
                </div>
              </div>

              <p className="oc-help-note">
                Este es el resumen de tu acceso. El tablero de recepción y despacho de pedidos se añadirá en la
                siguiente etapa.
              </p>
            </div>

            <div className="oc-info-box oc-access-info">
              <p>
                <strong>Acceso limitado a este módulo.</strong>
                <span>
                  Tu asignación como operador de Pedidos no concede permisos de administrador ni acceso a otros módulos.
                </span>
              </p>
            </div>
          </>
        )}

        <Button variant="outline" className="oc-secondary" type="button" disabled={signingOut} onClick={onSignOut}>
          Cerrar sesión
        </Button>
      </main>
    );
  },
);
