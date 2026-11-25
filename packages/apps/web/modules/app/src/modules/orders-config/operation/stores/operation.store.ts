import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access/public";
import { pedidosApi, PedidosError, type OperatorBody, type PedidosApi } from "../../api/pedidosApi";
import { ordersConfigErrorMessage } from "../../ordersConfig.store";
import { validateOperatorInput } from "../../validation";
import {
  ALL_OPERATOR_STAGES,
  type OperatorInput,
  type OrderOperator,
  type PedidosApiOperator,
  type PedidosApiResponse,
  type PedidosOperatorView,
} from "../../types";

/** Resultado de una operación del equipo de Pedidos, con el mensaje listo para mostrar. */
export interface PedidosOperatorMutationResult {
  ok: boolean;
  message?: string;
}

export type PedidosOperatorStatus = "idle" | "loading" | "ready" | "unavailable" | "signed-out" | "error";

export interface PedidosOperatorAccessAdapter {
  chooseRole(businessId: string): "admin" | "operator" | undefined;
  ensureSession(): Promise<boolean>;
  withToken<T>(call: (token: string) => Promise<T>): Promise<T>;
}

export interface PedidosOperationStoreDeps {
  api?: Pick<PedidosApi, "get" | "operator" | "createOperator" | "updateOperator" | "deleteOperator">;
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
  /** El equipo real de Pedidos (solo el administrador lo recibe). */
  operators: OrderOperator[] = [];
  /** Hay una operación del equipo en curso. */
  operatorsBusy = false;

  private businessId = "";
  private loadRequestId = 0;
  private readonly deps: {
    api: Pick<PedidosApi, "get" | "operator" | "createOperator" | "updateOperator" | "deleteOperator">;
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

    makeAutoObservable<PedidosOperationStore, "businessId" | "loadRequestId" | "deps">(this, {
      businessId: false,
      loadRequestId: false,
      deps: false,
    });
  }

  async load(businessId: string): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.businessId = businessId;
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
      const { view, operatorCount, operators } = await this.deps.access.withToken(async token => {
        if (role === "operator") return { view: await this.deps.api.operator(token, businessId), operatorCount: 1, operators: [] };
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
          operators: mapOperators(config.operators),
        };
      });
      if (requestId !== this.loadRequestId) return;
      runInAction(() => {
        this.isAdmin = role === "admin";
        this.operatorCount = operatorCount;
        this.operators = operators;
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
    this.operators = [];
    this.operatorsBusy = false;
    this.status = "idle";
    this.view = null;
    this.error = null;
  }

  /** Añade un operador al equipo de Pedidos y deja el estado con lo que confirmó el servidor. */
  async addOperator(input: OperatorInput): Promise<PedidosOperatorMutationResult> {
    return this.mutateOperators(
      operator => validateOperatorInput(operator, this.operators),
      (token, body) => this.deps.api.createOperator(token, this.businessId, body),
      input,
    );
  }

  /** Actualiza un operador existente (nombre, correo, teléfono y etapas). */
  async updateOperator(operatorId: string, input: OperatorInput): Promise<PedidosOperatorMutationResult> {
    if (!this.operators.some(operator => operator.id === operatorId)) {
      return { ok: false, message: "El operador ya no está en el equipo." };
    }
    return this.mutateOperators(
      operator => validateOperatorInput(operator, this.operators, operatorId),
      (token, body) => this.deps.api.updateOperator(token, this.businessId, operatorId, body),
      input,
    );
  }

  /** Retira a un operador del equipo de Pedidos. */
  async removeOperator(operatorId: string): Promise<PedidosOperatorMutationResult> {
    if (!this.operators.some(operator => operator.id === operatorId)) {
      return { ok: false, message: "El operador ya no está en el equipo." };
    }
    const requestId = this.loadRequestId;
    this.operatorsBusy = true;
    try {
      const response = await this.deps.access.withToken(token => this.deps.api.deleteOperator(token, this.businessId, operatorId));
      if (requestId !== this.loadRequestId) return { ok: false, message: "La operación fue cancelada." };
      runInAction(() => this.applyOperators(response.operators));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: ordersConfigErrorMessage(error) };
    } finally {
      if (requestId === this.loadRequestId) runInAction(() => { this.operatorsBusy = false; });
    }
  }

  private async mutateOperators(
    validate: (input: OperatorInput) => ReturnType<typeof validateOperatorInput>,
    send: (token: string, body: OperatorBody) => Promise<PedidosApiResponse>,
    input: OperatorInput,
  ): Promise<PedidosOperatorMutationResult> {
    const validation = validate(input);
    if (!validation.ok) return { ok: false, message: validation.message };
    const requestId = this.loadRequestId;
    this.operatorsBusy = true;
    try {
      const response = await this.deps.access.withToken(token =>
        send(token, {
          name: validation.value.name,
          email: validation.value.email,
          phone: validation.value.phone ?? null,
          stages: validation.value.stages,
        }),
      );
      if (requestId !== this.loadRequestId) return { ok: false, message: "La operación fue cancelada." };
      runInAction(() => this.applyOperators(response.operators));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: ordersConfigErrorMessage(error) };
    } finally {
      if (requestId === this.loadRequestId) runInAction(() => { this.operatorsBusy = false; });
    }
  }

  private applyOperators(operators: PedidosApiOperator[]): void {
    this.operators = mapOperators(operators);
    this.operatorCount = this.operators.length;
  }
}

/** El operador tal como lo devuelve la API, en la forma que usa la interfaz. */
function mapOperators(operators: PedidosApiOperator[]): OrderOperator[] {
  return operators.map(operator => ({
    id: operator.id,
    name: operator.name,
    email: operator.email,
    phone: operator.phone ?? undefined,
    stages: [...operator.stages],
    role: "operator",
  }));
}

export const pedidosOperationStore = new PedidosOperationStore();
