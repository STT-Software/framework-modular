import { Button } from "@/elements/ui/button";
import "../styles/orders-config.css";
import "@/css/business-configuration.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { adminAccessStore } from "@/modules/business-access";
import { ThemeIconButton } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { RoleShieldBadge } from "@/components/configuration/RoleShieldBadge";
import { ConfigBusinessSwitcher } from "@/components/configuration/ConfigBusinessSwitcher";
import { BrandBackdrop } from "@/components/configuration/BrandBackdrop";
import { WorkspaceSupportDropdown, WorkspaceSupportWidget } from "@/modules/workspace";
import { OrdersGuide } from "../components/OrdersGuide";
import { ORDERS_PROFILE_ICONS } from "../components/icons";
import { PROFILE_DEFAULTS } from "../constants";
import { ordersConfigStore } from "../ordersConfig.store";
import type { ModalityType, OrdersConfigStep, OrdersProfileId } from "../types";

const modalityLabels = { delivery: "Envío a domicilio", pickup: "Retiro en local", on_site: "En el establecimiento" };
const confirmationLabels = { manual: "Manual", automatic: "Automática", agent: "Por agente" };

const STEPS: { id: OrdersConfigStep; nav: string; short: string; hint: string }[] = [
  { id: "profile", nav: "Perfil del negocio", short: "Perfil", hint: "Rubro y base de operación" },
  { id: "modalities", nav: "Modalidades de entrega", short: "Modalidades", hint: "Domicilio, retiro o en sitio" },
  { id: "fulfillment", nav: "Envíos y reglas", short: "Envíos", hint: "Transportadoras y aceptación" },
  { id: "sla", nav: "Tiempos objetivo", short: "Tiempos", hint: "Metas de preparación" },
  { id: "operators", nav: "Operadores", short: "Equipo", hint: "Personal de atención" },
  { id: "review", nav: "Revisión", short: "Revisión", hint: "Confirmar configuración" },
];

const COPY: Record<OrdersConfigStep, { title: string; description: string; document: string }> = {
  profile: {
    title: "Perfil de pedidos",
    description: "El rubro de tu negocio nos ayuda a sugerir las modalidades, transportadoras y tiempos de preparación iniciales.",
    document: "Perfil de Pedidos",
  },
  modalities: {
    title: "Modalidades de entrega",
    description: "Elige las formas en que tus clientes van a recibir o consumir tus productos.",
    document: "Modalidades de Pedidos",
  },
  fulfillment: {
    title: "Confirmación y envíos",
    description: "Configura si aceptas pedidos de forma manual o automática y qué empresas de mensajería están activas.",
    document: "Envíos y reglas",
  },
  sla: {
    title: "Tiempos de atención",
    description: "Define el tiempo objetivo de preparación y despacho para activar alertas preventivas en el tablero.",
    document: "Tiempos de Pedidos",
  },
  operators: {
    title: "Operadores de pedidos",
    description: "Asigna operadores a la gestión de pedidos para que puedan acceder y atender el flujo de entregas.",
    document: "Operadores de Pedidos",
  },
  review: {
    title: "Revisar configuración de pedidos",
    description: "Revisa las modalidades, los envíos y los tiempos antes de guardar la configuración de Pedidos.",
    document: "Revisión de Pedidos",
  },
};

