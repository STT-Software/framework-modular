import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "../styles/turnos.css";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { adminAccessStore } from "@/modules/business-access";
import { ThemeIconButton } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { Icon } from "../components/Icon";
import { ICONS } from "../components/icons";
import { OperatorAccess } from "../components/OperatorAccess";
import { OperatorsPanel } from "../components/OperatorsPanel";
import { ProfilePanel } from "../components/ProfilePanel";
import { QueuesPanel } from "../components/QueuesPanel";
import { ReviewPanel } from "../components/ReviewPanel";
import { RulesPanel } from "../components/RulesPanel";
import { SavedDialog } from "../components/SavedDialog";
import { operatorStore } from "../stores/operator.store";
import { turnosStore } from "../stores/turnos.store";
import { TURNOS_STEPS, type TurnosStep } from "../types";

const isStep = (value: string | undefined): value is TurnosStep => TURNOS_STEPS.includes(value as TurnosStep);
const pathOf = (businessId: string, step: TurnosStep | "operator") => `/business/turnos/${businessId}/${step}`;

const COPY: Record<TurnosStep, { nav: string; short: string; hint: string; title: string; description: string; document: string }> = {
  profile: {
    nav: "Perfil del negocio",
    short: "Perfil",
    hint: "Una base para tus filas",
    title: "Una atención a tu medida.",
    description: "El perfil de tu negocio nos ayuda a sugerir las primeras filas. Tú decides cuáles conservar.",
    document: "Perfil de Turnos",
  },
  queues: {
    nav: "Filas de atención",
    short: "Filas",
    hint: "Tu servicio, organizado",
    title: "Cada servicio, en su lugar.",
    description: "Revisa las filas sugeridas, personalízalas o crea otras para organizar tu atención.",
    document: "Filas de atención",
  },
  rules: {
    nav: "Reglas de turnos",
    short: "Reglas",
    hint: "Valores predeterminados",
    title: "Las reglas que dan orden.",
    description: "Define la numeración, la urgencia y cuándo una fila está ocupada o llena.",
    document: "Reglas de Turnos",
  },
  operators: {
    nav: "Operadores",
    short: "Equipo",
    hint: "Las personas que conectan",
    title: "Las personas que conectan.",
    description: "Asigna una o varias filas a cada operador. Su acceso pertenece solo a Turnos.",
    document: "Operadores de Turnos",
  },
  review: {
    nav: "Revisión",
    short: "Revisión",
    hint: "Todo en su lugar",
    title: "Todo listo para el siguiente paso.",
    description: "Revisa tus filas, las reglas y el equipo antes de guardar la configuración de Turnos.",
    document: "Revisión de Turnos",
  },
};

/**
 * La configuración de Turnos de un negocio, para su administrador, y la vista de su operador (la misma sesión de `business-access`):
 *   /business/turnos/:businessId/<profile|queues|rules|operators|review>   los cinco pasos
 *   /business/turnos/:businessId/operator                                  lo que ve un operador
 * Filas, operadores y perfil se guardan en el servidor al confirmar su diálogo, y las reglas al avanzar; recargar o volver otro día recupera lo guardado.
 */
