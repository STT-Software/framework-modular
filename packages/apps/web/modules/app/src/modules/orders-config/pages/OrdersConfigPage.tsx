import "../styles/orders-config.css";
import "@/css/business-configuration.css";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { NectoLogo } from "@/brand/NectoLogo";
import { BrandCardDecor } from "@/components/configuration/BrandBackdrop";
import { ConfigBusinessSwitcher } from "@/components/configuration/ConfigBusinessSwitcher";
import { RoleShieldBadge } from "@/components/configuration/RoleShieldBadge";
import { Checkbox } from "@/elements/form/checkbox";
import { Input } from "@/elements/form/input";
import { Button } from "@/elements/ui/button";
import { adminAccessStore } from "@/modules/business-access";
import { WorkspaceSupportDropdown, WorkspaceSupportWidget } from "@/modules/workspace";
import { ThemeIconButton } from "@/shell";
import { PageMeta } from "@/shell/meta";
import { ConfirmProfileSwitchModal } from "../components/ConfirmProfileSwitchModal";
import { ORDERS_PROFILE_ICONS } from "../components/icons";
import { OperatorAccessDialog } from "../components/OperatorAccessDialog";
import { OrdersGuide } from "../components/OrdersGuide";
import { PedidosOperatorAccess } from "../components/PedidosOperatorAccess";
import { PROFILE_DEFAULTS } from "../constants";
import { ordersConfigStore } from "../ordersConfig.store";
import { pedidosOperatorStore } from "../stores/pedidosOperator.store";
import {
  ALL_OPERATOR_STAGES,
  type CancellationStage,
  type ConfirmationExpiryAction,
  type ConfirmationMode,
  type ModalityType,
  type OnSiteMode,
  type OrderOperator,
  type OrderOperatorStage,
  type OrdersConfigStep,
  type OrdersProfileId,
  type OutOfHoursPolicy,
  type PaymentMethodId,
  type PickupScheduleMode,
  type ShippingPricingMode,
} from "../types";
import {
  isConfirmationExpiryApplicable,
  isConfirmationSlaApplicable,
  isDispatchSlaApplicable,
  isFlatShippingFeeApplicable,
  isFreeShippingThresholdApplicable,
  isFreightRiskThresholdApplicable,
  isOnSiteModeApplicable,
  isTransferReceiptApplicable,
  isWhatsappChannelApplicable,
  ORDERS_CONFIG_LIMITS,
  validateOrdersConfig,
  validateStep,
} from "../validation";

const modalityLabels: Record<ModalityType, string> = {
  delivery: "Envío a domicilio",
  pickup: "Retiro en local",
  on_site: "En el establecimiento",
};

const onSiteModeLabels: Record<OnSiteMode, string> = {
  table_or_zone: "Mesa o zona identificada",
  counter: "Barra o mostrador",
};

const confirmationLabels: Record<ConfirmationMode, string> = {
  manual: "Manual",
  automatic: "Automática",
  agent: "Por agente",
};

const pickupModeLabels: Record<PickupScheduleMode, string> = {
  eventual: "Retiro inmediato o eventual",
  fixed: "Retiro por franjas horarias",
};

const shippingPricingLabels: Record<ShippingPricingMode, string> = {
  fixed: "Tarifa fija de envío",
  free_from: "Gratis desde monto mínimo",
  to_confirm: "Costo por confirmar con el cliente",
};

const paymentMethodLabels: Record<PaymentMethodId, string> = {
  cash_on_delivery: "Pago contra entrega",
  bank_transfer: "Transferencia bancaria",
  payment_link: "Link de pago en línea",
  in_store: "Pago en el establecimiento",
};

const confirmationExpiryLabels: Record<ConfirmationExpiryAction, string> = {
  alert_only: "Solo alertar al equipo",
  auto_cancel: "Cancelar pedido automáticamente",
};

const cancellationLimitLabels: Record<CancellationStage, string> = {
  before_confirmation: "Solo antes de confirmar",
  before_preparation: "Antes de iniciar preparación",
  before_dispatch: "Antes del despacho",
  never: "No permitir cancelaciones",
};

const outOfHoursPolicyLabels: Record<OutOfHoursPolicy, string> = {
  reject: "Bloquear pedidos y responder automáticamente",
  schedule: "Aceptar como pedido programado para el siguiente horario",
};

const operatorStageLabels: Record<OrderOperatorStage, string> = {
  confirmation: "Confirmación",
  preparation: "Preparación",
  dispatch: "Despacho",
};

const STEPS: { id: OrdersConfigStep; nav: string; short: string; hint: string }[] = [
  { id: "profile", nav: "Perfil del negocio", short: "Perfil", hint: "Rubro y base de operación" },
  { id: "modalities", nav: "Modalidades de entrega", short: "Modalidades", hint: "Domicilio, retiro o en sitio" },
  { id: "fulfillment", nav: "Envíos y reglas", short: "Envíos", hint: "Confirmación y tarifas" },
  { id: "payments", nav: "Pagos y políticas", short: "Pagos", hint: "Métodos y cancelación" },
  { id: "sla", nav: "Tiempos objetivo", short: "Tiempos", hint: "Metas y fuera de horario" },
  { id: "operators", nav: "Operadores", short: "Equipo", hint: "Personal y etapas" },
  { id: "review", nav: "Revisión", short: "Revisión", hint: "Confirmar configuración" },
];

