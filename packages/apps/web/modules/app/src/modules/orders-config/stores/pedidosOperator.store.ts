import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access";
import { pedidosApi, PedidosError, type PedidosApi } from "../api/pedidosApi";
import { ordersConfigErrorMessage } from "../ordersConfig.store";
import type { PedidosOperatorView } from "../types";

export type PedidosOperatorStatus = "idle" | "loading" | "ready" | "unavailable" | "signed-out" | "error";

export interface PedidosOperatorAccessAdapter {
  ensureSession(): Promise<boolean>;
  withToken<T>(call: (token: string) => Promise<T>): Promise<T>;
}

export interface PedidosOperatorStoreDeps {
  api?: Pick<PedidosApi, "operator">;
  access?: PedidosOperatorAccessAdapter;
}

/**
 * Read-only operator view state for Pedidos.
 * Shares the `business-access` OTP session; the server decides authorization on every request.
 */
export class PedidosOperatorStore {
  status: PedidosOperatorStatus = "idle";
  view: PedidosOperatorView | null = null;
  error: string | null = null;

  private loadRequestId = 0;
  private readonly deps: {
    api: Pick<PedidosApi, "operator">;
    access: PedidosOperatorAccessAdapter;
  };

  constructor(deps: PedidosOperatorStoreDeps = {}) {
    this.deps = {
      api: deps.api ?? pedidosApi,
      access: deps.access ?? {
        ensureSession: () => adminAccessStore.ensureSession(),
        withToken: <T,>(call: (token: string) => Promise<T>) => adminAccessStore.withToken(call),
      },
    };

    makeAutoObservable<PedidosOperatorStore, "loadRequestId" | "deps">(this, {
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
      const view = await this.deps.access.withToken((token) => this.deps.api.operator(token, businessId));
      if (requestId !== this.loadRequestId) return;
      runInAction(() => {
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
    this.status = "idle";
    this.view = null;
    this.error = null;
  }
}

export const pedidosOperatorStore = new PedidosOperatorStore();
