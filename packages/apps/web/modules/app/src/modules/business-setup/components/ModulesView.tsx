import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { NectoLogo } from "@/brand/NectoLogo";
import { businessSetupStore } from "../stores/businessSetup.store";
import { ModuleIcon } from "./ModuleIcon";

const NODE_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [17, 29],
  [44, 5],
  [76, 27],
  [73, 64],
  [34, 73],
  [7, 60],
];

interface ModulesViewProps {
  onStart: () => void;
  onConfigure: (moduleId: string) => void;
}

/** La primera pantalla: los módulos que el superadministrador habilitó para ESTE negocio y el estado de la base. */
export const ModulesView = observer(({ onStart, onConfigure }: ModulesViewProps) => {
  const state = businessSetupStore.state;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [openingModuleId, setOpeningModuleId] = useState<string | null>(null);
  const [startingBase, setStartingBase] = useState(false);

  useEffect(() => headingRef.current?.focus({ preventScroll: true }), []);
  if (!state) return null;
  const count = state.modules.length;
  const ready = state.progress.baseReady;
  const started = state.progress.currentStep !== null;
  return (
    <section className="no-enter" aria-labelledby="no-modules-title">
      <div className="no-welcome">
        <div className="no-welcome-copy">
          <span className="no-eyebrow">
            <i />
            TU NEGOCIO. TUS POSIBILIDADES.
          </span>
          <h1 id="no-modules-title" ref={headingRef} tabIndex={-1}>
            Todo empieza con
            <br />
            una buena configuración<span>.</span>
          </h1>
          <p>
            Este es el espacio de <strong>{state.profile.name}</strong>. Prepara sus datos, define sus horarios y deja la base lista para tus módulos.
          </p>
          <div className="no-welcome-meta">
            <span>{count === 1 ? "1 módulo asignado" : `${count} módulos asignados`}</span>
            <span className={ready ? "is-ready" : undefined}>{ready ? "Base preparada" : "Base por preparar"}</span>
          </div>
          <button
            className={`no-primary${startingBase ? " is-loading" : ""}`}
            type="button"
            disabled={startingBase}
            onClick={() => {
              setStartingBase(true);
              setTimeout(onStart, 450);
            }}
          >
            {startingBase
              ? "Abriendo configuración base…"
              : ready
                ? "Revisar configuración base "
                : started
                  ? "Continuar configuración "
                  : "Preparar mi negocio "}
            {!startingBase && <span aria-hidden="true">→</span>}
          </button>
        </div>
        <div className="no-module-motion" aria-hidden="true">
          <svg viewBox="0 0 390 280" fill="none">
            <circle cx="196" cy="136" r="99" />
            <ellipse cx="196" cy="136" rx="155" ry="72" transform="rotate(-22 196 136)" />
            <path d="M69 161Q74 50 203 51M323 104Q322 213 196 228" pathLength="1" className="no-connect-line" />
            <path
              d="m72 70 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Zm253 117 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
              className="no-motion-spark"
            />
            <ellipse cx="196" cy="249" rx="94" ry="7" className="no-motion-shadow" />
          </svg>
          <div className="no-motion-center">
            <NectoLogo variant="mark" width={48} height={48} />
            <span>Grow together</span>
          </div>
          <div>
            {state.modules.map((module, index) => (
              <span
                key={module.id}
                className="no-motion-node"
                style={{ left: `${NODE_POSITIONS[index][0]}%`, top: `${NODE_POSITIONS[index][1]}%` }}
              >
                <ModuleIcon id={module.id} />
              </span>
            ))}
          </div>
          <span className="no-motion-chip">
            <i />
            Un espacio propio para crecer
          </span>
        </div>
      </div>
      <div className="no-section-heading">
        <div>
          <h2>
            Los módulos de tu negocio <span>{count}</span>
          </h2>
          <p>Habilitados por tu superadministrador, solo para este negocio.</p>
        </div>
        <span className="no-assignment-label">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6" />
          </svg>
          Asignación por negocio
        </span>
      </div>
      {count > 0 ? (
        <div className={`no-assigned-grid${count === 1 ? " is-single" : ""}`}>
          {state.modules.map((module) => {
            const isOrdersReady =
              module.id === "pedidos" &&
              (() => {
                try {
                  const raw = localStorage.getItem(`necto.orders_config.v1.${businessSetupStore.businessId}`);
                  return raw ? JSON.parse(raw).status === "ready" : false;
                } catch {
                  return false;
                }
              })();
            const isModuleReady = module.settings.status === "ready" || isOrdersReady;
            const isOpening = openingModuleId === module.id;
            return (
              <article key={module.id} className="no-module-card">
                <div className="no-module-card-top">
                  <ModuleIcon id={module.id} />
                  <span className="no-module-assigned">Asignado</span>
                </div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <div className="no-module-card-footer">
                  <span>{isModuleReady ? "Configuración preparada" : ready ? "Ajustes específicos pendientes" : "Configuración pendiente"}</span>
                  <button
                    type="button"
                    className={isOpening ? "is-loading" : undefined}
                    disabled={openingModuleId !== null}
                    aria-label={`Configurar ${module.name}`}
                    onClick={() => {
                      setOpeningModuleId(module.id);
                      setTimeout(() => onConfigure(module.id), 450);
                    }}
                  >
                    {isOpening
                      ? "Abriendo…"
                      : isModuleReady
                        ? "Revisar configuración"
                        : module.id === "turnos" || module.id === "pedidos"
                          ? "Configurar"
                          : ready
                            ? "Revisar base"
                            : "Configurar"}
                  </button>
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
      <div className="no-next-note">
        <span className="no-note-number">01</span>
        <p>
          <strong>Primero, la base de tu negocio.</strong> Después añadiremos los pasos de configuración de cada módulo.
        </p>
        <span aria-hidden="true">↗</span>
      </div>
    </section>
  );
});