const COPY: Record<OrdersConfigStep, { title: string; description: string; document: string }> = {
  profile: {
    title: "Perfil de pedidos",
    description:
      "El rubro de tu negocio nos ayuda a sugerir las modalidades, transportadoras, reglas de pago y tiempos iniciales.",
    document: "Perfil de Pedidos",
  },
  modalities: {
    title: "Modalidades de entrega",
    description: "Elige las formas en que tus clientes van a recibir o consumir tus productos.",
    document: "Modalidades de Pedidos",
  },
  fulfillment: {
    title: "Confirmación y envíos",
    description:
      "Configura cómo confirmas los pedidos, los canales de entrega y las condiciones de envío a domicilio.",
    document: "Envíos y reglas",
  },
  payments: {
    title: "Pagos y políticas",
    description:
      "Define los métodos de pago aceptados, las validaciones previas a la preparación y los límites de cancelación.",
    document: "Pagos y políticas",
  },
  sla: {
    title: "Tiempos de atención",
    description:
      "Define los tiempos objetivo de atención y el comportamiento de tu operación fuera del horario laboral.",
    document: "Tiempos de Pedidos",
  },
  operators: {
    title: "Operadores de pedidos",
    description:
      "Asigna operadores a la gestión de pedidos e indica qué etapas operativas atenderá cada persona.",
    document: "Operadores de Pedidos",
  },
  review: {
    title: "Revisar configuración de pedidos",
    description:
      "Revisa tus modalidades, envíos, pagos, tiempos y equipo antes de guardar la configuración de Pedidos.",
    document: "Revisión de Pedidos",
  },
};

function parseNumericInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  return Number(raw);
}

function numericValue(value: number): string | number {
  return Number.isFinite(value) ? value : "";
}

function toggleStageInList(current: OrderOperatorStage[], stage: OrderOperatorStage, checked: boolean): OrderOperatorStage[] {
  const next = new Set(current);
  if (checked) next.add(stage);
  else next.delete(stage);
  return ALL_OPERATOR_STAGES.filter((item) => next.has(item));
}

function formatAmount(value: number, currency: string): string {
  return Number.isFinite(value) ? `${value.toLocaleString("es-CO")} ${currency}` : "—";
}

function renderOperatorStages(stages: OrderOperatorStage[]) {
  if (stages.length === ALL_OPERATOR_STAGES.length) {
    return (
      <div className="oc-stage-badges">
        <span className="oc-stage-badge">Todas las etapas</span>
      </div>
    );
  }
  return (
    <div className="oc-stage-badges">
      {stages.map((stage) => (
        <span key={stage} className="oc-stage-badge">
          {operatorStageLabels[stage]}
        </span>
      ))}
    </div>
  );
}

