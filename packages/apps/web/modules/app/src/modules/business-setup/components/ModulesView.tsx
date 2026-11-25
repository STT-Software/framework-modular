import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { WorkspaceAnnouncementBanner } from "@/components/configuration/WorkspaceAnnouncementBanner";
import { adminAccessStore } from "@/modules/business-access";
import { businessSetupStore } from "../stores/businessSetup.store";
import { ModuleIcon } from "./ModuleIcon";

interface ModulesViewProps {
  onStart: () => void;
  onConfigure: (moduleId: string) => void;
  onOpenModule?: (moduleId: string) => void;
}

/** La primera pantalla: el espacio de trabajo del negocio con sus módulos habilitados, indicadores y estado de configuración. */
export const ModulesView = observer(({ onStart, onConfigure, onOpenModule }: ModulesViewProps) => {
  const state = businessSetupStore.state;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [openingModuleId, setOpeningModuleId] = useState<string | null>(null);
  const [startingBase, setStartingBase] = useState(false);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
  if (!state) return null;
  const count = state.modules.length;
  const ready = state.progress.baseReady;
  const started = state.progress.currentStep !== null;

  const readyModules = state.modules.filter((m) => m.settings.status === "ready");
  const readyModulesCount = readyModules.length;
  const primaryModule =
    readyModules.find((m) => m.id === "pedidos" || m.id === "turnos") ??
    state.modules.find((m) => m.id === "pedidos" || m.id === "turnos") ??
    state.modules[0] ??
    null;

  const pedidosModule = state.modules.find((m) => m.id === "pedidos");
  const turnosModule = state.modules.find((m) => m.id === "turnos");
  const totalOperators = state.modules.reduce((acc, m) => acc + (m.settings.summary?.operatorCount ?? 0), 0);
  const activeChannelsCount =
    (pedidosModule?.settings.summary?.modalityCount ?? 0) + (turnosModule?.settings.summary?.queueCount ?? 0);

  const rawPersonName =
    adminAccessStore.access?.personName ??
    adminAccessStore.accesses.find((a) => a.businessId === state.business.id)?.personName ??
    "Administrador";
  const firstName = rawPersonName.trim().split(/\s+/)[0] || "Administrador";

  const handlePrimaryHeroAction = () => {
    if (primaryModule && primaryModule.settings.status === "ready" && onOpenModule) {
      setOpeningModuleId(primaryModule.id);
      setTimeout(() => onOpenModule(primaryModule.id), 350);
      return;
    }
    if (primaryModule) {
      setOpeningModuleId(primaryModule.id);
      setTimeout(() => onConfigure(primaryModule.id), 350);
      return;
    }
    setStartingBase(true);
    setTimeout(onStart, 350);
  };

  return (
    <section className="no-enter" aria-labelledby="no-modules-title">
      {/* TOP GREETING BAR */}
      <div className="no-ws-topbar">
        <div className="no-ws-greeting">
          <span className="no-ws-eyebrow">MI NEGOCIO · ESPACIO DE TRABAJO</span>
          <h1 id="no-modules-title" ref={headingRef} tabIndex={-1}>
            {`Qué bueno verte, ${firstName}.`}
          </h1>
          <p>
            {`Este es el pulso de ${state.profile.name}. Conecta con lo que necesita tu negocio hoy.`}
          </p>
        </div>
        <button
          type="button"
          className="no-ws-config-btn"
          disabled={startingBase}
          onClick={() => {
            setStartingBase(true);
            setTimeout(onStart, 350);
          }}
        >
          {startingBase ? "Abriendo…" : "Ver configuración"}
        </button>
      </div>

      {/* 3-SLIDE ANNOUNCEMENT HERO BANNER */}
      <WorkspaceAnnouncementBanner />

      {/* 4 KPI CARDS */}
      <div className="no-ws-kpi-grid" aria-label="Indicadores del negocio">
        <article className="no-ws-kpi-card">
          <div className="no-ws-kpi-head">
            <span className="no-ws-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="4" width="6" height="6" rx="1.5" />
                <rect x="14" y="4" width="6" height="6" rx="1.5" />
                <rect x="4" y="14" width="6" height="6" rx="1.5" />
                <rect x="14" y="14" width="6" height="6" rx="1.5" />
              </svg>
            </span>
            <span className="no-ws-kpi-label">Módulos habilitados</span>
          </div>
          <strong className="no-ws-kpi-value">{count}</strong>
          <span className="no-ws-kpi-foot">Asignados a este negocio</span>
        </article>

        <article className="no-ws-kpi-card">
          <div className="no-ws-kpi-head">
            <span className="no-ws-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 7h14l1 13H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="no-ws-kpi-label">
              {pedidosModule ? "Modalidades y filas" : "Filas de atención"}
            </span>
          </div>
          <strong className="no-ws-kpi-value">{activeChannelsCount}</strong>
          <span className="no-ws-kpi-foot">
            {pedidosModule && turnosModule
              ? "En Pedidos y Turnos"
              : pedidosModule
                ? "En el módulo de Pedidos"
                : "En el módulo de Turnos"}
          </span>
        </article>

        <article className="no-ws-kpi-card">
          <div className="no-ws-kpi-head">
            <span className="no-ws-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="no-ws-kpi-label">Módulos preparados</span>
          </div>
          <strong className="no-ws-kpi-value">
            {readyModulesCount} <small>hoy</small>
          </strong>
          <span className="no-ws-kpi-foot">Durante esta jornada</span>
        </article>

        <article className="no-ws-kpi-card">
          <div className="no-ws-kpi-head">
            <span className="no-ws-kpi-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
              </svg>
            </span>
            <span className="no-ws-kpi-label">Operadores activos</span>
          </div>
          <strong className="no-ws-kpi-value">{totalOperators}</strong>
          <span className="no-ws-kpi-foot">
            {pedidosModule && turnosModule
              ? "Equipo de Pedidos y Turnos"
              : pedidosModule
                ? "Equipo de Pedidos"
                : "Equipo de Turnos"}
          </span>
        </article>
      </div>

      <div className="no-section-heading">
        <div>
          <h2>{`Los módulos de ${state.profile.name}`}</h2>
          <p>Un espacio propio para cada parte de tu operación.</p>
        </div>
        <span className="no-ws-count-pill">{`${count} ${count === 1 ? "habilitado" : "habilitados"}`}</span>
      </div>
      {count > 0 ? (
        <div className={`no-assigned-grid${count === 1 ? " is-single" : ""}`}>
          {state.modules.map((module) => {
            const isModuleReady = module.settings.status === "ready";
            const isOpening = openingModuleId === module.id;
            return (
              <article key={module.id} className="no-module-card">
                <BrandCardDecor />
                <div className="no-module-card-top">
                  <ModuleIcon id={module.id} />
                  <span className={`no-module-assigned${isModuleReady ? " is-configured" : ""}`}>
                    {isModuleReady ? "Configurado" : "Asignado"}
                  </span>
                </div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <div className="no-module-card-footer">
                  <span>
                    {isModuleReady
                      ? "Configuración preparada"
                      : ready
                        ? "Ajustes específicos pendientes"
                        : "Configuración pendiente"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {isModuleReady && onOpenModule && (module.id === "pedidos" || module.id === "turnos") && (
                      <button
                        type="button"
                        className="no-ws-open-module-btn"
                        disabled={openingModuleId !== null}
                        onClick={() => {
                          setOpeningModuleId(module.id);
                          setTimeout(() => onOpenModule(module.id), 350);
                        }}
                      >
                        {isOpening ? "Abriendo…" : `Abrir ${module.name}`}
                      </button>
                    )}
                    <button
                      type="button"
                      className={isOpening ? "is-loading" : undefined}
                      disabled={openingModuleId !== null}
                      aria-label={`Configurar ${module.name}`}
                      onClick={() => {
                        setOpeningModuleId(module.id);
                        setTimeout(() => onConfigure(module.id), 350);
                      }}
                    >
                      {isOpening
                        ? "Abriendo…"
                        : isModuleReady
                          ? "Ver configuración"
                          : module.id === "turnos" || module.id === "pedidos"
                            ? "Configurar"
                            : ready
                              ? "Revisar base"
                              : "Configurar"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="no-empty-modules">
          <h3>Aún no hay módulos asignados</h3>
          <p>Puedes preparar los datos de tu negocio. Tu superadministrador podrá habilitar sus funcionalidades.</p>
        </div>
      )}
    </section>
  );
});
