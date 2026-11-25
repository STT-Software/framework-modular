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
export const ModulesView = observer(({ onStart, onConfigure }: ModulesViewProps) => {
  const state = businessSetupStore.state;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [openingModuleId, setOpeningModuleId] = useState<string | null>(null);
  const [startingBase, setStartingBase] = useState(false);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
  if (!state) return null;
  const count = state.modules.length;
  const ready = state.progress.baseReady;

  const rawPersonName =
    adminAccessStore.access?.personName ??
    adminAccessStore.accesses.find((a) => a.businessId === state.business.id)?.personName ??
    "Administrador";
  const firstName = rawPersonName.trim().split(/\s+/)[0] || "Administrador";

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
