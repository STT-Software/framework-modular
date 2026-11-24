import { makeAutoObservable, runInAction } from "mobx";
import { adminAccessStore, AccessError } from "@/modules/business-access";
import { dashboardApi, type ActivityEntry, type DashboardState } from "../api/dashboardApi";
export type DashboardStatus = "loading" | "ready" | "signed-out" | "not-found" | "error";
/** Lo que muestra el dashboard general: el estado del negocio que dice el servidor, y lo último que pasó en Turnos. */
class DashboardStore {
  status: DashboardStatus = "loading";
  state: DashboardState | null = null;
  activity: ActivityEntry[] = [];
  private requested = "";
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  async load(businessId: string): Promise<void> {
    this.requested = businessId;
    this.status = "loading";
    try {
      if (!(await adminAccessStore.ensureSession())) return this.fail("signed-out");
      const state = await adminAccessStore.withToken((token) => dashboardApi.get(token, businessId));
      if (this.requested !== businessId) return;
      runInAction(() => {
        this.state = state;
        this.status = "ready";
      });
      const turnos = state.modules.find((module) => module.id === "turnos");
      if (state.entry === "dashboard" && turnos?.setup.status === "ready") {
        // Es un adorno del dashboard: si no llega, el resto de la pantalla sigue siendo verdad.
        const activity = await adminAccessStore.withToken((token) => dashboardApi.activity(token, businessId)).catch(() => []);
        runInAction(() => {
          if (this.requested === businessId) this.activity = activity;
        });
      }
    } catch (error) {
      if (this.requested !== businessId) return;
      if (error instanceof AccessError && error.kind === "session-expired") return this.fail("signed-out");
      if (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden")) return this.fail("not-found");
      this.fail("error");
    }
  }
  reset(): void {
    this.requested = "";
    this.state = null;
    this.activity = [];
    this.status = "loading";
  }
  private fail(status: DashboardStatus): void {
    runInAction(() => {
      this.status = status;
    });
  }
}
export const dashboardStore = new DashboardStore();
