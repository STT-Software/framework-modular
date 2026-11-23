import "../styles/business-setup.css";
import "@/css/business-configuration.css";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { adminAccessStore } from "@/modules/business-access";
import type { ModuleId } from "@/modules/businesses";
import { ThemeIconButton } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { RoleShieldBadge } from "@/components/configuration/RoleShieldBadge";
import { ConfigBusinessSwitcher } from "@/components/configuration/ConfigBusinessSwitcher";
import { WorkspaceSupportDropdown, WorkspaceSupportWidget } from "@/modules/workspace";
import { ModulesView } from "../components/ModulesView";
import { SavedDialog } from "../components/SavedDialog";
import { STEP_TITLES, Wizard } from "../components/Wizard";
import { businessSetupStore } from "../stores/businessSetup.store";
import { SETUP_STEPS, type SetupStep } from "../types";
import { Skeleton, SkeletonGroup } from "@/components/skeleton";

type View = SetupStep | "modules";
const isStep = (value: string | undefined): value is SetupStep => SETUP_STEPS.includes(value as SetupStep);
const pathOf = (businessId: string, view: View) => `/business/setup/${businessId}${view === "modules" ? "" : `/${view}`}`;

/**
 * La configuración inicial de un negocio, para su administrador (la sesión es la de `business-access`):
 * /business/setup/:businessId (los módulos) y /business/setup/:businessId/:step (data, schedule, category, review).
 * Cada paso se guarda en el servidor al avanzar; recargar o volver otro día recupera lo guardado.
 */
