import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access";
import { turnosApi } from "../api/turnosApi";
import { turnosErrorMessage } from "../messages";
import type { OperatorView } from "../types";

export type OperatorStatus = "idle" | "loading" | "ready" | "unavailable" | "signed-out" | "error";

/**
 * Lo que ve un operador de Turnos: él y solo sus filas. Es la misma sesión de `business-access` que usan los administradores; qué puede
 * abrir la decide el servidor en cada petición (sin asignación vigente, con el módulo deshabilitado o con el negocio pausado responde
 * «no encontrado» y la pantalla lo dice sin más detalle).
 */
class OperatorStore {
  status: OperatorStatus = "idle";
  view: OperatorView | null = null;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async load(businessId: string): Promise<void> {
    this.status = "loading";
    this.error = null;
    try {
      if (!(await adminAccessStore.ensureSession())) {
        runInAction(() => (this.status = "signed-out"));
        return;
      }
      const view = await adminAccessStore.withToken((token) => turnosApi.operator(token, businessId));
      runInAction(() => {
        this.view = view;
        this.status = "ready";
      });
    } catch (error) {
      runInAction(() => {
        if (error instanceof AccessError && error.kind === "session-expired") this.status = "signed-out";
        else if (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden")) this.status = "unavailable";
        else {
          this.status = "error";
          this.error = turnosErrorMessage(error);
        }
      });
    }
  }

  reset(): void {
    this.status = "idle";
    this.view = null;
    this.error = null;
  }
}

export const operatorStore = new OperatorStore();
