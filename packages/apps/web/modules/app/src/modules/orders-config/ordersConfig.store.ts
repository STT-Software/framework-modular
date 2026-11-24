import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access";
import {
  pedidosApi,
  PedidosError,
  type FulfillmentBody,
  type ModalitiesBody,
  type OperatorBody,
  type PaymentsBody,
  type PedidosApi,
  type SlaBody,
} from "./api/pedidosApi";
import type {
  CancellationStage,
  CarrierId,
  CompleteSetupResult,
  ConfirmationExpiryAction,
  ConfirmationMode,
  ModalityType,
  OnSiteMode,
  OperatorInput,
  OperatorMutationResult,
  OrderOperator,
  OrdersBusiness,
  OrdersConfigState,
  OrdersConfigStep,
  OrdersDirtySection,
  OrdersProfileId,
  OrdersValidationIssue,
  PaymentMethodId,
  PedidosApiResponse,
  PedidosScheduleSummary,
  PickupScheduleMode,
  ShippingPricingMode,
  SlaSettings,
  ToggleModalityResult,
  TogglePaymentMethodResult,
} from "./types";
import {
  isConfirmationSlaApplicable,
  isDeliveryPricingApplicable,
  isDispatchSlaApplicable,
  isFlatShippingFeeApplicable,
  isFreeShippingThresholdApplicable,
  isFreightRiskThresholdApplicable,
  isWhatsappChannelApplicable,
  ORDERS_CONFIG_LIMITS,
  validateOperatorInput,
  validateOrdersConfig,
  validateStep,
} from "./validation";

export type OrdersConfigStatus = "idle" | "loading" | "ready" | "blocked" | "unavailable" | "signed-out" | "error";

export interface OrdersConfigAccessAdapter {
  ensureSession(): Promise<boolean>;
  withToken<T>(call: (token: string) => Promise<T>): Promise<T>;
}

export interface OrdersConfigStoreDeps {
  api?: PedidosApi;
  access?: OrdersConfigAccessAdapter;
}

const DIRTY_SECTION_FLUSH_ORDER: readonly OrdersDirtySection[] = ["modalities", "fulfillment", "payments", "sla"];