const TurnosPage = observer(() => {
  const { businessId, step: stepParam } = useParams();
  const navigate = useNavigate();
  const store = turnosStore;
  const rootRef = useRef<HTMLElement>(null);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isOperator = stepParam === "operator";
  const view: TurnosStep = isStep(stepParam) ? stepParam : "profile";

  // Sin negocio en la dirección: si la persona administra uno solo con Turnos, se abre; si no, elige en el acceso.
  useEffect(() => {
    if (businessId) return;
    let cancelled = false;
    void (async () => {
      let target = "/business/access";
      try {
        if (await adminAccessStore.ensureSession()) {
          const withTurnos = adminAccessStore.businesses.filter((business) => business.modules.includes("turnos"));
          if (withTurnos.length === 1) target = pathOf(withTurnos[0].id, "profile");
        }
      } catch {
        // Sin conexión: el acceso mostrará su propio aviso.
      }
      if (!cancelled) navigate(target, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, navigate]);

  // Carga lo que corresponde al rol: la configuración (administrador) o su vista (operador). El servidor decide si puede.
  useEffect(() => {
    if (!businessId) return;
    if (isOperator) void operatorStore.load(businessId);
    else void store.load(businessId);
    return () => {
      store.reset();
      operatorStore.reset();
    };
  }, [businessId, isOperator, store]);

  const signedOut = isOperator ? operatorStore.status === "signed-out" : store.status === "signed-out";
  useEffect(() => {
    if (signedOut) navigate("/business/access", { replace: true });
  }, [signedOut, navigate]);

  // Recuerda en el servidor el paso en el que está el administrador, también al recargar.
  useEffect(() => {
    if (!isOperator && store.status === "ready") void store.rememberStep(view);
  }, [isOperator, store, store.status, view]);

  // Cada pantalla vuelve a entrar con su animación (si la persona no pidió menos movimiento).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.remove("nt-motion");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void root.offsetWidth;
    root.classList.add("nt-motion");
  }, [view, isOperator, store.status]);

  const go = useCallback(
    async (target: TurnosStep) => {
      if (!businessId || store.saving) return;
      const result = await store.leaveStep(view, target);
      if (!result.ok) {
        store.announce(result.fix === "queues" ? "Crea al menos una fila antes de continuar." : "Revisa las reglas indicadas.");
        navigate(pathOf(businessId, result.fix));
        return;
      }
      navigate(pathOf(businessId, target));
      window.scrollTo({ top: 0 });
    },
    [businessId, navigate, store, view],
  );

  const goModules = useCallback(async () => {
    if (!businessId || store.saving) return;
    await store.leaveStep(view, "profile");
    navigate(`/business/setup/${businessId}`);
  }, [businessId, navigate, store, view]);

  const next = useCallback(async () => {
    if (!businessId || store.saving) return;
    const index = TURNOS_STEPS.indexOf(view);
    if (index < TURNOS_STEPS.length - 1) {
      await go(TURNOS_STEPS[index + 1]);
      return;
    }
    const result = await store.complete();
    if (result.ok) {
      store.announce("Configuración de Turnos guardada. La atención de turnos llegará en la siguiente etapa.");
      setSaved(true);
    } else if (result.fix) {
      store.announce(result.message);
      navigate(pathOf(businessId, result.fix));
    }
  }, [businessId, go, navigate, store, view]);

  const signOut = async () => {
    setSigningOut(true);
    await adminAccessStore.leave("Sesión cerrada. Verifica tu correo para volver a entrar.");
    setSigningOut(false);
    navigate("/business/access", { replace: true });
  };

  const switchBusiness = async (id: string) => {
    if (!businessId || id === businessId) return;
    await store.leaveStep(view, "profile");
    navigate(pathOf(id, "profile"));
  };

  const state = store.state;
  const ready = store.status === "ready" && state !== null;
  const withTurnos = adminAccessStore.businesses.filter((business) => business.modules.includes("turnos"));
  const index = TURNOS_STEPS.indexOf(view);
  const copy = COPY[view];
  const visited = new Set(state?.progress.visitedSteps ?? []);
  const title = isOperator ? "Necto · Acceso de operador" : ready ? `Necto · ${copy.document}` : "Necto · Turnos";

  return (
    <section ref={rootRef} className="nt-root" aria-label="Configuración del módulo de Turnos">
      <PageMeta title={title} />
      <header className="nt-header">
        <Link to={isOperator || !businessId ? "/business/access" : `/business/setup/${businessId}`} className="nt-logo" aria-label={isOperator ? "Necto, mi acceso de operador" : "Necto, mis módulos"}>
          <NectoLogo width={161} height={23} />
        </Link>
        <div className="nt-header-context">
          <span className="nt-module-label">
            <Icon paths={ICONS.queue} />
            Turnos
          </span>
          {!isOperator && (
            <label>
              <span>NEGOCIO</span>
              <select aria-label="Negocio de Turnos" value={businessId ?? ""} disabled={withTurnos.length < 2 || store.saving} onChange={(event) => void switchBusiness(event.target.value)}>
                {withTurnos.length === 0 && <option value={businessId ?? ""}>{state?.business.name ?? "Tu negocio"}</option>}
                {withTurnos.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.id === businessId && state ? state.business.name : business.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ThemeIconButton className="nt-icon-button" />
        </div>
      </header>

      {isOperator ? (
        <OperatorAccess onSignOut={() => void signOut()} signingOut={signingOut} />
      ) : (
        <main className="nt-layout">
          <aside className="nt-sidebar">
            <Link className="nt-back" to={businessId ? `/business/setup/${businessId}` : "/business/access"} onClick={(event) => { event.preventDefault(); void goModules(); }}>
              Mis módulos
            </Link>
            <div className="nt-sidebar-title">
              <span className="nt-module-symbol">
                <Icon paths={ICONS.queue} />
              </span>
              <div>
                <strong>
                  Un buen turno
                  <br />
                  empieza aquí.
                </strong>
                <p>{state?.business.name ?? ""}</p>
              </div>
            </div>
            <nav className="nt-step-nav" aria-label="Pasos de Turnos">
              {TURNOS_STEPS.map((id, i) => {
                const done = ready && i < index && (visited.has(id) || i < index);
                return (
                  <button key={id} type="button" className={done ? "is-complete" : undefined} aria-current={i === index ? "step" : undefined} aria-label={`Paso ${i + 1}: ${COPY[id].nav}`} disabled={!ready || store.saving} onClick={() => void go(id)}>
                    <span>{done ? "✓" : String(i + 1)}</span>
                    <div>
                      <strong>{COPY[id].nav}</strong>
                      <span className="nt-nav-short" aria-hidden="true">
                        {COPY[id].short}
                      </span>
                      <small>{COPY[id].hint}</small>
                    </div>
                  </button>
                );
              })}
            </nav>
            <div className="nt-sidebar-note">
              <span aria-hidden="true">
                <NectoLogo variant="mark" width={64} height={64} />
              </span>
              <p>
                Menos espera.
                <br />
                Más conexiones.
              </p>
              <small>Configuración exclusiva de este negocio y de su módulo de Turnos.</small>
            </div>
          </aside>
          <div className="nt-stage">
            {store.status === "blocked" ? (
              <div className="nt-card nt-empty">
                <h2>Turnos no está asignado a este negocio</h2>
                <p>Consulta con tu superadministrador para habilitar este módulo.</p>
                <Link className="nt-secondary" to={businessId ? `/business/setup/${businessId}` : "/business/access"}>
                  Ver mis módulos
                </Link>
              </div>
            ) : store.status === "unavailable" ? (
              <div className="nt-card nt-empty">
                <h2>Este negocio ya no está disponible para ti</h2>
                <p>Pudo haberse pausado o asignarse a otra persona. Entra de nuevo para ver los negocios a los que tienes acceso.</p>
                <Link className="nt-primary" to="/business/access">
                  Ir al acceso
                </Link>
              </div>
            ) : store.status === "error" ? (
              <div className="nt-card nt-empty">
                <h2>No pudimos abrir la configuración</h2>
                <p>{store.error}</p>
                <button type="button" className="nt-primary" onClick={() => businessId && void store.load(businessId)}>
                  Reintentar
                </button>
              </div>
            ) : (
              <>
                <header className="nt-stage-heading">
                  <span className="nt-eyebrow">{`PASO ${index + 1} DE 5 · CONFIGURACIÓN DE TURNOS`}</span>
                  <h1 tabIndex={-1}>{copy.title}</h1>
                  <p>{copy.description}</p>
                </header>
                {ready ? (
                  <div>
                    {view === "profile" && <ProfilePanel />}
                    {view === "queues" && <QueuesPanel />}
                    {view === "rules" && <RulesPanel />}
                    {view === "operators" && <OperatorsPanel />}
                    {view === "review" && <ReviewPanel onEdit={(target) => void go(target)} />}
                    {store.error && (
                      <p className="nt-error" role="alert">
                        {store.error}
                      </p>
                    )}
                    <footer className="nt-form-footer">
                      <span>{`Paso ${index + 1} de 5`}</span>
                      <div>
                        <button type="button" className="nt-secondary" disabled={store.saving} onClick={() => (index === 0 ? void goModules() : void go(TURNOS_STEPS[index - 1]))}>
                          {index === 0 ? "Volver a módulos" : "Atrás"}
                        </button>
                        {view === "operators" && (state?.operators.length ?? 0) === 0 && (
                          <button type="button" className="nt-text-button" disabled={store.saving} onClick={() => void go("review")}>
                            Continuar sin agregar
                          </button>
                        )}
                        <button type="button" className="nt-primary" disabled={store.saving} onClick={() => void next()}>
                          {store.saving ? "Guardando…" : index === 4 ? "Guardar configuración" : "Siguiente"}
                        </button>
                      </div>
                    </footer>
                  </div>
                ) : (
                  <p className="nt-muted" role="status">
                    Un momento…
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      )}

      <footer className="nt-footer">
        <span>© 2026 Necto · Conecta. Comparte. Crece.</span>
        <button type="button" className="nt-text-button" disabled={signingOut} onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      </footer>
      <SavedDialog
        open={saved}
        onClose={() => {
          setSaved(false);
          if (businessId) navigate(`/business/setup/${businessId}`);
        }}
      />
      <p className="nt-sr-only" role="status" aria-live="polite">
        {store.announcement}
      </p>
    </section>
  );
});

export default TurnosPage;
