import { useEffect, useRef } from "react";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { WorkspaceAnnouncementBanner } from "@/components/configuration/WorkspaceAnnouncementBanner";
import {
  ALL_OPERATOR_STAGES,
  type ModalityType,
  type OrderOperatorStage,
  type PedidosOperatorView,
} from "../../types";

const stageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

const stageDescriptions: Record<OrderOperatorStage, string> = {
  confirmation: "Recepción, validación de pago y confirmación de pedidos entrantes en tiempo real.",
  preparation: "Organiza el alistamiento, cocina o empaque respetando los tiempos objetivo.",
  dispatch: "Coordina el despacho con mensajería propia, transportadoras o entrega en local.",
};

const modalityLabels: Record<ModalityType, string> = {
  delivery: "Envío a domicilio",
  pickup: "Retiro en local",
  on_site: "En el establecimiento",
};

export function OperationDashboard({ view, operatorCount, onOpenConfig }: {
  view: PedidosOperatorView;
  operatorCount: number;
  onOpenConfig?: () => void;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
    const firstName = view.operator.name.trim().split(/\s+/)[0] || view.operator.name;
    const assignedSet = new Set(view.operator.stages);

    return (
      <section className="oc-dash" aria-labelledby="oc-dash-greeting">
        {/* TOP GREETING BAR */}
        <header className="oc-dash-topbar">
          <div className="oc-dash-greeting">
            <span className="oc-dash-eyebrow">MI NEGOCIO · ESPACIO DE TRABAJO</span>
            <h1 id="oc-dash-greeting" ref={headingRef} tabIndex={-1}>
              {`Qué bueno verte, ${firstName}.`}
            </h1>
            <p>{`Este es el pulso de ${view.business.name}. Conecta con lo que necesita tu negocio hoy.`}</p>
          </div>
          {onOpenConfig && (
            <div className="oc-dash-top-actions">
              <button type="button" className="oc-dash-config-btn" onClick={onOpenConfig}>
                Ver configuración
              </button>
            </div>
          )}
        </header>

        {/* 3-SLIDE ANNOUNCEMENT HERO BANNER */}
        <WorkspaceAnnouncementBanner />

        {/* 4 KPI CARDS */}
        <section className="oc-dash-kpi-grid" aria-label="Indicadores del módulo de Pedidos">
          <article className="oc-dash-kpi-card">
            <div className="oc-dash-kpi-head">
              <span className="oc-dash-kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="4" y="4" width="6" height="6" rx="1.5" />
                  <rect x="14" y="4" width="6" height="6" rx="1.5" />
                  <rect x="4" y="14" width="6" height="6" rx="1.5" />
                  <rect x="14" y="14" width="6" height="6" rx="1.5" />
                </svg>
              </span>
              <span className="oc-dash-kpi-label">Modalidades habilitadas</span>
            </div>
            <strong className="oc-dash-kpi-value">{view.modalities.length}</strong>
            <span className="oc-dash-kpi-foot">
              {view.modalities.map((m) => modalityLabels[m]).join(" · ") || "Asignadas a este negocio"}
            </span>
          </article>

          <article className="oc-dash-kpi-card">
            <div className="oc-dash-kpi-head">
              <span className="oc-dash-kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 7h14l1 13H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="oc-dash-kpi-label">Pedidos esperando</span>
            </div>
            <strong className="oc-dash-kpi-value">0</strong>
            <span className="oc-dash-kpi-foot">En el módulo de Pedidos</span>
          </article>

          <article className="oc-dash-kpi-card">
            <div className="oc-dash-kpi-head">
              <span className="oc-dash-kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="oc-dash-kpi-label">Pedidos completados</span>
            </div>
            <strong className="oc-dash-kpi-value">
              0 <small>hoy</small>
            </strong>
            <span className="oc-dash-kpi-foot">Durante esta jornada</span>
          </article>

          <article className="oc-dash-kpi-card">
            <div className="oc-dash-kpi-head">
              <span className="oc-dash-kpi-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
                </svg>
              </span>
              <span className="oc-dash-kpi-label">Operadores activos</span>
            </div>
            <strong className="oc-dash-kpi-value">{operatorCount}</strong>
            <span className="oc-dash-kpi-foot">Equipo de Pedidos</span>
          </article>
        </section>

        {/* STAGES SECTION */}
        <div className="oc-dash-section-head">
          <div>
            <h2>{`Las etapas de ${view.business.name}`}</h2>
            <p>Un espacio propio para cada parte de tu operación.</p>
          </div>
          <span className="oc-dash-count-pill">{`${view.operator.stages.length} habilitadas`}</span>
        </div>

        <section className="oc-dash-stage-grid" aria-label="Etapas operativas de Pedidos">
          {ALL_OPERATOR_STAGES.map((stage) => {
            const isAssigned = assignedSet.has(stage);
            return (
              <article key={stage} className="oc-dash-stage-card">
                <BrandCardDecor />
                <div className="oc-dash-stage-top">
                  <span className={`oc-dash-stage-icon is-${stage}`}>
                    {stage === "confirmation" ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M9 12l2 2 4-4m5 2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : stage === "preparation" ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M5 7h14l1 13H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={`oc-dash-status-badge ${isAssigned ? "is-ready" : "is-pending"}`}>
                    {isAssigned ? "Configurado" : "Pendiente"}
                  </span>
                </div>
                <h3>{stageLabels[stage]}</h3>
                <p style={{ marginBottom: 0 }}>{stageDescriptions[stage]}</p>
              </article>
            );
          })}
        </section>
      </section>
    );
}