export function ordersConfigErrorMessage(error: unknown): string {
  if (error instanceof PedidosError) {
    switch (error.code) {
      case "duplicate-operator-email":
        return "Este correo ya pertenece a otro operador registrado.";
      case "pedidos-incomplete":
        return "Todavía hay ajustes pendientes por revisar antes de guardar la configuración.";
      case "concurrent-change":
        return "Alguien más cambió esta configuración al mismo tiempo. Recarga e inténtalo de nuevo.";
      case "invalid-pedidos-data":
        return "Revisa los datos indicados antes de guardar.";
      case "module-not-enabled":
        return "El módulo de Pedidos no está habilitado para este negocio.";
      default:
        break;
    }
  }
  if (error instanceof AccessError) {
    switch (error.kind) {
      case "rate-limited":
        return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "not-found":
        return "Este negocio ya no está disponible para ti.";
      case "forbidden":
        return "No tienes permiso para hacer esto.";
      case "validation":
        return "Revisa los datos indicados.";
      case "session-expired":
        return "Tu sesión terminó. Verifica tu correo para continuar.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "No pudimos cargar la configuración de Pedidos. Inténtalo de nuevo.";
}

const WHATSAPP_DTO_MAX_LENGTH = 60;

function safeInt(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clampInt(value: number, min: number, max: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  const truncated = Math.trunc(value);
  if (truncated < min) return min;
  if (truncated > max) return max;
  return truncated;
}

function buildModalitiesBody(state: OrdersConfigState): ModalitiesBody {
  return {
    modalities: [...state.modalities],
    onSiteMode: state.onSiteMode,
  };
}

function buildFulfillmentBody(state: OrdersConfigState): FulfillmentBody {
  const f = state.fulfillment;
  const riskApplicable = isFreightRiskThresholdApplicable(state) && f.riskThresholdActive;
  const flatFeeApplicable = isFlatShippingFeeApplicable(state);
  const freeThresholdApplicable = isFreeShippingThresholdApplicable(state);
  const minOrderApplicable = isDeliveryPricingApplicable(state) && f.minimumOrderActive;
  const whatsappApplicable = isWhatsappChannelApplicable(state);

  return {
    hasOwnCourier: f.hasOwnCourier,
    carriers: f.carriers.map(({ id, name, enabled, isDefault }) => ({ id, name, enabled, isDefault })),
    pickupMode: f.pickupMode,
    confirmationMode: f.confirmationMode,
    whatsappNumber: whatsappApplicable ? f.whatsappNumber.trim() : f.whatsappNumber.trim().slice(0, WHATSAPP_DTO_MAX_LENGTH),
    riskThresholdActive: f.riskThresholdActive,
    maxShippingCostRisk: riskApplicable
      ? safeInt(f.maxShippingCostRisk)
      : clampInt(f.maxShippingCostRisk, 0, ORDERS_CONFIG_LIMITS.maxShippingCostRisk.max),
    shippingPricingMode: f.shippingPricingMode,
    flatShippingFee: flatFeeApplicable
      ? safeInt(f.flatShippingFee)
      : clampInt(f.flatShippingFee, 0, ORDERS_CONFIG_LIMITS.flatShippingFee.max),
    freeShippingThreshold: freeThresholdApplicable
      ? safeInt(f.freeShippingThreshold)
      : clampInt(f.freeShippingThreshold, 0, ORDERS_CONFIG_LIMITS.freeShippingThreshold.max),
    minimumOrderActive: f.minimumOrderActive,
    minimumOrderAmount: minOrderApplicable
      ? safeInt(f.minimumOrderAmount)
      : clampInt(f.minimumOrderAmount, 0, ORDERS_CONFIG_LIMITS.minimumOrderAmount.max),
  };
}

function buildPaymentsBody(state: OrdersConfigState): PaymentsBody {
  const p = state.payments;
  return {
    methods: [...p.methods],
    requireTransferReceipt: p.requireTransferReceipt,
    requirePrepaymentBeforePrep: p.requirePrepaymentBeforePrep,
    confirmationExpiryAction: p.confirmationExpiryAction,
    cancellationLimit: p.cancellationLimit,
  };
}

function buildSlaBody(state: OrdersConfigState): SlaBody {
  const s = state.sla;
  const confirmationApplicable = isConfirmationSlaApplicable(state);
  const dispatchApplicable = isDispatchSlaApplicable(state);

  return {
    confirmationMinutes: confirmationApplicable
      ? safeInt(s.confirmationMinutes)
      : clampInt(s.confirmationMinutes, 0, ORDERS_CONFIG_LIMITS.confirmationMinutes.max),
    preparationMinutes: safeInt(s.preparationMinutes),
    dispatchMinutes: dispatchApplicable
      ? safeInt(s.dispatchMinutes)
      : clampInt(s.dispatchMinutes, 0, ORDERS_CONFIG_LIMITS.dispatchMinutes.max),
    urgencyThresholdMinutes: safeInt(s.urgencyThresholdMinutes),
    outOfHoursPolicy: s.outOfHoursPolicy,
    outOfHoursAutoReply: s.outOfHoursAutoReply,
    outOfHoursMessage: s.outOfHoursAutoReply
      ? s.outOfHoursMessage.trim()
      : s.outOfHoursMessage.trim().slice(0, ORDERS_CONFIG_LIMITS.outOfHoursMessage.max),
  };
}

export class OrdersConfigStore {
  status: OrdersConfigStatus = "idle";
  businessId: string | null = null;
  business: OrdersBusiness | null = null;
  state: OrdersConfigState | null = null;
  schedule: PedidosScheduleSummary | null = null;
  suggestedProfile: OrdersProfileId | null = null;
  error: string | null = null;
  saveError: string | null = null;
  saving = false;

  private loadRequestId = 0;
  private dirtySections = new Set<OrdersDirtySection>();
  private serverStep: OrdersConfigStep | null = null;
  private serverVisitedSteps: OrdersConfigStep[] = [];
  private sectionRevisions: Record<OrdersDirtySection, number> = {
    modalities: 0,
    fulfillment: 0,
    payments: 0,
    sla: 0,
  };
  private flushTail: Promise<void> = Promise.resolve();
  private readonly deps: {
    api: PedidosApi;
    access: OrdersConfigAccessAdapter;
  };

  constructor(deps: OrdersConfigStoreDeps = {}) {
    this.deps = {
      api: deps.api ?? pedidosApi,
      access: deps.access ?? {
        ensureSession: () => adminAccessStore.ensureSession(),
        withToken: <T,>(call: (token: string) => Promise<T>) => adminAccessStore.withToken(call),
      },
    };

    makeAutoObservable<
      OrdersConfigStore,
      "loadRequestId" | "dirtySections" | "serverStep" | "serverVisitedSteps" | "sectionRevisions" | "flushTail" | "deps"
    >(this, {
      loadRequestId: false,
      dirtySections: false,
      serverStep: false,
      serverVisitedSteps: false,
      sectionRevisions: false,
      flushTail: false,
      deps: false,
    });
  }

  get errorMessage(): string {
    return this.error ?? "No pudimos cargar la configuración de Pedidos. Inténtalo de nuevo.";
  }

  get currency(): string {
    return this.business?.currency || "COP";
  }

  get validationIssues(): OrdersValidationIssue[] {
    return this.state ? validateOrdersConfig(this.state) : [];
  }

  reset() {
    this.loadRequestId += 1;
    this.flushTail = Promise.resolve();
    this.status = "idle";
    this.businessId = null;
    this.business = null;
    this.state = null;
    this.schedule = null;
    this.suggestedProfile = null;
    this.error = null;
    this.saveError = null;
    this.saving = false;
    this.dirtySections.clear();
    this.serverStep = null;
    this.serverVisitedSteps = [];
  }

  async load(businessId: string): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.flushTail = Promise.resolve();
    this.status = "loading";
    this.businessId = businessId;
    this.error = null;
    this.saveError = null;
    this.dirtySections.clear();

    try {
      const hasSession = await this.deps.access.ensureSession();
      if (requestId !== this.loadRequestId) return;

      if (!hasSession) {
        runInAction(() => {
          this.status = "signed-out";
        });
        return;
      }

      const response = await this.deps.access.withToken((token) => this.deps.api.get(token, businessId));
      if (requestId !== this.loadRequestId) return;

      runInAction(() => {
        if (requestId !== this.loadRequestId) return;
        this.applyServerResponse(response, { preserveDirty: false });
        this.status = "ready";
      });
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) return;
      runInAction(() => {
        if (err instanceof AccessError && err.kind === "session-expired") {
          this.status = "signed-out";
        } else if (err instanceof PedidosError && err.code === "module-not-enabled") {
          this.status = "blocked";
          this.error = ordersConfigErrorMessage(err);
        } else if (err instanceof AccessError && (err.kind === "not-found" || err.kind === "forbidden")) {
          this.status = "unavailable";
          this.error = ordersConfigErrorMessage(err);
        } else {
          this.status = "error";
          this.error = ordersConfigErrorMessage(err);
        }
      });
    }
  }

  private applyServerResponse(response: PedidosApiResponse, options: { preserveDirty?: boolean } = {}) {
    const prev = options.preserveDirty ? this.state : null;
    const preserve = Boolean(options.preserveDirty && prev);

    this.business = {
      id: response.business.id,
      name: response.business.name,
      category: response.business.category,
      categoryOther: response.business.categoryOther,
      currency: response.business.currency,
      timezone: response.business.timezone,
      modules: ["pedidos"],
    };
    this.schedule = response.schedule;
    this.suggestedProfile = response.profile.suggested;
    this.serverStep = response.progress.currentStep;
    this.serverVisitedSteps = [...response.progress.visitedSteps];

    const step: OrdersConfigStep = preserve && prev ? prev.step : (response.progress.currentStep ?? "profile");
    const visitedSet = new Set<OrdersConfigStep>([
      ...response.progress.visitedSteps,
      ...(preserve && prev ? prev.visitedSteps : []),
      step,
    ]);

    const keepModalities = preserve && this.dirtySections.has("modalities");
    const keepFulfillment = preserve && this.dirtySections.has("fulfillment");
    const keepPayments = preserve && this.dirtySections.has("payments");
    const keepSla = preserve && this.dirtySections.has("sla");
    const hasRemainingDirty = preserve && this.dirtySections.size > 0;

    const operators: OrderOperator[] = response.operators.map((op) => ({
      id: op.id,
      name: op.name,
      email: op.email,
      ...(op.phone !== null && op.phone !== "" ? { phone: op.phone } : {}),
      stages: [...op.stages],
      role: "operator",
    }));

    this.state = {
      businessId: response.business.id,
      version: (prev?.version ?? 0) + 1,
      step,
      visitedSteps: [...visitedSet],
      touched: response.progress.touched || hasRemainingDirty,
      status: response.progress.ready && !hasRemainingDirty ? "ready" : "pending",
      profile: response.profile.id,
      modalities: keepModalities && prev ? [...prev.modalities] : [...response.modalities],
      onSiteMode: keepModalities && prev ? prev.onSiteMode : response.onSiteMode,
      fulfillment:
        keepFulfillment && prev
          ? {
              ...prev.fulfillment,
              carriers: prev.fulfillment.carriers.map((c) => ({ ...c })),
            }
          : {
              ...response.fulfillment,
              carriers: response.fulfillment.carriers.map((c) => ({ ...c })),
            },
      payments:
        keepPayments && prev
          ? {
              ...prev.payments,
              methods: [...prev.payments.methods],
            }
          : {
              ...response.payments,
              methods: [...response.payments.methods],
            },
      sla: keepSla && prev ? { ...prev.sla } : { ...response.sla },
      operators,
      updatedAt: response.progress.readyAt ?? new Date().toISOString(),
    };
  }

  private handleMutationError(err: unknown): string {
    const message = ordersConfigErrorMessage(err);
    if (err instanceof AccessError && err.kind === "session-expired") {
      this.status = "signed-out";
    } else if (err instanceof PedidosError && err.code === "module-not-enabled") {
      this.status = "blocked";
      this.error = message;
    } else if (err instanceof AccessError && (err.kind === "not-found" || err.kind === "forbidden")) {
      this.status = "unavailable";
      this.error = message;
    } else {
      this.saveError = message;
    }
    return message;
  }

  private markSectionEdited(section: OrdersDirtySection) {
    if (!this.state) return;
    this.dirtySections.add(section);
    this.sectionRevisions[section] += 1;
    this.state.touched = true;
    this.state.status = "pending";
    this.state.version += 1;
    this.state.updatedAt = new Date().toISOString();
    this.saveError = null;
  }

  /**
   * Flushes valid dirty sections to the backend in canonical dependency order (`modalities -> fulfillment -> payments -> sla`).
   * Overlapping calls are serialized so concurrent navigation or clicks cannot race optimistic version checks, and any section
   * edited mid-flight is re-flushed on a subsequent pass. Invalid sections stay dirty in memory so inline errors remain visible.
   */
  async flushDirtySections(sections?: readonly OrdersDirtySection[]): Promise<boolean> {
    const requestId = this.loadRequestId;
    const previous = this.flushTail;
    let release!: () => void;
    this.flushTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      if (requestId !== this.loadRequestId) return false;
      return await this.runFlushDirtySections(requestId, sections);
    } finally {
      release();
    }
  }

  private async runFlushDirtySections(
    requestId: number,
    sections?: readonly OrdersDirtySection[],
  ): Promise<boolean> {
    const id = this.businessId;
    if (!id || !this.state || this.status !== "ready") return false;
    if (this.dirtySections.size === 0) return true;

    const getValidCandidates = (): OrdersDirtySection[] => {
      const snapshot = this.state;
      if (!snapshot) return [];
      return DIRTY_SECTION_FLUSH_ORDER.filter(
        (section) =>
          this.dirtySections.has(section) &&
          (!sections || sections.includes(section)) &&
          validateStep(snapshot, section).length === 0,
      );
    };

    let candidates = getValidCandidates();
    if (candidates.length === 0) return true;

    this.saving = true;
    this.saveError = null;

    try {
      let passes = 0;
      const maxPasses = 5;
      while (candidates.length > 0 && passes < maxPasses) {
        passes += 1;
        for (const section of candidates) {
          if (!this.state || requestId !== this.loadRequestId || this.status !== "ready") return false;
          if (!this.dirtySections.has(section) || validateStep(this.state, section).length > 0) {
            continue;
          }
          const current = this.state;
          const revisionAtSend = this.sectionRevisions[section];
          let response: PedidosApiResponse;
          if (section === "modalities") {
            response = await this.deps.access.withToken((token) =>
              this.deps.api.updateModalities(token, id, buildModalitiesBody(current)),
            );
          } else if (section === "fulfillment") {
            response = await this.deps.access.withToken((token) =>
              this.deps.api.updateFulfillment(token, id, buildFulfillmentBody(current)),
            );
          } else if (section === "payments") {
            response = await this.deps.access.withToken((token) =>
              this.deps.api.updatePayments(token, id, buildPaymentsBody(current)),
            );
          } else {
            response = await this.deps.access.withToken((token) =>
              this.deps.api.updateSla(token, id, buildSlaBody(current)),
            );
          }

          if (requestId !== this.loadRequestId) return false;
          runInAction(() => {
            if (this.sectionRevisions[section] === revisionAtSend) {
              this.dirtySections.delete(section);
            }
            this.applyServerResponse(response, { preserveDirty: true });
          });
        }
        candidates = getValidCandidates();
      }
      return true;
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) return false;
      runInAction(() => {
        this.handleMutationError(err);
      });
      return false;
    } finally {
      runInAction(() => {
        if (requestId === this.loadRequestId) {
          this.saving = false;
        }
      });
    }
  }

  async setStep(step: OrdersConfigStep): Promise<void> {
    const id = this.businessId;
    if (!id || !this.state) return;
    const requestId = this.loadRequestId;

    await this.flushDirtySections();
    if (!this.state || requestId !== this.loadRequestId || this.status !== "ready") return;

    const stepChanged = this.state.step !== step;
    const newlyVisited = !this.state.visitedSteps.includes(step);
    runInAction(() => {
      if (!this.state) return;
      this.state.step = step;
      if (newlyVisited) {
        this.state.visitedSteps.push(step);
      }
    });

    const needsServerSync = this.serverStep !== step || !this.serverVisitedSteps.includes(step);
    if (!needsServerSync && !stepChanged && !newlyVisited) return;

    try {
      const visitedSteps = [...this.state.visitedSteps];
      const response = await this.deps.access.withToken((token) =>
        this.deps.api.saveProgress(token, id, { currentStep: step, visitedSteps }),
      );
      if (requestId !== this.loadRequestId) return;
      runInAction(() => {
        this.serverStep = response.progress.currentStep;
        this.serverVisitedSteps = [...response.progress.visitedSteps];
      });
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) return;
      if (err instanceof AccessError && err.kind === "session-expired") {
        runInAction(() => {
          this.status = "signed-out";
        });
      }
    }
  }

  async setProfile(profile: OrdersProfileId, options?: { force?: boolean }): Promise<boolean> {
    const id = this.businessId;
    if (!id || !this.state) return false;
    if (this.state.profile === profile) return true;
    if (this.state.touched && !options?.force) return false;

    const requestId = this.loadRequestId;
    this.saving = true;
    this.saveError = null;
    try {
      const response = await this.deps.access.withToken((token) => this.deps.api.changeProfile(token, id, profile));
      if (requestId !== this.loadRequestId) return false;
      runInAction(() => {
        this.dirtySections.clear();
        this.applyServerResponse(response, { preserveDirty: false });
      });
      return true;
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) return false;
      runInAction(() => {
        this.handleMutationError(err);
      });
      return false;
    } finally {
      runInAction(() => {
        if (requestId === this.loadRequestId) {
          this.saving = false;
        }
      });
    }
  }

  toggleModality(modality: ModalityType): ToggleModalityResult {
    if (!this.state) {
      return { ok: false, message: "No hay una configuración cargada." };
    }
    const current = this.state.modalities;
    if (current.includes(modality)) {
      if (current.length <= 1) {
        return { ok: false, message: "Debes mantener al menos una modalidad de entrega activa." };
      }
      this.state.modalities = current.filter((m) => m !== modality);
    } else {
      this.state.modalities = [...current, modality];
    }
    this.markSectionEdited("modalities");
    return { ok: true };
  }

  setOnSiteMode(mode: OnSiteMode) {
    if (!this.state || this.state.onSiteMode === mode) return;
    this.state.onSiteMode = mode;
    this.markSectionEdited("modalities");
  }

  setHasOwnCourier(enabled: boolean) {
    if (!this.state || this.state.fulfillment.hasOwnCourier === enabled) return;
    this.state.fulfillment.hasOwnCourier = enabled;
    this.markSectionEdited("fulfillment");
  }

  setPickupMode(mode: PickupScheduleMode) {
    if (!this.state || this.state.fulfillment.pickupMode === mode) return;
    this.state.fulfillment.pickupMode = mode;
    this.markSectionEdited("fulfillment");
  }

  toggleCarrier(carrierId: CarrierId) {
    if (!this.state) return;
    const carriers = this.state.fulfillment.carriers;
    const target = carriers.find((c) => c.id === carrierId);
    if (!target) return;

    target.enabled = !target.enabled;
    if (!target.enabled && target.isDefault) {
      target.isDefault = false;
      const another = carriers.find((c) => c.enabled);
      if (another) another.isDefault = true;
    } else if (target.enabled && !carriers.some((c) => c.enabled && c.isDefault)) {
      target.isDefault = true;
    }
    this.markSectionEdited("fulfillment");
  }

  setDefaultCarrier(carrierId: CarrierId) {
    if (!this.state) return;
    const exists = this.state.fulfillment.carriers.some((c) => c.id === carrierId);
    if (!exists) return;

    for (const carrier of this.state.fulfillment.carriers) {
      carrier.isDefault = carrier.id === carrierId;
      if (carrier.id === carrierId) {
        carrier.enabled = true;
      }
    }
    this.markSectionEdited("fulfillment");
  }

  setConfirmationMode(mode: ConfirmationMode) {
    if (!this.state || this.state.fulfillment.confirmationMode === mode) return;
    this.state.fulfillment.confirmationMode = mode;
    this.markSectionEdited("fulfillment");
  }

  setWhatsappNumber(value: string) {
    if (!this.state || this.state.fulfillment.whatsappNumber === value) return;
    this.state.fulfillment.whatsappNumber = value;
    this.markSectionEdited("fulfillment");
  }

  setRiskThreshold(active: boolean, amount?: number) {
    if (!this.state) return;
    const nextAmount = typeof amount === "number" ? amount : this.state.fulfillment.maxShippingCostRisk;
    const sameActive = this.state.fulfillment.riskThresholdActive === active;
    const sameAmount = Object.is(this.state.fulfillment.maxShippingCostRisk, nextAmount);
    if (sameActive && sameAmount) return;

    this.state.fulfillment.riskThresholdActive = active;
    if (typeof amount === "number") {
      this.state.fulfillment.maxShippingCostRisk = amount;
    }
    this.markSectionEdited("fulfillment");
  }

  setShippingPricingMode(mode: ShippingPricingMode) {
    if (!this.state || this.state.fulfillment.shippingPricingMode === mode) return;
    this.state.fulfillment.shippingPricingMode = mode;
    this.markSectionEdited("fulfillment");
  }

  setFlatShippingFee(amount: number) {
    if (!this.state || Object.is(this.state.fulfillment.flatShippingFee, amount)) return;
    this.state.fulfillment.flatShippingFee = amount;
    this.markSectionEdited("fulfillment");
  }

  setFreeShippingThreshold(amount: number) {
    if (!this.state || Object.is(this.state.fulfillment.freeShippingThreshold, amount)) return;
    this.state.fulfillment.freeShippingThreshold = amount;
    this.markSectionEdited("fulfillment");
  }

  setMinimumOrder(active: boolean, amount?: number) {
    if (!this.state) return;
    const nextAmount = typeof amount === "number" ? amount : this.state.fulfillment.minimumOrderAmount;
    const sameActive = this.state.fulfillment.minimumOrderActive === active;
    const sameAmount = Object.is(this.state.fulfillment.minimumOrderAmount, nextAmount);
    if (sameActive && sameAmount) return;

    this.state.fulfillment.minimumOrderActive = active;
    if (typeof amount === "number") {
      this.state.fulfillment.minimumOrderAmount = amount;
    }
    this.markSectionEdited("fulfillment");
  }

  togglePaymentMethod(method: PaymentMethodId): TogglePaymentMethodResult {
    if (!this.state) {
      return { ok: false, message: "No hay una configuración cargada." };
    }
    const current = this.state.payments.methods;
    if (current.includes(method)) {
      if (current.length <= 1) {
        return { ok: false, message: "Debes mantener al menos un método de pago habilitado." };
      }
      this.state.payments.methods = current.filter((m) => m !== method);
    } else {
      this.state.payments.methods = [...current, method];
    }
    this.markSectionEdited("payments");
    return { ok: true };
  }

  setRequireTransferReceipt(enabled: boolean) {
    if (!this.state || this.state.payments.requireTransferReceipt === enabled) return;
    this.state.payments.requireTransferReceipt = enabled;
    this.markSectionEdited("payments");
  }

  setRequirePrepaymentBeforePrep(enabled: boolean) {
    if (!this.state || this.state.payments.requirePrepaymentBeforePrep === enabled) return;
    this.state.payments.requirePrepaymentBeforePrep = enabled;
    this.markSectionEdited("payments");
  }

  setConfirmationExpiryAction(action: ConfirmationExpiryAction) {
    if (!this.state || this.state.payments.confirmationExpiryAction === action) return;
    this.state.payments.confirmationExpiryAction = action;
    this.markSectionEdited("payments");
  }

  setCancellationLimit(stage: CancellationStage) {
    if (!this.state || this.state.payments.cancellationLimit === stage) return;
    this.state.payments.cancellationLimit = stage;
    this.markSectionEdited("payments");
  }

  updateSla(partial: Partial<SlaSettings>) {
    if (!this.state) return;
    const keys = Object.keys(partial) as Array<keyof SlaSettings>;
    const changed = keys.some((key) => {
      const nextValue = partial[key];
      return nextValue !== undefined && !Object.is(this.state!.sla[key], nextValue);
    });
    if (!changed) return;

    this.state.sla = {
      ...this.state.sla,
      ...partial,
    };
    this.markSectionEdited("sla");
  }

  async addOperator(operator: OperatorInput): Promise<OperatorMutationResult> {
    const id = this.businessId;
    if (!id || !this.state) {
      return { ok: false, field: "operator", message: "No hay una configuración cargada." };
    }
    const validation = validateOperatorInput(operator, this.state.operators);
    if (!validation.ok) {
      return { ok: false, field: validation.field, message: validation.message };
    }

    const requestId = this.loadRequestId;
    const body: OperatorBody = {
      name: validation.value.name,
      email: validation.value.email,
      phone: validation.value.phone ?? null,
      stages: validation.value.stages,
    };

    this.saving = true;
    this.saveError = null;
    try {
      const response = await this.deps.access.withToken((token) => this.deps.api.createOperator(token, id, body));
      if (requestId !== this.loadRequestId) {
        return { ok: false, field: "operator", message: "La operación fue cancelada." };
      }
      let created: OrderOperator | undefined;
      runInAction(() => {
        this.applyServerResponse(response, { preserveDirty: true });
        const createdId = response.created?.id;
        created =
          (createdId ? this.state?.operators.find((op) => op.id === createdId) : undefined) ??
          this.state?.operators.find((op) => op.email === validation.value.email);
      });
      if (!created) {
        return { ok: false, field: "operator", message: "No pudimos confirmar el registro del operador." };
      }
      return { ok: true, operator: created };
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) {
        return { ok: false, field: "operator", message: "La operación fue cancelada." };
      }
      if (err instanceof PedidosError && (err.code === "duplicate-operator-email" || Boolean(err.fields.email))) {
        return { ok: false, field: "email", message: ordersConfigErrorMessage(err) };
      }
      let message = ordersConfigErrorMessage(err);
      runInAction(() => {
        message = this.handleMutationError(err);
      });
      return { ok: false, field: "operator", message };
    } finally {
      runInAction(() => {
        if (requestId === this.loadRequestId) {
          this.saving = false;
        }
      });
    }
  }

  async updateOperator(operatorId: string, input: OperatorInput): Promise<OperatorMutationResult> {
    const id = this.businessId;
    if (!id || !this.state) {
      return { ok: false, field: "operator", message: "No hay una configuración cargada." };
    }
    const existing = this.state.operators.find((op) => op.id === operatorId);
    if (!existing) {
      return { ok: false, field: "operator", message: "El operador seleccionado ya no existe." };
    }
    const validation = validateOperatorInput(
      {
        ...input,
        stages: input.stages === undefined ? existing.stages : input.stages,
      },
      this.state.operators,
      operatorId,
    );
    if (!validation.ok) {
      return { ok: false, field: validation.field, message: validation.message };
    }

    const requestId = this.loadRequestId;
    const body: OperatorBody = {
      name: validation.value.name,
      email: validation.value.email,
      phone: validation.value.phone ?? null,
      stages: validation.value.stages,
    };

    this.saving = true;
    this.saveError = null;
    try {
      const response = await this.deps.access.withToken((token) =>
        this.deps.api.updateOperator(token, id, operatorId, body),
      );
      if (requestId !== this.loadRequestId) {
        return { ok: false, field: "operator", message: "La operación fue cancelada." };
      }
      let updated: OrderOperator | undefined;
      runInAction(() => {
        this.applyServerResponse(response, { preserveDirty: true });
        updated = this.state?.operators.find((op) => op.id === operatorId);
      });
      if (!updated) {
        return { ok: false, field: "operator", message: "El operador seleccionado ya no existe." };
      }
      return { ok: true, operator: updated };
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) {
        return { ok: false, field: "operator", message: "La operación fue cancelada." };
      }
      if (err instanceof PedidosError && (err.code === "duplicate-operator-email" || Boolean(err.fields.email))) {
        return { ok: false, field: "email", message: ordersConfigErrorMessage(err) };
      }
      let message = ordersConfigErrorMessage(err);
      runInAction(() => {
        message = this.handleMutationError(err);
      });
      return { ok: false, field: "operator", message };
    } finally {
      runInAction(() => {
        if (requestId === this.loadRequestId) {
          this.saving = false;
        }
      });
    }
  }

  async removeOperator(operatorId: string): Promise<boolean> {
    const id = this.businessId;
    if (!id || !this.state) return false;
    if (!this.state.operators.some((op) => op.id === operatorId)) return false;

    const requestId = this.loadRequestId;
    this.saving = true;
    this.saveError = null;
    try {
      const response = await this.deps.access.withToken((token) =>
        this.deps.api.deleteOperator(token, id, operatorId),
      );
      if (requestId !== this.loadRequestId) return false;
      runInAction(() => {
        this.applyServerResponse(response, { preserveDirty: true });
      });
      return true;
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) return false;
      runInAction(() => {
        this.handleMutationError(err);
      });
      return false;
    } finally {
      runInAction(() => {
        if (requestId === this.loadRequestId) {
          this.saving = false;
        }
      });
    }
  }

  async completeSetup(): Promise<CompleteSetupResult> {
    const id = this.businessId;
    if (!id || !this.state) {
      return {
        ok: false,
        issues: [{ step: "profile", field: "state", message: "No hay una configuración cargada para guardar." }],
      };
    }

    const issues = validateOrdersConfig(this.state);
    if (issues.length > 0) {
      return { ok: false, issues };
    }

    const flushed = await this.flushDirtySections();
    if (!flushed || this.dirtySections.size > 0) {
      return {
        ok: false,
        issues: [],
        error: this.saveError ?? "No pudimos guardar los cambios pendientes antes de finalizar.",
      };
    }

    const requestId = this.loadRequestId;
    this.saving = true;
    this.saveError = null;
    try {
      const response = await this.deps.access.withToken((token) => this.deps.api.complete(token, id));
      if (requestId !== this.loadRequestId) {
        return { ok: false, issues: [], error: "La operación fue cancelada." };
      }
      runInAction(() => {
        this.dirtySections.clear();
        this.applyServerResponse(response, { preserveDirty: false });
      });
      return { ok: true };
    } catch (err: unknown) {
      if (requestId !== this.loadRequestId) {
        return { ok: false, issues: [], error: "La operación fue cancelada." };
      }
      let message = ordersConfigErrorMessage(err);
      runInAction(() => {
        message = this.handleMutationError(err);
      });
      return { ok: false, issues: [], error: message };
    } finally {
      runInAction(() => {
        if (requestId === this.loadRequestId) {
          this.saving = false;
        }
      });
    }
  }
}

export const ordersConfigStore = new OrdersConfigStore();
