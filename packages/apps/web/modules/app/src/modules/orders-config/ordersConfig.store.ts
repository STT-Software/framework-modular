import { makeAutoObservable, runInAction } from "mobx";
import { adminAccessStore, type AdministeredBusiness } from "@/modules/business-access";
import { createInitialConfigState, PROFILE_DEFAULTS } from "./constants";
import type { CarrierId, ModalityType, OrderOperator, OrdersConfigState, OrdersConfigStep, OrdersProfileId } from "./types";

const STORAGE_KEY_PREFIX = "necto.orders_config.v1.";

export type OrdersConfigStatus = "idle" | "loading" | "ready" | "blocked" | "unavailable" | "signed-out" | "error";

class OrdersConfigStore {
  status: OrdersConfigStatus = "idle";
  businessId: string | null = null;
  business: AdministeredBusiness | null = null;
  state: OrdersConfigState | null = null;
  error: string | null = null;
  saving = false;

  constructor() {
    makeAutoObservable(this);
  }

  reset() {
    this.status = "idle";
    this.businessId = null;
    this.business = null;
    this.state = null;
    this.error = null;
    this.saving = false;
  }

  async load(businessId: string) {
    this.status = "loading";
    this.businessId = businessId;
    this.error = null;

    try {
      const hasSession = await adminAccessStore.ensureSession();
      if (!hasSession) {
        runInAction(() => {
          this.status = "signed-out";
        });
        return;
      }

      // Si el usuario recargó la página directamente en esta URL, adminAccessStore.businesses
      // puede estar vacío hasta que se consulte el negocio. Usamos withToken para validar acceso.
      let business = adminAccessStore.businesses.find((b) => b.id === businessId);
      if (!business) {
        try {
          business = await adminAccessStore.withToken((token) =>
            import("@/modules/business-access/api/businessAccessApi").then((m) =>
              m.businessAccessApi.business(token, businessId)
            )
          );
        } catch {
          // Si no se puede obtener directamente, se mantendrá undefined
        }
      }

      if (!business) {
        runInAction(() => {
          this.status = "unavailable";
          this.error = "No tienes acceso como administrador de este negocio.";
        });
        return;
      }

      if (!business.modules.includes("pedidos")) {
        runInAction(() => {
          this.status = "blocked";
          this.error = "El módulo de Pedidos no está habilitado para este negocio.";
        });
        return;
      }

      // Cargar persistencia local del negocio
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${businessId}`);
      let loaded: OrdersConfigState;
      if (raw) {
        try {
          loaded = JSON.parse(raw);
        } catch {
          loaded = createInitialConfigState(businessId);
        }
      } else {
        loaded = createInitialConfigState(businessId);
      }

      runInAction(() => {
        this.business = business!;
        this.state = loaded;
        this.status = "ready";
      });
    } catch (err: unknown) {
      runInAction(() => {
        this.status = "error";
        this.error = err instanceof Error ? err.message : "Error al cargar la configuración de Pedidos.";
      });
    }
  }

  private saveLocally() {
    if (!this.businessId || !this.state) return;
    this.state.updatedAt = new Date().toISOString();
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${this.businessId}`, JSON.stringify(this.state));
  }

  setStep(step: OrdersConfigStep) {
    if (!this.state) return;
    this.state.step = step;
    this.saveLocally();
  }

  setProfile(profile: OrdersProfileId) {
    if (!this.state) return;
    this.state.profile = profile;
    const defaults = PROFILE_DEFAULTS[profile];
    this.state.modalities = [...defaults.modalities];
    this.state.fulfillment = {
      ...this.state.fulfillment,
      ...defaults.fulfillment,
    };
    this.state.sla = { ...defaults.sla };
    this.saveLocally();
  }

  toggleModality(modality: ModalityType) {
    if (!this.state) return;
    const current = this.state.modalities;
    if (current.includes(modality)) {
      if (current.length > 1) {
        this.state.modalities = current.filter((m) => m !== modality);
      }
    } else {
      this.state.modalities.push(modality);
    }
    this.saveLocally();
  }

  setHasOwnCourier(enabled: boolean) {
    if (!this.state) return;
    this.state.fulfillment.hasOwnCourier = enabled;
    this.saveLocally();
  }

  toggleCarrier(carrierId: CarrierId) {
    if (!this.state) return;
    const target = this.state.fulfillment.carriers.find((c) => c.id === carrierId);
    if (target) {
      target.enabled = !target.enabled;
      if (!target.enabled && target.isDefault) {
        target.isDefault = false;
        const another = this.state.fulfillment.carriers.find((c) => c.enabled);
        if (another) another.isDefault = true;
      }
      this.saveLocally();
    }
  }

  setDefaultCarrier(carrierId: CarrierId) {
    if (!this.state) return;
    for (const c of this.state.fulfillment.carriers) {
      c.isDefault = c.id === carrierId;
      if (c.id === carrierId) c.enabled = true;
    }
    this.saveLocally();
  }

  setConfirmationMode(mode: "manual" | "automatic" | "agent") {
    if (!this.state) return;
    this.state.fulfillment.confirmationMode = mode;
    this.saveLocally();
  }

  setRiskThreshold(active: boolean, amount?: number) {
    if (!this.state) return;
    this.state.fulfillment.riskThresholdActive = active;
    if (typeof amount === "number") {
      this.state.fulfillment.maxShippingCostRisk = amount;
    }
    this.saveLocally();
  }

  updateSla(partial: Partial<OrdersConfigState["sla"]>) {
    if (!this.state) return;
    this.state.sla = {
      ...this.state.sla,
      ...partial,
    };
    this.saveLocally();
  }

  addOperator(operator: Omit<OrderOperator, "id" | "role">) {
    if (!this.state) return;
    const newOp: OrderOperator = {
      id: "op_" + Math.random().toString(36).substring(2, 9),
      name: operator.name.trim(),
      email: operator.email.trim().toLowerCase(),
      phone: operator.phone?.trim(),
      role: "operator",
    };
    this.state.operators.push(newOp);
    this.saveLocally();
  }

  removeOperator(operatorId: string) {
    if (!this.state) return;
    this.state.operators = this.state.operators.filter((op) => op.id !== operatorId);
    this.saveLocally();
  }

  completeSetup(): boolean {
    if (!this.state) return false;
    this.state.status = "ready";
    this.state.step = "review";
    this.saveLocally();
    return true;
  }
}

export const ordersConfigStore = new OrdersConfigStore();
