import "../styles/orders-config.css";
import "@/css/business-configuration.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { ConfigBusinessSwitcher } from "@/components/configuration/ConfigBusinessSwitcher";
import { RoleShieldBadge } from "@/components/configuration/RoleShieldBadge";
import { Button } from "@/elements/ui/button";
import { adminAccessStore } from "@/modules/business-access/public";
import { WorkspaceSupportDropdown, WorkspaceSupportWidget } from "@/modules/workspace/public";
import { ThemeIconButton } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { OrdersGuide } from "../components/OrdersGuide";
import { ordersConfigStore } from "../ordersConfig.store";
import { validateOrdersConfig } from "../validation";
import { COPY, STEPS, issuePanel, progressStep, type WizardStep } from "../wizard";
import { ProfilePanel } from "../components/panels/ProfilePanel";
import { ModalitiesPanel } from "../components/panels/ModalitiesPanel";
import { ConfirmationPanel } from "../components/panels/ConfirmationPanel";
import { FulfillmentPanel } from "../components/panels/FulfillmentPanel";
import { PaymentsPanel } from "../components/panels/PaymentsPanel";
import { OperatorsPanel } from "../components/panels/OperatorsPanel";
import { ReviewPanel } from "../components/panels/ReviewPanel";

export const OrdersConfigPage = observer(() => {
  const { businessId, step: stepParam } = useParams();
  const navigate = useNavigate();
  const store = ordersConfigStore;
  const [signingOut, setSigningOut] = useState(false);
  const currentStep = (STEPS.some((s) => s.id === stepParam) ? stepParam : stepParam === "sla" ? "fulfillment" : "profile") as WizardStep;
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  // Without a businessId in the URL, open the sole eligible business with Pedidos or redirect to access.
  useEffect(() => {
    if (businessId) return;
    let cancelled = false;
    void (async () => {
      let target = "/business/access";
      try {
        if (await adminAccessStore.ensureSession()) {
          const withPedidos = adminAccessStore.businesses.filter((b) => b.modules.includes("pedidos"));
          if (withPedidos.length === 1) target = `/business/pedidos/${withPedidos[0].id}/profile`;
        }
      } catch {
        // Offline or session error: /business/access will display its own notice.
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
    if (store.status === "signed-out") {
      navigate("/business/access", { replace: true });
    }
  }, [store.status, navigate]);

  // Keep visitedSteps and active step synced when navigating via URL or browser history.
  useEffect(() => {
    if (store.status === "ready" && store.state) {
      void store.setStep(progressStep(currentStep));
    }
  }, [store, store.status, currentStep]);
  const goToStep = async (target: WizardStep) => {
    if (!businessId || store.saving) return;
    await store.setStep(progressStep(target));
    navigate(`/business/pedidos/${businessId}/${target}`);
    window.scrollTo({ top: 0 });
  };

  const goModules = async () => {
    if (!businessId || store.saving) return;
    const ok = await store.flushDirtySections();
    if (!ok) return;
    navigate(`/business/setup/${businessId}`);
  };

  const switchBusiness = async (targetBusinessId: string) => {
    if (!businessId || targetBusinessId === businessId || store.saving) return;
    const ok = await store.flushDirtySections();
    if (!ok) return;
    navigate(`/business/pedidos/${targetBusinessId}`);
  };

  const handleNext = async () => {
    if (store.saving) return;
    if (stepIndex < STEPS.length - 1) {
      await goToStep(STEPS[stepIndex + 1].id);
      return;
    }
    const result = await store.completeSetup();
    if (!result.ok) return;
    navigate(`/business/app/${businessId}/pedidos/dashboard`);
  };

  const handlePrev = async () => {
    if (store.saving) return;
    if (stepIndex > 0) {
      await goToStep(STEPS[stepIndex - 1].id);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await adminAccessStore.leave("Sesión cerrada. Verifica tu correo para volver a entrar.");
    setSigningOut(false);
    navigate("/business/access", { replace: true });
  };
  if (store.status === "loading" || store.status === "idle" || store.status === "signed-out") {
    return (
      <div className="oc-root">
        <div className="oc-status-shell">
          <p role="status" style={{ color: "var(--oc-muted)" }}>
            Cargando configuración de Pedidos…
          </p>
        </div>
      </div>
    );
  }

  if (store.status === "error") {
    return (
      <div className="oc-root">
        <div className="oc-status-shell">
          <div className="oc-card oc-empty">
            <BrandCardDecor />
            <h2>No pudimos abrir la configuración</h2>
            <p>{store.errorMessage}</p>
            <div className="oc-empty-actions">
              <Button
                type="button"
                className="oc-primary"
                onClick={() => businessId && void store.load(businessId)}
              >
                Reintentar
              </Button>
              {businessId && (
                <Link to={`/business/setup/${businessId}`} className="oc-secondary">
                  Volver a mis módulos
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (store.status === "blocked" || store.status === "unavailable" || !store.state) {
    return (
      <div className="oc-root">
        <div className="oc-status-shell">
          <div className="oc-card oc-empty">
            <BrandCardDecor />
            <h2>Módulo no disponible</h2>
            <p>{store.error ?? "No tienes permisos sobre este negocio."}</p>
            <div className="oc-empty-actions">
              <Link
                to={businessId ? `/business/setup/${businessId}` : "/business/access"}
                className="oc-primary"
              >
                Volver a mis módulos
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { state } = store;
  const business = store.business ?? adminAccessStore.businesses.find((b) => b.id === businessId);
  const currency = store.currency;
  const withPedidos = adminAccessStore.businesses.filter((b) => b.modules.includes("pedidos"));
  const copy = COPY[currentStep];

  const visited = new Set(state.visitedSteps);
  const allIssues = validateOrdersConfig(state);
  return (
    <section className="oc-root" aria-label="Configuración del módulo de Pedidos">
      <PageMeta title={`Necto · ${copy.document}`} />

      {/* HEADER */}
      <header className="oc-header">
        <Link
          to={businessId ? `/business/setup/${businessId}` : "/business/access"}
          className="oc-logo"
          aria-label="Necto, mis módulos"
          onClick={(event) => {
            if (!businessId) return;
            event.preventDefault();
            void goModules();
          }}
        >
          <NectoLogo width={161} height={23} />
        </Link>
        <div className="oc-header-context">
          <RoleShieldBadge role="Administrador" />
          <span className="oc-module-label">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-8 7 3 3 5-5" />
            </svg>
            Pedidos
          </span>
          <ConfigBusinessSwitcher
            currentBusinessId={businessId ?? ""}
            currentBusinessName={business?.name ?? "Tu negocio"}
            subtitle="Módulo de Pedidos"
            businesses={withPedidos.map((b) => ({
              id: b.id,
              name: b.id === businessId && business ? business.name : b.name,
              category: b.category,
              categoryOther: b.categoryOther,
            }))}
            quickLinks={
              businessId
                ? [
                    {
                      id: "modules",
                      label: "Panel de módulos",
                      description: "Volver a los módulos de mi negocio",
                      onSelect: () => void goModules(),
                    },
                    {
                      id: "pedidos",
                      label: "Módulo de Pedidos",
                      description: state.status === "ready" ? "Configuración preparada" : "Configuración actual",
                      active: true,
                      onSelect: () => undefined,
                    },
                    {
                      id: "operacion",
                      label: "Operación de Pedidos",
                      description: "Ir al espacio de trabajo del módulo",
                      onSelect: () => navigate(`/business/app/${businessId}/pedidos/dashboard`),
                    },
                  ]
                : []
            }
            onSwitchSpace={() => navigate("/business/access")}
            disabled={store.saving}
            onSelect={(id) => void switchBusiness(id)}
          />
          <ThemeIconButton className="oc-icon-button" />
          <WorkspaceSupportDropdown triggerClassName="config-icon-button" />
          <button
            type="button"
            className="oc-signout-btn"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            disabled={signingOut}
            onClick={() => void signOut()}
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
            <span className="oc-signout-label">Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* LAYOUT */}
      <main className="oc-layout">
        {/* SIDEBAR */}
        <aside className="oc-sidebar">
          <Link
            className="oc-back"
            to={businessId ? `/business/setup/${businessId}` : "/business/access"}
            onClick={(event) => {
              if (!businessId) return;
              event.preventDefault();
              void goModules();
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Volver a módulos</span>
          </Link>
          <div className="oc-sidebar-title">
            <span className="oc-module-symbol">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-8 7 3 3 5-5" />
              </svg>
            </span>
            <div>
              <strong>Pedidos</strong>
              <p>{business?.name ?? ""}</p>
            </div>
          </div>
          <nav className="oc-step-nav" aria-label="Pasos de Pedidos">
            {STEPS.map((s, idx) => {
              const isVisited = visited.has(progressStep(s.id));
              const isCurrent = currentStep === s.id;
              const isReview = s.id === "review";
              const stepIssues = isReview ? allIssues : allIssues.filter(issue => issuePanel(issue) === s.id);
              const isInvalid = isVisited && !isCurrent && stepIssues.length > 0;
              const done = isReview
                ? !isCurrent && state.status === "ready" && allIssues.length === 0
                : isVisited && !isCurrent && stepIssues.length === 0;
              const navClass = isInvalid ? "is-invalid" : done ? "is-complete" : undefined;

              return (
                <button
                  key={s.id}
                  type="button"
                  className={navClass}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Paso ${idx + 1}: ${s.nav}`}
                  disabled={store.saving}
                  onClick={() => void goToStep(s.id)}
                >
                  <span>{isInvalid ? "!" : done ? "✓" : String(idx + 1)}</span>
                  <div>
                    <strong>{s.nav}</strong>
                    <span className="oc-nav-short" aria-hidden="true">
                      {s.short}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* STAGE */}
        <div className="oc-stage">
          <header className="oc-stage-heading">
            <span className="oc-eyebrow">{`PASO ${stepIndex + 1} DE ${STEPS.length} · CONFIGURACIÓN DE PEDIDOS`}</span>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </header>

          <div className="config-step-workspace">
            <div className="config-form-col">
              <div key={businessId} className="oc-card">
                <BrandCardDecor />

                {currentStep === "profile" && <ProfilePanel state={state} store={store} />}
                {currentStep === "modalities" && <ModalitiesPanel state={state} store={store} />}
                {currentStep === "confirmation" && <ConfirmationPanel state={state} store={store} />}
                {currentStep === "fulfillment" && <FulfillmentPanel state={state} store={store} businessId={businessId} />}
                {currentStep === "payments" && <PaymentsPanel state={state} store={store} />}
                {currentStep === "operators" && <OperatorsPanel state={state} store={store} />}
                {currentStep === "review" && <ReviewPanel state={state} store={store} goToStep={goToStep} />}
                {store.saveError && (
                  <div className="oc-alert-error" role="alert">
                    <span>{store.saveError}</span>
                  </div>
                )}

                {/* FORM FOOTER */}
                <footer className="oc-form-footer">
                  <span>{`Paso ${stepIndex + 1} de ${STEPS.length}`}</span>
                  <div>
                    {stepIndex > 0 && (
                      <Button
                        variant="outline"
                        type="button"
                        className="oc-secondary"
                        disabled={store.saving}
                        onClick={() => void handlePrev()}
                      >
                        Atrás
                      </Button>
                    )}
                    <Button
                      type="button"
                      className="oc-primary"
                      disabled={store.saving || (currentStep === "review" && allIssues.length > 0)}
                      onClick={() => void handleNext()}
                    >
                      {store.saving
                        ? "Guardando…"
                        : stepIndex === STEPS.length - 1
                          ? "Guardar configuración de Pedidos"
                          : "Siguiente"}
                    </Button>
                  </div>
                </footer>
              </div>
            </div>

            <aside className="config-guide-col">
              <OrdersGuide step={progressStep(currentStep)} state={state} currency={currency} />
            </aside>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="oc-footer">
        <span>© 2026 Necto</span>
      </footer>
      <WorkspaceSupportWidget />
    </section>
  );
});

export default OrdersConfigPage;