export const OrdersConfigPage = observer(() => {
  const { businessId, step: stepParam } = useParams();
  const navigate = useNavigate();
  const store = ordersConfigStore;

  const [pendingProfile, setPendingProfile] = useState<OrdersProfileId | null>(null);
  const [modalityFeedback, setModalityFeedback] = useState<string | null>(null);
  const [paymentMethodFeedback, setPaymentMethodFeedback] = useState<string | null>(null);

  const [newOpName, setNewOpName] = useState("");
  const [newOpEmail, setNewOpEmail] = useState("");
  const [newOpPhone, setNewOpPhone] = useState("");
  const [newOpStages, setNewOpStages] = useState<OrderOperatorStage[]>([...ALL_OPERATOR_STAGES]);
  const [newOpError, setNewOpError] = useState<{ field: string; message: string } | null>(null);

  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editOpName, setEditOpName] = useState("");
  const [editOpEmail, setEditOpEmail] = useState("");
  const [editOpPhone, setEditOpPhone] = useState("");
  const [editOpStages, setEditOpStages] = useState<OrderOperatorStage[]>([...ALL_OPERATOR_STAGES]);
  const [editOpError, setEditOpError] = useState<{ field: string; message: string } | null>(null);

  const [accessDialogOperator, setAccessDialogOperator] = useState<OrderOperator | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const isOperator = stepParam === "operator";
  const currentStep = (STEPS.some((s) => s.id === stepParam) ? stepParam : "profile") as OrdersConfigStep;
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
    if (isOperator) void pedidosOperatorStore.load(businessId);
    else void store.load(businessId);
    return () => {
      store.reset();
      pedidosOperatorStore.reset();
    };
  }, [businessId, isOperator, store]);

  const signedOut = isOperator ? pedidosOperatorStore.status === "signed-out" : store.status === "signed-out";
  useEffect(() => {
    if (signedOut) {
      navigate("/business/access", { replace: true });
    }
  }, [signedOut, navigate]);

  // Keep visitedSteps and active step synced when navigating via URL or browser history.
  useEffect(() => {
    if (!isOperator && store.status === "ready" && store.state) {
      void store.setStep(currentStep);
    }
  }, [isOperator, store, store.status, currentStep]);

  // Reset operator form drafts whenever switching to a different business.
  useEffect(() => {
    setNewOpName("");
    setNewOpEmail("");
    setNewOpPhone("");
    setNewOpStages([...ALL_OPERATOR_STAGES]);
    setNewOpError(null);
    setEditingOpId(null);
    setEditOpName("");
    setEditOpEmail("");
    setEditOpPhone("");
    setEditOpStages([...ALL_OPERATOR_STAGES]);
    setEditOpError(null);
    setAccessDialogOperator(null);
  }, [businessId]);

  // Clear transient step UI feedback when changing step or business.
  useEffect(() => {
    setModalityFeedback(null);
    setPaymentMethodFeedback(null);
    setPendingProfile(null);
    setNewOpError(null);
    setEditingOpId(null);
    setEditOpError(null);
    setAccessDialogOperator(null);
  }, [businessId, currentStep]);

  const goToStep = async (target: OrdersConfigStep) => {
    if (!businessId || store.saving) return;
    await store.setStep(target);
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
    navigate(`/business/setup/${businessId}`);
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

  const handleProfileSelect = async (profId: OrdersProfileId) => {
    if (!store.state || store.saving || store.state.profile === profId) return;
    if (store.state.touched) {
      setPendingProfile(profId);
      return;
    }
    await store.setProfile(profId);
  };

  const handleConfirmProfileSwitch = async () => {
    if (!pendingProfile || store.saving) return;
    const target = pendingProfile;
    setPendingProfile(null);
    await store.setProfile(target, { force: true });
  };

  const handleToggleModality = (modality: ModalityType) => {
    const result = store.toggleModality(modality);
    if (!result.ok) {
      setModalityFeedback(result.message);
      return;
    }
    setModalityFeedback(null);
  };

  const handleTogglePaymentMethod = (method: PaymentMethodId) => {
    const result = store.togglePaymentMethod(method);
    if (!result.ok) {
      setPaymentMethodFeedback(result.message);
      return;
    }
    setPaymentMethodFeedback(null);
  };

  const handleAddOperator = async () => {
    if (store.saving) return;
    const result = await store.addOperator({
      name: newOpName,
      email: newOpEmail,
      phone: newOpPhone,
      stages: newOpStages,
    });
    if (!result.ok) {
      setNewOpError({ field: result.field, message: result.message });
      return;
    }
    setNewOpName("");
    setNewOpEmail("");
    setNewOpPhone("");
    setNewOpStages([...ALL_OPERATOR_STAGES]);
    setNewOpError(null);
  };

  const startEditOperator = (operator: OrderOperator) => {
    setEditingOpId(operator.id);
    setEditOpName(operator.name);
    setEditOpEmail(operator.email);
    setEditOpPhone(operator.phone ?? "");
    setEditOpStages([...operator.stages]);
    setEditOpError(null);
  };

  const cancelEditOperator = () => {
    setEditingOpId(null);
    setEditOpName("");
    setEditOpEmail("");
    setEditOpPhone("");
    setEditOpStages([...ALL_OPERATOR_STAGES]);
    setEditOpError(null);
  };

  const saveEditOperator = async (operatorId: string) => {
    if (store.saving) return;
    const result = await store.updateOperator(operatorId, {
      name: editOpName,
      email: editOpEmail,
      phone: editOpPhone,
      stages: editOpStages,
    });
    if (!result.ok) {
      setEditOpError({ field: result.field, message: result.message });
      return;
    }
    cancelEditOperator();
  };

  if (isOperator) {
    return (
      <section className="oc-root" aria-label="Acceso de operador de Pedidos">
        <PageMeta title="Necto · Acceso de operador" />
        <header className="oc-header">
          <Link to="/business/access" className="oc-logo" aria-label="Necto, mi acceso de operador">
            <NectoLogo width={161} height={23} />
          </Link>
          <div className="oc-header-context">
            <RoleShieldBadge role="Operador" />
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
        <PedidosOperatorAccess onSignOut={() => void signOut()} signingOut={signingOut} />
        <footer className="oc-footer">
          <span>© 2026 Necto</span>
        </footer>
        <WorkspaceSupportWidget />
      </section>
    );
  }

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
  const fulfillmentIssues = validateStep(state, "fulfillment");
  const paymentsIssues = validateStep(state, "payments");
  const slaIssues = validateStep(state, "sla");
  const operatorsIssues = validateStep(state, "operators");

  const whatsappIssue = fulfillmentIssues.find((i) => i.field === "whatsappNumber");
  const deliveryChannelIssue = fulfillmentIssues.find((i) => i.field === "deliveryChannel");
  const riskIssue = fulfillmentIssues.find((i) => i.field === "maxShippingCostRisk");
  const flatFeeIssue = fulfillmentIssues.find((i) => i.field === "flatShippingFee");
  const freeThresholdIssue = fulfillmentIssues.find((i) => i.field === "freeShippingThreshold");
  const minOrderIssue = fulfillmentIssues.find((i) => i.field === "minimumOrderAmount");

  const prepaymentIssue = paymentsIssues.find((i) => i.field === "requirePrepaymentBeforePrep");

  const prepIssue = slaIssues.find((i) => i.field === "preparationMinutes");
  const urgencyIssue = slaIssues.find((i) => i.field === "urgencyThresholdMinutes");
  const confirmIssue = slaIssues.find((i) => i.field === "confirmationMinutes");
  const dispatchIssue = slaIssues.find((i) => i.field === "dispatchMinutes");
  const outOfHoursIssue = slaIssues.find((i) => i.field === "outOfHoursMessage");

  const hasDelivery = state.modalities.includes("delivery");
  const hasPickup = state.modalities.includes("pickup");
  const showOnSiteMode = isOnSiteModeApplicable(state);
  const showWhatsappChannel = isWhatsappChannelApplicable(state);
  const showFreightRisk = isFreightRiskThresholdApplicable(state);
  const showFlatShippingFee = isFlatShippingFeeApplicable(state);
  const showFreeShippingThreshold = isFreeShippingThresholdApplicable(state);
  const showTransferReceipt = isTransferReceiptApplicable(state);
  const showConfirmationExpiry = isConfirmationExpiryApplicable(state);
  const showConfirmationSla = isConfirmationSlaApplicable(state);
  const showDispatchSla = isDispatchSlaApplicable(state);
  const showAutoWithoutPrepaymentNote =
    state.fulfillment.confirmationMode === "automatic" && !state.payments.requirePrepaymentBeforePrep;

  const enabledCarriers = state.fulfillment.carriers.filter((c) => c.enabled);
  const stepTitleById = Object.fromEntries(STEPS.map((s) => [s.id, s.short])) as Record<OrdersConfigStep, string>;

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
              const isVisited = visited.has(s.id);
              const isCurrent = currentStep === s.id;
              const isReview = s.id === "review";
              const stepIssues = isReview ? allIssues : validateStep(state, s.id);
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
              <div className="oc-card">
                <BrandCardDecor />

                {/* STEP 1: PROFILE */}
                {currentStep === "profile" && (
                  <div>
                    <h3 className="oc-section-title">Selecciona el perfil principal</h3>
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
                            disabled={store.saving}
                            onClick={() => void handleProfileSelect(profId)}
                          >
                            <span className="oc-profile-icon">
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                dangerouslySetInnerHTML={{ __html: ORDERS_PROFILE_ICONS[profId] }}
                              />
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

                {/* STEP 2: MODALITIES */}
                {currentStep === "modalities" && (
                  <div>
                    <h3 className="oc-section-title">Formas de entrega y atención</h3>
                    <div className="oc-grid-3">
                      {(
                        [
                          {
                            id: "delivery",
                            title: "Envío a domicilio",
                            desc: "Entrega con mensajería propia urbana o transportadora nacional con guía.",
                          },
                          {
                            id: "pickup",
                            title: "Retiro en local",
                            desc: "El cliente pasa a recoger personalmente su pedido listo.",
                          },
                          {
                            id: "on_site",
                            title: "En sitio / Mesa",
                            desc: "Atención y consumo directo en tu establecimiento comercial.",
                          },
                        ] as const
                      ).map((m) => {
                        const isSelected = state.modalities.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={isSelected}
                            className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                            onClick={() => handleToggleModality(m.id)}
                          >
                            <strong>{m.title}</strong>
                            <p>{m.desc}</p>
                            <div className="oc-modality-status">
                              {isSelected ? "✓ Habilitado" : "+ Habilitar"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {modalityFeedback && (
                      <div className="oc-alert-warning" role="alert">
                        <span>{modalityFeedback}</span>
                      </div>
                    )}

                    {showOnSiteMode && (
                      <div className="oc-section-block">
                        <h3 className="oc-section-title">Atención en el establecimiento</h3>
                        <div className="oc-grid-2">
                          {(
                            [
                              {
                                id: "table_or_zone",
                                title: "Mesa o zona identificada",
                                desc: "Cada pedido se identifica con una mesa, habitación o zona de servicio.",
                              },
                              {
                                id: "counter",
                                title: "Barra o mostrador",
                                desc: "Los clientes solicitan y retiran directamente en barra o mostrador.",
                              },
                            ] as const
                          ).map((option) => {
                            const isSelected = state.onSiteMode === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                aria-pressed={isSelected}
                                className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                                onClick={() => store.setOnSiteMode(option.id)}
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
                  </div>
                )}

                {/* STEP 3: FULFILLMENT */}
                {currentStep === "fulfillment" && (
                  <div>
                    <h3 className="oc-section-title">Confirmación de órdenes</h3>
                    <div className="oc-grid-3">
                      {(
                        [
                          {
                            id: "manual",
                            title: "Revisión manual",
                            desc: "Un operador revisa y aprueba cada pedido antes de pasar a la preparación.",
                          },
                          {
                            id: "automatic",
                            title: "Automática directa",
                            desc: "Los pedidos entran confirmados directo a la cocina o bodega.",
                          },
                          {
                            id: "agent",
                            title: "Por agente de WhatsApp",
                            desc: "Un asistente interactivo verifica detalles y confirma con el cliente.",
                          },
                        ] as const
                      ).map((f) => {
                        const isSelected = state.fulfillment.confirmationMode === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            aria-pressed={isSelected}
                            className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                            onClick={() => store.setConfirmationMode(f.id)}
                          >
                            <strong>{f.title}</strong>
                            <p>{f.desc}</p>
                            <i>✓</i>
                          </button>
                        );
                      })}
                    </div>

                    {showWhatsappChannel && (
                      <div className="oc-inline-panel">
                        <div className={`oc-field ${whatsappIssue ? "has-error" : ""}`}>
                          <label htmlFor="oc-whatsappNumber">Número de WhatsApp del agente:</label>
                          <Input
                            id="oc-whatsappNumber"
                            type="tel"
                            placeholder="+57 300 123 4567"
                            value={state.fulfillment.whatsappNumber}
                            error={Boolean(whatsappIssue)}
                            hint={
                              whatsappIssue?.message ??
                              "Línea de WhatsApp desde la que el agente confirmará pedidos con tus clientes."
                            }
                            onChange={(e) => store.setWhatsappNumber(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {showFreightRisk && (
                      <div className="oc-section-block">
                        <div className="oc-toggle-box">
                          <Checkbox
                            id="oc-riskThresholdActive"
                            checked={state.fulfillment.riskThresholdActive}
                            onChange={(checked) => store.setRiskThreshold(checked)}
                            label="Exigir confirmación manual en órdenes con alto costo de flete"
                          />
                          <span className="oc-toggle-hint">
                            Cuando el costo del envío supere el tope configurado, el pedido requerirá revisión manual.
                          </span>
                          {state.fulfillment.riskThresholdActive && (
                            <div className="oc-toggle-nested">
                              <div className={`oc-field ${riskIssue ? "has-error" : ""}`}>
                                <label htmlFor="oc-maxShippingCostRisk">
                                  {`Tope máximo de envío (${currency}):`}
                                </label>
                                <Input
                                  id="oc-maxShippingCostRisk"
                                  type="number"
                                  min={String(ORDERS_CONFIG_LIMITS.maxShippingCostRisk.min)}
                                  max={String(ORDERS_CONFIG_LIMITS.maxShippingCostRisk.max)}
                                  step={1}
                                  value={numericValue(state.fulfillment.maxShippingCostRisk)}
                                  error={Boolean(riskIssue)}
                                  hint={riskIssue?.message}
                                  onChange={(e) =>
                                    store.setRiskThreshold(true, parseNumericInput(e.target.value))
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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
                  </div>
                )}

                {/* STEP 4: PAYMENTS & POLICIES */}
                {currentStep === "payments" && (
                  <div>
                    <h3 className="oc-section-title">Métodos de pago aceptados</h3>
                    <div className="oc-grid-2">
                      {(
                        [
                          {
                            id: "cash_on_delivery",
                            title: "Pago contra entrega",
                            desc: "El cliente paga en efectivo o datáfono al recibir su pedido.",
                          },
                          {
                            id: "bank_transfer",
                            title: "Transferencia bancaria",
                            desc: "Transferencia directa a cuenta bancaria o billetera digital.",
                          },
                          {
                            id: "payment_link",
                            title: "Link de pago en línea",
                            desc: "Cobro anticipado mediante enlace de pago con tarjeta o pasarela.",
                          },
                          {
                            id: "in_store",
                            title: "Pago en el establecimiento",
                            desc: "El cliente paga al retirar en tienda o al consumir en el local.",
                          },
                        ] as const
                      ).map((method) => {
                        const isSelected = state.payments.methods.includes(method.id);
                        return (
                          <button
                            key={method.id}
                            type="button"
                            aria-pressed={isSelected}
                            className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                            onClick={() => handleTogglePaymentMethod(method.id)}
                          >
                            <strong>{method.title}</strong>
                            <p>{method.desc}</p>
                            <div className="oc-modality-status">
                              {isSelected ? "✓ Habilitado" : "+ Habilitar"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {paymentMethodFeedback && (
                      <div className="oc-alert-warning" role="alert">
                        <span>{paymentMethodFeedback}</span>
                      </div>
                    )}

                    <div className="oc-section-block">
                      <h3 className="oc-section-title">Validación de pagos</h3>
                      {showTransferReceipt && (
                        <div className="oc-toggle-box">
                          <Checkbox
                            id="oc-requireTransferReceipt"
                            checked={state.payments.requireTransferReceipt}
                            onChange={(checked) => store.setRequireTransferReceipt(checked)}
                            label="Exigir comprobante de transferencia antes de aprobar"
                          />
                          <span className="oc-toggle-hint">
                            Se solicitará soporte o comprobante antes de confirmar pedidos pagados por transferencia.
                          </span>
                        </div>
                      )}

                      <div className="oc-toggle-box">
                        <Checkbox
                          id="oc-requirePrepaymentBeforePrep"
                          checked={state.payments.requirePrepaymentBeforePrep}
                          onChange={(checked) => store.setRequirePrepaymentBeforePrep(checked)}
                          label="Exigir pago confirmado antes de pasar a preparación"
                        />
                        <span className="oc-toggle-hint">
                          Requiere al menos un método de pago anticipado activo (Transferencia bancaria o Link de pago).
                        </span>
                        {prepaymentIssue && (
                          <div className="oc-alert-error" role="alert">
                            <span>{prepaymentIssue.message}</span>
                          </div>
                        )}
                      </div>

                      {showAutoWithoutPrepaymentNote && (
                        <div className="oc-info-banner" role="note">
                          <strong>Nota operativa:</strong> tienes confirmación automática activa y sin pago previo
                          obligatorio. Los pedidos pasarán directamente a preparación sin validar el pago antes.
                        </div>
                      )}
                    </div>

                    {showConfirmationExpiry && (
                      <div className="oc-section-block">
                        <h3 className="oc-section-title">Si vence el tiempo de confirmación</h3>
                        <div className="oc-grid-2">
                          {(
                            [
                              {
                                id: "alert_only",
                                title: "Solo alertar al equipo",
                                desc: "El pedido queda resaltado como vencido hasta que un operador lo atienda.",
                              },
                              {
                                id: "auto_cancel",
                                title: "Cancelar pedido automáticamente",
                                desc: "El pedido se cancela automáticamente y se informa al cliente al vencer el plazo.",
                              },
                            ] as const
                          ).map((option) => {
                            const isSelected = state.payments.confirmationExpiryAction === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                aria-pressed={isSelected}
                                className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                                onClick={() => store.setConfirmationExpiryAction(option.id)}
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

                    <div className="oc-section-block">
                      <h3 className="oc-section-title">¿Hasta qué etapa se permite cancelar un pedido?</h3>
                      <div className="oc-grid-2">
                        {(
                          [
                            {
                              id: "before_confirmation",
                              title: "Solo antes de confirmar",
                              desc: "El cliente puede cancelar únicamente mientras el pedido está pendiente de aprobación.",
                            },
                            {
                              id: "before_preparation",
                              title: "Antes de iniciar preparación",
                              desc: "Se permiten cancelaciones siempre que no haya comenzado la preparación.",
                            },
                            {
                              id: "before_dispatch",
                              title: "Antes del despacho",
                              desc: "Se permite cancelar hasta antes de entregar el pedido a mensajería o transportadora.",
                            },
                            {
                              id: "never",
                              title: "No permitir cancelaciones",
                              desc: "Las solicitudes de cancelación deben gestionarse directamente con soporte.",
                            },
                          ] as const
                        ).map((option) => {
                          const isSelected = state.payments.cancellationLimit === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={isSelected}
                              className={`oc-select-card ${isSelected ? "is-selected" : ""}`}
                              onClick={() => store.setCancellationLimit(option.id)}
                            >
                              <strong>{option.title}</strong>
                              <p>{option.desc}</p>
                              <i>✓</i>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 5: SLA */}
                {currentStep === "sla" && (
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
                )}

                {/* STEP 6: OPERATORS */}
                {currentStep === "operators" && (
                  <div>
                    <h3 className="oc-section-title">Agregar operador al equipo</h3>
                    <div className="oc-operator-form">
                      <div
                        className={`oc-field ${newOpError?.field === "name" ? "has-error" : ""}`}
                        style={{ marginBottom: 0 }}
                      >
                        <label htmlFor="oc-newOpName">Nombre completo</label>
                        <Input
                          id="oc-newOpName"
                          type="text"
                          placeholder="Ej. Camila Rojas"
                          value={newOpName}
                          error={newOpError?.field === "name"}
                          hint={newOpError?.field === "name" ? newOpError.message : undefined}
                          onChange={(e) => {
                            setNewOpName(e.target.value);
                            if (newOpError?.field === "name") setNewOpError(null);
                          }}
                        />
                      </div>

                      <div
                        className={`oc-field ${newOpError?.field === "email" ? "has-error" : ""}`}
                        style={{ marginBottom: 0 }}
                      >
                        <label htmlFor="oc-newOpEmail">Correo de acceso</label>
                        <Input
                          id="oc-newOpEmail"
                          type="email"
                          placeholder="operador@negocio.com"
                          value={newOpEmail}
                          error={newOpError?.field === "email"}
                          hint={newOpError?.field === "email" ? newOpError.message : undefined}
                          onChange={(e) => {
                            setNewOpEmail(e.target.value);
                            if (newOpError?.field === "email") setNewOpError(null);
                          }}
                        />
                      </div>

                      <div
                        className={`oc-field ${newOpError?.field === "phone" ? "has-error" : ""}`}
                        style={{ marginBottom: 0 }}
                      >
                        <label htmlFor="oc-newOpPhone">Teléfono (opcional)</label>
                        <Input
                          id="oc-newOpPhone"
                          type="tel"
                          placeholder="+57 300 123 4567"
                          value={newOpPhone}
                          error={newOpError?.field === "phone"}
                          hint={newOpError?.field === "phone" ? newOpError.message : undefined}
                          onChange={(e) => {
                            setNewOpPhone(e.target.value);
                            if (newOpError?.field === "phone") setNewOpError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className={`oc-stage-picker ${newOpError?.field === "stages" ? "has-error" : ""}`}>
                      <span className="oc-stage-picker-label">Etapas operativas asignadas</span>
                      <div className="oc-stage-checkboxes">
                        {ALL_OPERATOR_STAGES.map((stage) => (
                          <Checkbox
                            key={stage}
                            id={`oc-newOpStage-${stage}`}
                            checked={newOpStages.includes(stage)}
                            label={operatorStageLabels[stage]}
                            onChange={(checked) => {
                              setNewOpStages((prev) => toggleStageInList(prev, stage, checked));
                              if (newOpError?.field === "stages") setNewOpError(null);
                            }}
                          />
                        ))}
                      </div>
                      {newOpError?.field === "stages" && (
                        <span className="oc-field-error" role="alert">
                          {newOpError.message}
                        </span>
                      )}
                    </div>

                    {newOpError?.field === "operator" && (
                      <div className="oc-alert-error" role="alert" style={{ marginBottom: "12px" }}>
                        <span>{newOpError.message}</span>
                      </div>
                    )}

                    <div className="oc-operator-form-actions">
                      <Button
                        type="button"
                        className="oc-primary"
                        disabled={store.saving || !newOpName.trim() || !newOpEmail.trim()}
                        onClick={() => void handleAddOperator()}
                      >
                        {store.saving ? "Guardando…" : "+ Agregar operador"}
                      </Button>
                    </div>

                    {operatorsIssues.length > 0 && (
                      <div className="oc-alert-error" role="alert" style={{ marginBottom: "16px" }}>
                        <strong>Revisa los operadores registrados:</strong>
                        <ul className="oc-blocking-list">
                          {operatorsIssues.map((issue) => (
                            <li key={issue.field}>
                              <span>{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <h3 className="oc-section-title">{`Equipo asignado (${state.operators.length})`}</h3>
                    {state.operators.length === 0 ? (
                      <div className="oc-empty-box">
                        No hay operadores adicionales. Como administrador puedes operar directamente todas las
                        órdenes.
                      </div>
                    ) : (
                      <div className="oc-record-list">
                        {state.operators.map((op) => {
                          const isEditing = editingOpId === op.id;
                          return (
                            <div key={op.id} className="oc-record-row">
                              {isEditing ? (
                                <div className="oc-operator-edit-box">
                                  <div className="oc-operator-edit-grid">
                                    <div
                                      className={`oc-field ${editOpError?.field === "name" ? "has-error" : ""}`}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <label htmlFor={`oc-editOpName-${op.id}`}>Nombre completo</label>
                                      <Input
                                        id={`oc-editOpName-${op.id}`}
                                        type="text"
                                        value={editOpName}
                                        error={editOpError?.field === "name"}
                                        hint={editOpError?.field === "name" ? editOpError.message : undefined}
                                        onChange={(e) => {
                                          setEditOpName(e.target.value);
                                          if (editOpError?.field === "name") setEditOpError(null);
                                        }}
                                      />
                                    </div>
                                    <div
                                      className={`oc-field ${editOpError?.field === "email" ? "has-error" : ""}`}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <label htmlFor={`oc-editOpEmail-${op.id}`}>Correo de acceso</label>
                                      <Input
                                        id={`oc-editOpEmail-${op.id}`}
                                        type="email"
                                        value={editOpEmail}
                                        error={editOpError?.field === "email"}
                                        hint={editOpError?.field === "email" ? editOpError.message : undefined}
                                        onChange={(e) => {
                                          setEditOpEmail(e.target.value);
                                          if (editOpError?.field === "email") setEditOpError(null);
                                        }}
                                      />
                                    </div>
                                    <div
                                      className={`oc-field ${editOpError?.field === "phone" ? "has-error" : ""}`}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <label htmlFor={`oc-editOpPhone-${op.id}`}>Teléfono (opcional)</label>
                                      <Input
                                        id={`oc-editOpPhone-${op.id}`}
                                        type="tel"
                                        placeholder="+57 300 123 4567"
                                        value={editOpPhone}
                                        error={editOpError?.field === "phone"}
                                        hint={editOpError?.field === "phone" ? editOpError.message : undefined}
                                        onChange={(e) => {
                                          setEditOpPhone(e.target.value);
                                          if (editOpError?.field === "phone") setEditOpError(null);
                                        }}
                                      />
                                    </div>
                                  </div>

                                  <div
                                    className={`oc-stage-picker ${editOpError?.field === "stages" ? "has-error" : ""}`}
                                    style={{ marginBottom: 0 }}
                                  >
                                    <span className="oc-stage-picker-label">Etapas operativas asignadas</span>
                                    <div className="oc-stage-checkboxes">
                                      {ALL_OPERATOR_STAGES.map((stage) => (
                                        <Checkbox
                                          key={stage}
                                          id={`oc-editOpStage-${op.id}-${stage}`}
                                          checked={editOpStages.includes(stage)}
                                          label={operatorStageLabels[stage]}
                                          onChange={(checked) => {
                                            setEditOpStages((prev) => toggleStageInList(prev, stage, checked));
                                            if (editOpError?.field === "stages") setEditOpError(null);
                                          }}
                                        />
                                      ))}
                                    </div>
                                    {editOpError?.field === "stages" && (
                                      <span className="oc-field-error" role="alert">
                                        {editOpError.message}
                                      </span>
                                    )}
                                  </div>

                                  {editOpError?.field === "operator" && (
                                    <span className="oc-field-error" role="alert">
                                      {editOpError.message}
                                    </span>
                                  )}
                                  <div className="oc-operator-edit-actions">
                                    <Button
                                      variant="outline"
                                      type="button"
                                      className="oc-secondary"
                                      disabled={store.saving}
                                      onClick={cancelEditOperator}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="button"
                                      className="oc-primary"
                                      disabled={store.saving}
                                      onClick={() => void saveEditOperator(op.id)}
                                    >
                                      {store.saving ? "Guardando…" : "Guardar cambios"}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="oc-record-meta">
                                    <strong>{op.name}</strong>
                                    <span className="oc-record-sub">{op.email}</span>
                                    {op.phone && <span className="oc-record-sub">{op.phone}</span>}
                                    {renderOperatorStages(op.stages)}
                                  </div>
                                  <div className="oc-record-actions">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      type="button"
                                      disabled={store.saving}
                                      onClick={() => setAccessDialogOperator(op)}
                                    >
                                      Ver acceso
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      type="button"
                                      disabled={store.saving}
                                      onClick={() => startEditOperator(op)}
                                    >
                                      Editar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      type="button"
                                      className="oc-delete-btn"
                                      disabled={store.saving}
                                      onClick={() => void store.removeOperator(op.id)}
                                    >
                                      Eliminar
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 7: REVIEW */}
                {currentStep === "review" && (
                  <div>
                    <h3 className="oc-section-title">Resumen de la configuración</h3>

                    {allIssues.length > 0 && (
                      <div className="oc-alert-error" role="alert" style={{ marginTop: 0, marginBottom: "20px" }}>
                        <strong>Corrige estos ajustes antes de guardar la configuración:</strong>
                        <ul className="oc-blocking-list">
                          {allIssues.map((issue) => (
                            <li key={`${issue.step}:${issue.field}`} className="oc-blocking-item">
                              <span>{issue.message}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => void goToStep(issue.step)}
                              >
                                {`Ir a ${stepTitleById[issue.step]}`}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="oc-review-grid">
                      {/* 1. Profile summary */}
                      <section className="oc-review-card">
                        <div className="oc-review-card-head">
                          <h4>Rubro / Perfil</h4>
                          <button
                            type="button"
                            className="oc-text-button"
                            onClick={() => void goToStep("profile")}
                          >
                            Editar
                          </button>
                        </div>
                        <dl className="oc-summary-list">
                          <div>
                            <dt>Perfil activo</dt>
                            <dd>{PROFILE_DEFAULTS[state.profile].name}</dd>
                          </div>
                        </dl>
                      </section>

                      {/* 2. Modalities summary */}
                      <section className="oc-review-card">
                        <div className="oc-review-card-head">
                          <h4>Modalidades de entrega</h4>
                          <button
                            type="button"
                            className="oc-text-button"
                            onClick={() => void goToStep("modalities")}
                          >
                            Editar
                          </button>
                        </div>
                        <div className="oc-chip-list">
                          {state.modalities.map((mode) => (
                            <span key={mode} className="oc-chip">
                              {modalityLabels[mode]}
                            </span>
                          ))}
                        </div>
                        {showOnSiteMode && (
                          <dl className="oc-summary-list" style={{ marginTop: "12px" }}>
                            <div>
                              <dt>Atención en sitio</dt>
                              <dd>{onSiteModeLabels[state.onSiteMode]}</dd>
                            </div>
                          </dl>
                        )}
                      </section>

                      {/* 3. Confirmation & fulfillment summary */}
                      <section className="oc-review-card">
                        <div className="oc-review-card-head">
                          <h4>Confirmación y envíos</h4>
                          <button
                            type="button"
                            className="oc-text-button"
                            onClick={() => void goToStep("fulfillment")}
                          >
                            Editar
                          </button>
                        </div>
                        <dl className="oc-summary-list">
                          <div>
                            <dt>Confirmación de órdenes</dt>
                            <dd>{confirmationLabels[state.fulfillment.confirmationMode]}</dd>
                          </div>
                          {showWhatsappChannel && (
                            <div>
                              <dt>WhatsApp del agente</dt>
                              <dd>{state.fulfillment.whatsappNumber.trim() || "Sin definir"}</dd>
                            </div>
                          )}
                          {showFreightRisk && (
                            <div>
                              <dt>Tope de riesgo en flete</dt>
                              <dd>
                                {state.fulfillment.riskThresholdActive
                                  ? formatAmount(state.fulfillment.maxShippingCostRisk, currency)
                                  : "Sin tope adicional"}
                              </dd>
                            </div>
                          )}
                          {hasDelivery && (
                            <>
                              <div>
                                <dt>Mensajería propia</dt>
                                <dd>{state.fulfillment.hasOwnCourier ? "Habilitada" : "Desactivada"}</dd>
                              </div>
                              <div>
                                <dt>Transportadoras activas</dt>
                                <dd>
                                  {enabledCarriers.length > 0
                                    ? enabledCarriers
                                        .map((c) => (c.isDefault ? `${c.name} (predeterminada)` : c.name))
                                        .join(", ")
                                    : "Ninguna activa"}
                                </dd>
                              </div>
                              <div>
                                <dt>Política de tarifa de envío</dt>
                                <dd>{shippingPricingLabels[state.fulfillment.shippingPricingMode]}</dd>
                              </div>
                              {showFlatShippingFee && (
                                <div>
                                  <dt>
                                    {state.fulfillment.shippingPricingMode === "free_from"
                                      ? "Tarifa base de envío"
                                      : "Tarifa fija de envío"}
                                  </dt>
                                  <dd>{formatAmount(state.fulfillment.flatShippingFee, currency)}</dd>
                                </div>
                              )}
                              {showFreeShippingThreshold && (
                                <div>
                                  <dt>Envío gratis desde</dt>
                                  <dd>{formatAmount(state.fulfillment.freeShippingThreshold, currency)}</dd>
                                </div>
                              )}
                              <div>
                                <dt>Pedido mínimo para domicilio</dt>
                                <dd>
                                  {state.fulfillment.minimumOrderActive
                                    ? formatAmount(state.fulfillment.minimumOrderAmount, currency)
                                    : "Sin monto mínimo"}
                                </dd>
                              </div>
                            </>
                          )}
                          {hasPickup && (
                            <div>
                              <dt>Retiro en local</dt>
                              <dd>{pickupModeLabels[state.fulfillment.pickupMode]}</dd>
                            </div>
                          )}
                        </dl>
                      </section>

                      {/* 4. Payments & policies summary */}
                      <section className="oc-review-card">
                        <div className="oc-review-card-head">
                          <h4>Pagos y políticas</h4>
                          <button
                            type="button"
                            className="oc-text-button"
                            onClick={() => void goToStep("payments")}
                          >
                            Editar
                          </button>
                        </div>
                        <div className="oc-chip-list" style={{ marginBottom: "12px" }}>
                          {state.payments.methods.map((method) => (
                            <span key={method} className="oc-chip">
                              {paymentMethodLabels[method]}
                            </span>
                          ))}
                        </div>
                        <dl className="oc-summary-list">
                          {showTransferReceipt && (
                            <div>
                              <dt>Comprobante de transferencia</dt>
                              <dd>{state.payments.requireTransferReceipt ? "Obligatorio" : "Opcional"}</dd>
                            </div>
                          )}
                          <div>
                            <dt>Pago previo antes de preparar</dt>
                            <dd>{state.payments.requirePrepaymentBeforePrep ? "Obligatorio" : "No requerido"}</dd>
                          </div>
                          {showConfirmationExpiry && (
                            <div>
                              <dt>Al vencer tiempo de confirmación</dt>
                              <dd>{confirmationExpiryLabels[state.payments.confirmationExpiryAction]}</dd>
                            </div>
                          )}
                          <div>
                            <dt>Límite de cancelación</dt>
                            <dd>{cancellationLimitLabels[state.payments.cancellationLimit]}</dd>
                          </div>
                        </dl>
                      </section>

                      {/* 5. Applicable SLAs & out-of-hours summary */}
                      <section className="oc-review-card">
                        <div className="oc-review-card-head">
                          <h4>Tiempos objetivo (SLA)</h4>
                          <button type="button" className="oc-text-button" onClick={() => void goToStep("sla")}>
                            Editar
                          </button>
                        </div>
                        <dl className="oc-summary-list">
                          {showConfirmationSla && (
                            <div>
                              <dt>Confirmación máxima</dt>
                              <dd>
                                {Number.isFinite(state.sla.confirmationMinutes)
                                  ? `${state.sla.confirmationMinutes} min`
                                  : "—"}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt>Preparación objetivo</dt>
                            <dd>
                              {Number.isFinite(state.sla.preparationMinutes)
                                ? `${state.sla.preparationMinutes} min`
                                : "—"}
                            </dd>
                          </div>
                          {showDispatchSla && (
                            <div>
                              <dt>Despacho estimado</dt>
                              <dd>
                                {Number.isFinite(state.sla.dispatchMinutes)
                                  ? `${state.sla.dispatchMinutes} min`
                                  : "—"}
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt>Umbral de urgencia</dt>
                            <dd>
                              {Number.isFinite(state.sla.urgencyThresholdMinutes)
                                ? `${state.sla.urgencyThresholdMinutes} min`
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Política fuera de horario</dt>
                            <dd>{outOfHoursPolicyLabels[state.sla.outOfHoursPolicy]}</dd>
                          </div>
                          <div>
                            <dt>Respuesta fuera de horario</dt>
                            <dd>{state.sla.outOfHoursAutoReply ? "Activa" : "Desactivada"}</dd>
                          </div>
                        </dl>
                        {state.sla.outOfHoursAutoReply && state.sla.outOfHoursMessage.trim() && (
                          <div className="oc-quote-preview">{`«${state.sla.outOfHoursMessage.trim()}»`}</div>
                        )}
                      </section>

                      {/* 6. Operators summary */}
                      <section className="oc-review-card">
                        <div className="oc-review-card-head">
                          <h4>{`Operadores asignados (${state.operators.length})`}</h4>
                          <button
                            type="button"
                            className="oc-text-button"
                            onClick={() => void goToStep("operators")}
                          >
                            Editar
                          </button>
                        </div>
                        {state.operators.length === 0 ? (
                          <p style={{ color: "var(--oc-muted)" }}>
                            Sin operadores adicionales. Operarás como administrador del negocio.
                          </p>
                        ) : (
                          <div className="oc-review-operator-list">
                            {state.operators.map((op) => (
                              <div key={op.id} className="oc-review-operator-item">
                                <div>
                                  <strong>{op.name}</strong>
                                  <span className="oc-record-sub">{op.email}</span>
                                  {renderOperatorStages(op.stages)}
                                </div>
                                {op.phone && <span className="oc-record-sub">{op.phone}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    {state.status === "ready" && allIssues.length === 0 && (
                      <div className="oc-alert-success">
                        ✓ Esta configuración se encuentra lista y preparada para operar.
                      </div>
                    )}
                  </div>
                )}

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
              <OrdersGuide step={currentStep} state={state} currency={currency} />
            </aside>
          </div>
        </div>
      </main>

      {/* PROFILE SWITCH CONFIRMATION DIALOG */}
      <ConfirmProfileSwitchModal
        targetProfile={pendingProfile}
        onCancel={() => setPendingProfile(null)}
        onConfirm={() => void handleConfirmProfileSwitch()}
      />

      {/* OPERATOR ACCESS DIALOG */}
      <OperatorAccessDialog
        operator={accessDialogOperator}
        onClose={() => setAccessDialogOperator(null)}
      />

      {/* FOOTER */}
      <footer className="oc-footer">
        <span>© 2026 Necto</span>
      </footer>
      <WorkspaceSupportWidget />
    </section>
  );
});

export default OrdersConfigPage;