const BusinessSetupPage = observer(() => {
  const { businessId, step: stepParam } = useParams();
  const navigate = useNavigate();
  const store = businessSetupStore;
  const view: View = isStep(stepParam) ? stepParam : "modules";
  const [saved, setSaved] = useState(false);

  // Sin negocio en la dirección: si la persona administra uno solo, se abre; si no, elige en el acceso.
  useEffect(() => {
    if (businessId) return;
    let cancelled = false;
    void (async () => {
      let target = "/business/access";
      try {
        if (await adminAccessStore.ensureSession()) {
          const only = adminAccessStore.businesses.length === 1 ? adminAccessStore.businesses[0] : null;
          if (only) target = pathOf(only.id, "modules");
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

  useEffect(() => {
    if (!businessId) return;
    void store.load(businessId);
    return () => store.reset();
  }, [businessId, store]);

  useEffect(() => {
    if (store.status === "signed-out") navigate("/business/access", { replace: true });
  }, [store.status, navigate]);

  // Recuerda en el servidor en qué paso está la persona, también al recargar la página.
  useEffect(() => {
    if (store.status === "ready" && view !== "modules") void store.rememberStep(view);
  }, [store, store.status, view]);

  // Un paso con datos por corregir lleva el foco al primer campo con problema.
  const firstError = store.firstFormError;
  useEffect(() => {
    if (view === "data" && firstError) document.getElementById(`no-${firstError}`)?.focus();
  }, [view, firstError]);

  const go = useCallback(
    async (target: View) => {
      if (!businessId || store.saving) return;
      const result = await store.leaveStep(view, target);
      if (!result.ok) {
        store.announce("Revisa los datos indicados.");
        navigate(pathOf(businessId, result.fix));
        return;
      }
      navigate(pathOf(businessId, target));
      window.scrollTo({ top: 0 });
    },
    [businessId, navigate, store, view],
  );

  const submit = useCallback(async () => {
    if (!businessId || store.saving) return;
    if (view !== "review") {
      await go(SETUP_STEPS[SETUP_STEPS.indexOf(view as SetupStep) + 1]);
      return;
    }
    const result = await store.complete();
    if (result.ok) {
      store.announce("Configuración base guardada. Los ajustes específicos de cada módulo siguen pendientes.");
      setSaved(true);
    } else if (result.fix) {
      store.announce("Revisa los datos indicados.");
      navigate(pathOf(businessId, result.fix));
    }
  }, [businessId, go, navigate, store, view]);

  const switchBusiness = async (id: string) => {
    if (!businessId || id === businessId) return;
    await store.leaveStep(view, "modules");
    navigate(pathOf(id, "modules"));
  };

  const state = store.state;
  const ready = store.status === "ready" && state !== null;
  const administered = adminAccessStore.businesses;
  const name = state?.profile.name ?? "tu negocio";
  const startStep: SetupStep = state && !state.progress.baseReady && state.progress.currentStep ? state.progress.currentStep : "data";

  return (
    <section className="no-root" aria-label="Configuración inicial del negocio">
      <PageMeta title={view === "modules" ? `Necto · Los módulos de ${name}` : `Necto · ${STEP_TITLES[view]}`} />
      <header className="no-header">
        <Link to={businessId ? pathOf(businessId, "modules") : "/business/access"} className="no-logo" aria-label="Necto, módulos de mi negocio">
          <NectoLogo width={161} height={23} />
        </Link>
        <div className="no-header-actions">
          <RoleShieldBadge role="Administrador" />
          <ConfigBusinessSwitcher
            currentBusinessId={businessId ?? ""}
            currentBusinessName={state ? state.profile.name : name}
            subtitle="Configuración base"
            businesses={administered.map((business) => ({
              id: business.id,
              name: business.id === businessId && state ? state.profile.name : business.name,
              category: business.category,
              categoryOther: business.categoryOther,
            }))}
            disabled={store.saving}
            onSelect={(id) => void switchBusiness(id)}
          />
          <ThemeIconButton className="no-icon-button" />
          <WorkspaceSupportDropdown triggerClassName="config-icon-button" />
          <button
            type="button"
            className="no-signout-btn"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            disabled={store.saving}
            onClick={() => {
              void adminAccessStore.leave("Sesión cerrada. Verifica tu correo para volver a entrar.").then(() => navigate("/business/access", { replace: true }));
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="no-signout-label">Cerrar sesión</span>
          </button>
        </div>
      </header>
      <main className="no-main">
        {store.status === "loading" || store.status === "idle" ? (
          <SkeletonGroup className="sk-stack" style={{ ["--sk-gap" as string]: "16px" }}>
            <Skeleton width="45%" height={30} />
            <Skeleton width="70%" height={14} />
            <Skeleton height={56} radius={12} style={{ marginTop: 8 }} />
            <Skeleton height={56} radius={12} />
            <Skeleton height={56} radius={12} />
            <Skeleton width={160} height={44} radius={10} style={{ marginTop: 8 }} />
          </SkeletonGroup>
        ) : null}
        {store.status === "unavailable" && (
          <div className="no-empty-modules">
            <h3>Este negocio ya no está disponible para ti</h3>
            <p>Pudo haberse pausado o asignarse a otra persona. Entra de nuevo para ver los negocios que administras.</p>
            <Link className="no-primary" to="/business/access">
              Ir al acceso
            </Link>
          </div>
        )}
        {store.status === "error" && (
          <div className="no-empty-modules">
            <h3>No pudimos abrir la configuración</h3>
            <p>{store.error}</p>
            <button type="button" className="no-primary" onClick={() => businessId && void store.load(businessId)}>
              Reintentar
            </button>
          </div>
        )}
        {ready && view === "modules" && (
          <ModulesView
            onStart={() => void go(startStep)}
            onConfigure={(moduleId) => {
              // Turnos y Pedidos se configuran en sus propios asistentes; los demás empiezan por la base.
              if (moduleId === "turnos" && businessId) {
                navigate(`/business/turnos/${businessId}/profile`);
                return;
              }
              if (moduleId === "pedidos" && businessId) {
                navigate(`/business/pedidos/${businessId}/profile`);
                return;
              }
              store.setHoursScope(moduleId as ModuleId);
              void go("data");
            }}
          />
        )}
        {ready && view !== "modules" && businessId && (
          <Wizard
            step={view}
            categoryPath={pathOf(businessId, "category")}
            onGo={(target) => void go(target)}
            onSubmit={() => void submit()}
            onViewModule={(moduleId) => {
              store.setHoursScope(moduleId as ModuleId);
              void go("schedule");
            }}
          />
        )}
      </main>
      <footer className="no-footer">
        <span>© 2026 Necto</span>
      </footer>
      <SavedDialog
        hasTurnos={state?.turnos != null}
        open={saved}
        onClose={() => {
          setSaved(false);
          if (businessId) navigate(pathOf(businessId, "modules"));
        }}
      />
      <p className="no-sr-only" role="status" aria-live="polite">
        {store.announcement}
      </p>
      <WorkspaceSupportWidget />
    </section>
  );
});

export default BusinessSetupPage;
