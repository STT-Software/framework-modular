import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access/public";
import { pedidosApi, PedidosError, type PedidosApi } from "../../api/pedidosApi";
import { ordersConfigErrorMessage } from "../../ordersConfig.store";
import { ALL_OPERATOR_STAGES, type PedidosOperatorView } from "../../types";

export type PedidosOperatorStatus = "idle" | "loading" | "ready" | "unavailable" | "signed-out" | "error";

export interface PedidosOperatorAccessAdapter {
  chooseRole(businessId: string): "admin" | "operator" | undefined;
  ensureSession(): Promise<boolean>;
  withToken<T>(call: (token: string) => Promise<T>): Promise<T>;
}

export interface PedidosOperationStoreDeps {
  api?: Pick<PedidosApi, "get" | "operator">;
  access?: PedidosOperatorAccessAdapter;
}

/**
 * Read-only operator view state for Pedidos.
 * Shares the `business-access` OTP session; the server decides authorization on every request.
 */
export class PedidosOperationStore {
  status: PedidosOperatorStatus = "idle";
  view: PedidosOperatorView | null = null;
  error: string | null = null;

  isAdmin = false;
  operatorCount = 0;

  private loadRequestId = 0;
  private readonly deps: {
    api: Pick<PedidosApi, "get" | "operator">;
    access: PedidosOperatorAccessAdapter;
  };

  constructor(deps: PedidosOperationStoreDeps = {}) {
    this.deps = {
      api: deps.api ?? pedidosApi,
      access: deps.access ?? {
        chooseRole: (id) => {
          const grants = adminAccessStore.accesses.filter(access => access.businessId === id && access.modules.includes("pedidos"));
          const selected = adminAccessStore.access;
          return grants.find(access => access.key === selected?.key)?.role
            ?? grants.find(access => access.role === "admin")?.role ?? grants[0]?.role;
        },
        ensureSession: () => adminAccessStore.ensureSession(),
        withToken: <T,>(call: (token: string) => Promise<T>) => adminAccessStore.withToken(call),
      },
    };

    makeAutoObservable<PedidosOperationStore, "loadRequestId" | "deps">(this, {
      loadRequestId: false,
      deps: false,
    });
  }

  async load(businessId: string): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.status = "loading";
    this.error = null;
    try {
      if (!(await this.deps.access.ensureSession())) {
        if (requestId !== this.loadRequestId) return;
        runInAction(() => {
          this.status = "signed-out";
        });
        return;
      }
      if (requestId !== this.loadRequestId) return;
      const role = this.deps.access.chooseRole(businessId);
      if (!role) {
        runInAction(() => { this.status = "unavailable"; });
        return;
      }
      const { view, operatorCount } = await this.deps.access.withToken(async token => {
        if (role === "operator") return { view: await this.deps.api.operator(token, businessId), operatorCount: 1 };
        const config = await this.deps.api.get(token, businessId);
        const admin = config.candidateOperators?.find(candidate => candidate.sources.includes("admin"));
        return {
          view: {
            business: config.business,
            operator: {
              id: "admin", name: admin?.name ?? adminAccessStore.access?.personName ?? "Administrador",
              email: adminAccessStore.email, phone: admin?.phone ?? null, stages: [...ALL_OPERATOR_STAGES],
            },
            schedule: config.schedule, modalities: config.modalities, confirmationMode: config.fulfillment.confirmationMode,
          },
          operatorCount: config.operators.length,
        };
      });
      if (requestId !== this.loadRequestId) return;
      runInAction(() => {
        this.isAdmin = role === "admin";
        this.operatorCount = operatorCount;
        this.view = view;
        this.status = "ready";
      });
    } catch (error) {
      if (requestId !== this.loadRequestId) return;
      runInAction(() => {
        if (error instanceof AccessError && error.kind === "session-expired") {
          this.status = "signed-out";
        } else if (
          (error instanceof PedidosError && error.code === "module-not-enabled") ||
          (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden"))
        ) {
          this.status = "unavailable";
        } else {
          this.status = "error";
          this.error = ordersConfigErrorMessage(error);
        }
      });
    }
  }

  reset(): void {
    this.loadRequestId += 1;
    this.isAdmin = false;
    this.operatorCount = 0;
    this.status = "idle";
    this.view = null;
    this.error = null;
  }
}

export const pedidosOperationStore = new PedidosOperationStore();