export const OrdersConfigPage = observer(() => {
  const { businessId, step: stepParam } = useParams();
  const navigate = useNavigate();
  const store = ordersConfigStore;

  const [newOpName, setNewOpName] = useState("");
  const [newOpEmail, setNewOpEmail] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const currentStep = (STEPS.some((s) => s.id === stepParam) ? stepParam : "profile") as OrdersConfigStep;
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  useEffect(() => {
    if (!businessId) {
      navigate("/business/access", { replace: true });
      return;
    }
    void store.load(businessId);
    return () => store.reset();
  }, [businessId, navigate, store]);

  useEffect(() => {
    if (store.status === "signed-out") {
      navigate("/business/access", { replace: true });
    }
  }, [store.status, navigate]);

  const goToStep = (target: OrdersConfigStep) => {
    store.setStep(target);
    navigate(`/business/pedidos/${businessId}/${target}`);
    window.scrollTo({ top: 0 });
  };

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      goToStep(STEPS[stepIndex + 1].id);
    } else {
      store.completeSetup();
      navigate(`/business/setup/${businessId}`);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      goToStep(STEPS[stepIndex - 1].id);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await adminAccessStore.leave("Sesión cerrada. Verifica tu correo para volver a entrar.");
    setSigningOut(false);
    navigate("/business/access", { replace: true });
  };

  if (store.status === "loading" || store.status === "idle") {
    return (
      <div className="oc-root">
        <div style={{ padding: "5rem", textAlign: "center", color: "var(--oc-muted)" }}>
          Cargando configuración de Pedidos…
        </div>
      </div>
    );
  }

  if (store.status === "blocked" || store.status === "unavailable" || !store.state) {
    return (
      <div className="oc-root">
        <div style={{ padding: "5rem", textAlign: "center" }}>
          <h2>Módulo no disponible</h2>
          <p style={{ margin: "1rem 0 2rem", color: "var(--oc-muted)" }}>
            {store.error ?? "No tienes permisos sobre este negocio."}
          </p>
          <Link to={`/business/setup/${businessId}`} className="oc-primary">
            Volver a mis módulos
          </Link>
        </div>
      </div>
    );
  }

  const { state } = store;
  const business = store.business ?? adminAccessStore.businesses.find((b) => b.id === businessId);
  const copy = COPY[currentStep];

  return (
    <section className="oc-root" aria-label="Configuración del módulo de Pedidos">
      <BrandBackdrop />
      <PageMeta title={`Necto · ${copy.document}`} />

      {/* HEADER */}
      <header className="oc-header">
        <Link to={businessId ? `/business/setup/${businessId}` : "/business/access"} className="oc-logo" aria-label="Necto, mis módulos">
          <NectoLogo width={161} height={23} />
        </Link>
        <div className="oc-header-context">
          <RoleShieldBadge role="Administrador" />
          <span className="oc-module-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2m-8 7 3 3 5-5" />
            </svg>
            Pedidos
          </span>
          <ConfigBusinessSwitcher
            currentBusinessId={businessId ?? ""}
            currentBusinessName={business?.name ?? "Tu negocio"}
            subtitle="Módulo de Pedidos"
            businesses={adminAccessStore.businesses.map((b) => ({
              id: b.id,
              name: b.name,
              category: b.category,
              categoryOther: b.categoryOther,
            }))}
            onSelect={(id) => navigate(`/business/orders/${id}`)}
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
          <Link className="oc-back" to={businessId ? `/business/setup/${businessId}` : "/business/access"}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Volver a módulos</span>
          </Link>
          <div className="oc-sidebar-title">
            <span className="oc-module-symbol">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
              const done = idx < stepIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={done ? "is-complete" : undefined}
                  aria-current={currentStep === s.id ? "step" : undefined}
                  aria-label={`Paso ${idx + 1}: ${s.nav}`}
                  onClick={() => goToStep(s.id)}
                >
                  <span>{done ? "✓" : String(idx + 1)}</span>
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
            <span className="oc-eyebrow">{`PASO ${stepIndex + 1} DE 6 · CONFIGURACIÓN DE PEDIDOS`}</span>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </header>

          <div className="config-step-workspace">
            <div className="config-form-col">
              <div className="oc-card">
            {/* PASO 1: PERFIL */}
            {currentStep === "profile" && (
              <div>
                <h3 style={{ marginBottom: "1rem" }}>Selecciona el perfil principal</h3>
                <div className="oc-grid-2">
                  {(["food", "fashion", "general", "services"] as OrdersProfileId[]).map((profId) => {
                    const p = PROFILE_DEFAULTS[profId];
                    const isSelected = state.profile === profId;
                    return (
                      <button
                        key={profId}
                        type="button"
                        aria-pressed={isSelected}
                        className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => store.setProfile(profId)}
                      >
                        <span className="oc-profile-icon">
                          <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ORDERS_PROFILE_ICONS[profId] }} />
                        </span>
                        <strong>{p.name}</strong>
                        <p>{p.description}</p>
                        <i>✓</i>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PASO 2: MODALIDADES */}
            {currentStep === "modalities" && (
              <div>
                <h3 style={{ marginBottom: "1rem" }}>Formas de entrega y atención</h3>
                <div className="oc-grid-3">
                  {[
                    { id: "delivery", title: "Envío a domicilio", desc: "Entrega con mensajería propia urbana o transportadora nacional con guía." },
                    { id: "pickup", title: "Retiro en local", desc: "El cliente pasa a recoger personalmente su pedido listo." },
                    { id: "on_site", title: "En sitio / Mesa", desc: "Atención y consumo directo en tu establecimiento comercial." },
                  ].map((m) => {
                    const isSelected = state.modalities.includes(m.id as ModalityType);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={isSelected}
                        className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => store.toggleModality(m.id as ModalityType)}
                      >
                        <strong>{m.title}</strong>
                        <p>{m.desc}</p>
                        <div style={{ marginTop: "1rem", fontSize: "12px", fontWeight: "600", color: isSelected ? "var(--oc-cyan)" : "var(--oc-muted)" }}>
                          {isSelected ? "✓ Habilitado" : "+ Habilitar"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PASO 3: ENVÍOS Y REGLAS */}
            {currentStep === "fulfillment" && (
              <div>
                <h3 style={{ marginBottom: "0.75rem" }}>Confirmación de órdenes</h3>
                <div className="oc-grid-3" style={{ marginBottom: "2rem" }}>
                  {[
                    { id: "manual", title: "Revisión manual", desc: "Un operador revisa y aprueba cada pedido antes de pasar a la preparación." },
                    { id: "automatic", title: "Automática directa", desc: "Los pedidos entran confirmados directo a la cocina o bodega." },
                    { id: "agent", title: "Por agente de WhatsApp", desc: "Un asistente interactivo verifica detalles y confirma con el cliente." },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={state.fulfillment.confirmationMode === f.id}
                      className={`oc-select-card ${state.fulfillment.confirmationMode === f.id ? "is-selected" : ""}`}
                      onClick={() => store.setConfirmationMode(f.id as "manual" | "automatic" | "agent")}
                    >
                      <strong>{f.title}</strong>
                      <p>{f.desc}</p>
                    </button>
                  ))}
                </div>

                <div style={{ padding: "1.25rem", border: "1px solid var(--oc-border)", borderRadius: "12px", marginBottom: "2rem" }}>
                  <label style={{ display: "flex", gap: "0.75rem", alignItems: "center", cursor: "pointer", fontWeight: "600" }}>
                    <input
                      type="checkbox"
                      checked={state.fulfillment.riskThresholdActive}
                      onChange={(e) => store.setRiskThreshold(e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "#FF3F1A" }}
                    />
                    Exigir confirmación manual en órdenes con alto costo de flete
                  </label>
                  {state.fulfillment.riskThresholdActive && (
                    <div style={{ marginTop: "1rem" }}>
                      <label style={{ display: "block", fontSize: "13px", marginBottom: "0.25rem", color: "var(--oc-muted)" }}>
                        Tope máximo de envío (COP):
                      </label>
                      <input
                        type="number"
                        style={{ maxWidth: "220px", height: "42px", padding: "8px 12px", border: "1px solid var(--oc-border)", borderRadius: "8px" }}
                        value={state.fulfillment.maxShippingCostRisk}
                        onChange={(e) => store.setRiskThreshold(true, Number(e.target.value))}
                      />
                    </div>
                  )}
                </div>

                {state.modalities.includes("delivery") && (
                  <div>
                    <h3 style={{ marginBottom: "0.75rem" }}>Empresas de mensajería y transportadoras</h3>
                    <div style={{ display: "grid", gap: "10px" }}>
                      {state.fulfillment.carriers.map((c) => (
                        <div
                          key={c.id}
                          className="oc-record-row"
                        >
                          <div>
                            <strong>{c.name}</strong>
                            {c.isDefault && (
                              <span style={{ marginLeft: "0.5rem", fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "var(--oc-cyan-soft)", color: "var(--oc-cyan)", fontWeight: "600" }}>
                                Predeterminada
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              className="oc-secondary"
                              style={{ minHeight: "36px", padding: "6px 12px", fontSize: "13px" }}
                              onClick={() => store.toggleCarrier(c.id)}
                            >
                              {c.enabled ? "Desactivar" : "Activar"}
                            </button>
                            {c.enabled && !c.isDefault && (
                              <button
                                type="button"
                                className="oc-secondary"
                                style={{ minHeight: "36px", padding: "6px 12px", fontSize: "13px", color: "var(--oc-cyan)" }}
                                onClick={() => store.setDefaultCarrier(c.id)}
                              >
                                Favorita
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 4: TIEMPOS / SLA */}
            {currentStep === "sla" && (
              <div>
                <h3 style={{ marginBottom: "1.25rem" }}>Tiempos objetivo del proceso</h3>
                <div className="oc-grid-2">
                  <div className="oc-field">
                    <label htmlFor="oc-preparationMinutes">Tiempo objetivo de preparación (minutos):</label>
                    <input
                      id="oc-preparationMinutes"
                      type="number"
                      value={state.sla.preparationMinutes}
                      onChange={(e) => store.updateSla({ preparationMinutes: Number(e.target.value) })}
                    />
                  </div>
                  <div className="oc-field">
                    <label htmlFor="oc-urgencyThresholdMinutes">Umbral de urgencia en cola (minutos):</label>
                    <input
                      id="oc-urgencyThresholdMinutes"
                      type="number"
                      value={state.sla.urgencyThresholdMinutes}
                      onChange={(e) => store.updateSla({ urgencyThresholdMinutes: Number(e.target.value) })}
                    />
                  </div>
                  <div className="oc-field">
                    <label htmlFor="oc-confirmationMinutes">Tiempo máximo para confirmación (minutos):</label>
                    <input
                      id="oc-confirmationMinutes"
                      type="number"
                      value={state.sla.confirmationMinutes}
                      onChange={(e) => store.updateSla({ confirmationMinutes: Number(e.target.value) })}
                    />
                  </div>
                  <div className="oc-field">
                    <label htmlFor="oc-dispatchMinutes">Tiempo estimado de despacho (minutos):</label>
                    <input
                      id="oc-dispatchMinutes"
                      type="number"
                      value={state.sla.dispatchMinutes}
                      onChange={(e) => store.updateSla({ dispatchMinutes: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PASO 5: OPERADORES */}
            {currentStep === "operators" && (
              <div>
                <h3 style={{ marginBottom: "1rem" }}>Agregar operador al equipo</h3>
                <div style={{ display: "flex", gap: "12px", marginBottom: "2rem", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    style={{ flex: 1, minWidth: "180px", height: "46px", padding: "10px 13px", border: "1px solid var(--oc-border)", borderRadius: "8px" }}
                    value={newOpName}
                    onChange={(e) => setNewOpName(e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="Correo de acceso"
                    style={{ flex: 1, minWidth: "180px", height: "46px", padding: "10px 13px", border: "1px solid var(--oc-border)", borderRadius: "8px" }}
                    value={newOpEmail}
                    onChange={(e) => setNewOpEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    className="oc-primary"
                    disabled={!newOpName.trim() || !newOpEmail.trim()}
                    onClick={() => {
                      store.addOperator({ name: newOpName, email: newOpEmail });
                      setNewOpName("");
                      setNewOpEmail("");
                    }}
                  >
                    + Agregar operador
                  </button>
                </div>

                <h3 style={{ marginBottom: "0.75rem" }}>Equipo asignado ({state.operators.length})</h3>
                {state.operators.length === 0 ? (
                  <div style={{ padding: "2.5rem 1rem", textAlign: "center", border: "1px dashed var(--oc-border)", borderRadius: "12px", color: "var(--oc-muted)" }}>
                    No hay operadores adicionales. Como administrador puedes operar directamente todas las órdenes.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {state.operators.map((op) => (
                      <div
                        key={op.id}
                        className="oc-record-row"
                      >
                        <div>
                          <strong>{op.name}</strong>
                          <span style={{ display: "block", fontSize: "13px", color: "var(--oc-muted)" }}>{op.email}</span>
                        </div>
                        <button
                          type="button"
                          className="oc-text-button"
                          style={{ color: "#d92d20" }}
                          onClick={() => store.removeOperator(op.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PASO 6: REVISIÓN */}
            {currentStep === "review" && (
              <div>
                <h3 style={{ marginBottom: "1.25rem" }}>Resumen de la configuración</h3>
                <div className="oc-grid-2" style={{ marginBottom: "1.5rem" }}>
                  <div style={{ padding: "1.25rem", border: "1px solid var(--oc-border)", borderRadius: "10px" }}>
                    <small style={{ color: "var(--oc-muted)", display: "block", marginBottom: "4px" }}>Rubro / Perfil</small>
                    <strong>{PROFILE_DEFAULTS[state.profile].name}</strong>
                  </div>
                  <div style={{ padding: "1.25rem", border: "1px solid var(--oc-border)", borderRadius: "10px" }}>
                    <small style={{ color: "var(--oc-muted)", display: "block", marginBottom: "4px" }}>Modalidades</small>
                    <strong>{state.modalities.map((mode) => modalityLabels[mode]).join(", ")}</strong>
                  </div>
                  <div style={{ padding: "1.25rem", border: "1px solid var(--oc-border)", borderRadius: "10px" }}>
                    <small style={{ color: "var(--oc-muted)", display: "block", marginBottom: "4px" }}>Confirmación de órdenes</small>
                    <strong>{confirmationLabels[state.fulfillment.confirmationMode]}</strong>
                  </div>
                  <div style={{ padding: "1.25rem", border: "1px solid var(--oc-border)", borderRadius: "10px" }}>
                    <small style={{ color: "var(--oc-muted)", display: "block", marginBottom: "4px" }}>Operadores asignados</small>
                    <strong>{state.operators.length} personas</strong>
                  </div>
                </div>

                {state.status === "ready" && (
                  <div style={{ padding: "1rem 1.25rem", background: "var(--oc-green-soft)", color: "var(--oc-green)", borderRadius: "10px", fontWeight: "600", fontSize: "14px" }}>
                    ✓ Esta configuración se encuentra lista y preparada para operar.
                  </div>
                )}
              </div>
            )}

            {/* FORM FOOTER */}
            <footer className="oc-form-footer">
              <span>{`Paso ${stepIndex + 1} de 6`}</span>
              <div>
                {stepIndex > 0 && (
                  <Button variant="outline" type="button" className="oc-secondary" onClick={handlePrev}>
                    Atrás
                  </Button>
                )}
                <Button type="button" className="oc-primary" onClick={handleNext}>
                  {stepIndex === STEPS.length - 1 ? "Guardar configuración de Pedidos" : "Siguiente"}
                </Button>
              </div>
            </footer>
          </div>
        </div>

        <aside className="config-guide-col">
          <OrdersGuide step={currentStep} state={state} />
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
