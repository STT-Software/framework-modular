import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access";
import { turnosApi } from "../../api/turnosApi";
import type { EffectiveRules, OperatorViewId, QueueColor, QueueField, QueueMode, TurnosQueue, TurnosState } from "../../types";
import { eventsUrl } from "../api/operationApi";
import type { Role } from "../types";
export type OperationStatus = "loading" | "ready" | "signed-out" | "denied" | "error";
/** Una fila tal como la ve la persona: las del administrador vienen de la configuración, las del operador de su vista. */
export interface QueueInfo {
  id: string;
  name: string;
  color: QueueColor;
  mode: QueueMode;
  averageMinutes: number;
  status: "active" | "paused";
  fields: QueueField[];
  effective: EffectiveRules;
  ticketExample: string;
}
export const ALL_VIEWS: OperatorViewId[] = ["home", "my-turns", "create-turn", "queues", "surveys"];
const asQueueInfo = (queue: TurnosQueue): QueueInfo => ({
  id: queue.id,
  name: queue.name,
  color: queue.color,
  mode: queue.mode,
  averageMinutes: queue.averageMinutes,
  status: queue.status,
  fields: queue.fields,
  effective: queue.effective,
  ticketExample: queue.ticketExample,
});
/**
 * La sesión de trabajo en Turnos: quién es la persona (administrador u operador), qué vistas y filas tiene, y la conexión en vivo.
 * El rol, las vistas y las filas son lo que el servidor devolvió; aquí solo se recuerdan para pintar. El servidor vuelve a decidir en cada
 * petición, y si la persona pierde el acceso con la pantalla abierta, el canal en vivo lo avisa (`access.revoked`).
 */
class OperationStore {
  status: OperationStatus = "loading";
  /** Por qué no se puede entrar, cuando el servidor lo dice (`operator-not-operable`...). */
  deniedReason: string | null = null;
  role: Role = "admin";
  businessId = "";
  businessName = "";
  personName = "";
  views: OperatorViewId[] = [];
  queues: QueueInfo[] = [];
  /** Solo el administrador: la configuración completa (filas con sus reglas, operadores, ajustes). */
  config: TurnosState | null = null;
  /** Sube con cada cosa que pasa en Turnos: las pantallas vuelven a leer lo que muestran. */
  revision = 0;
  live = false;
  private abort: AbortController | null = null;
  private bumpTimer: ReturnType<typeof setTimeout> | null = null;
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  get isAdmin(): boolean {
    return this.role === "admin";
  }
  can(view: OperatorViewId): boolean {
    return this.isAdmin || this.views.includes(view);
  }
  /** La primera vista que la persona puede abrir (el administrador, el inicio). */
  get firstView(): OperatorViewId | null {
    return this.isAdmin ? "home" : (this.views[0] ?? null);
  }
  queueById(id: string): QueueInfo | undefined {
    return this.queues.find((queue) => queue.id === id);
  }
  async load(businessId: string): Promise<void> {
    if (this.businessId === businessId && this.status === "ready") return;
    this.stopLive();
    this.status = "loading";
    this.businessId = businessId;
    this.deniedReason = null;
    try {
      if (!(await adminAccessStore.ensureSession())) return this.finish("signed-out");
      const role = this.chooseRole(businessId);
      if (!role) return this.finish("denied");
      await this.readScope(role);
      runInAction(() => {
        this.status = "ready";
      });
      this.startLive();
    } catch (error) {
      this.fail(error);
    }
  }
  /** Vuelve a leer lo que la persona puede ver (tras un cambio de permisos o de configuración). */
  async readScope(role: Role = this.role): Promise<void> {
    if (role === "admin") {
      const config = await adminAccessStore.withToken((token) => turnosApi.get(token, this.businessId));
      const access = adminAccessStore.accesses.find((item) => item.businessId === this.businessId && item.role === "admin");
      runInAction(() => {
        this.role = "admin";
        this.config = config;
        this.businessName = config.business.name;
        this.personName = access?.personName ?? "Administrador";
        this.views = ALL_VIEWS;
        this.queues = config.queues.map(asQueueInfo);
      });
      return;
    }
    const view = await adminAccessStore.withToken((token) => turnosApi.operator(token, this.businessId));
    runInAction(() => {
      this.role = "operator";
      this.config = null;
      this.businessName = view.business.name;
      this.personName = view.operator.name;
      this.views = view.views;
      this.queues = view.queues.map((queue) => ({ ...queue }));
    });
  }
  /** Tras guardar algo de la configuración, el administrador deja de leer lo viejo. */
  applyConfig(config: TurnosState): void {
    this.config = config;
    this.queues = config.queues.map(asQueueInfo);
  }
  reset(): void {
    this.stopLive();
    this.status = "loading";
    this.businessId = "";
    this.config = null;
    this.queues = [];
    this.views = [];
    this.deniedReason = null;
  }
  /** Ejecuta una llamada con el token de la sesión (renovándolo si venció) y el rol y negocio actuales. */
  run<T>(call: (token: string, role: Role, businessId: string) => Promise<T>): Promise<T> {
    return adminAccessStore.withToken((token) => call(token, this.role, this.businessId));
  }
  /** Avisa a las pantallas que algo cambió (varias señales seguidas cuentan como una). */
  bump(): void {
    if (this.bumpTimer) clearTimeout(this.bumpTimer);
    this.bumpTimer = setTimeout(() => {
      runInAction(() => {
        this.revision += 1;
      });
    }, 250);
  }
  private chooseRole(businessId: string): Role | null {
    const accesses = adminAccessStore.accesses.filter((item) => item.businessId === businessId && item.modules.includes("turnos"));
    const chosen = adminAccessStore.access;
    if (chosen && chosen.businessId === businessId && accesses.some((item) => item.role === chosen.role)) return chosen.role;
    if (accesses.some((item) => item.role === "admin")) return "admin";
    return accesses.some((item) => item.role === "operator") ? "operator" : null;
  }
  private finish(status: OperationStatus): void {
    runInAction(() => {
      this.status = status;
    });
  }
  private fail(error: unknown): void {
    runInAction(() => {
      if (error instanceof AccessError && error.kind === "session-expired") this.status = "signed-out";
      else if (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden")) {
        this.status = "denied";
        this.deniedReason = (error as { code?: string | null }).code ?? null;
      } else this.status = "error";
    });
  }
  // --- La conexión en vivo -------------------------------------------------------------------------------------------------
  private startLive(): void {
    this.stopLive();
    const controller = new AbortController();
    this.abort = controller;
    void this.listen(controller);
  }
  private stopLive(): void {
    this.abort?.abort();
    this.abort = null;
    this.live = false;
    if (this.bumpTimer) clearTimeout(this.bumpTimer);
  }
  private async listen(controller: AbortController): Promise<void> {
    let attempt = 0;
    while (!controller.signal.aborted) {
      try {
        const response = await adminAccessStore.withToken(async (token) => {
          const result = await fetch(eventsUrl(this.role, this.businessId), {
            credentials: "include",
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (result.status === 401) throw new AccessError("session-expired", 401, "No session");
          return result;
        });
        if (!response.ok || !response.body) {
          // El servidor dice que ya no (permiso, negocio, módulo): no se insiste.
          if (response.status === 403 || response.status === 404) return this.revoked();
          throw new Error(`events ${response.status}`);
        }
        attempt = 0;
        await this.read(response.body, controller);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof AccessError && error.kind === "session-expired") return this.finish("signed-out");
      }
      runInAction(() => {
        this.live = false;
      });
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, Math.min(15_000, 1_500 * attempt)));
    }
  }
  private async read(body: ReadableStream<Uint8Array>, controller: AbortController): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!controller.signal.aborted) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf("\n\n");
      while (index >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const type = /^event: (.*)$/m.exec(block)?.[1];
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (type) this.onEvent(type, data ? safeParse(data) : null);
        index = buffer.indexOf("\n\n");
      }
    }
  }
  private onEvent(type: string, data: unknown): void {
    runInAction(() => {
      this.live = true;
    });
    if (type === "ping" || type === "ready") return;
    if (type === "access.revoked") return this.revoked();
    if (type === "access.updated" || type === "config.updated") {
      // Cambió lo que la persona puede ver o cómo están configuradas las filas: se vuelve a leer y se avisa a las pantallas.
      void this.readScope().then(() => this.bump(), (error) => this.fail(error));
      void data;
      return;
    }
    this.bump();
  }
  private revoked(): void {
    this.stopLive();
    runInAction(() => {
      this.status = "denied";
      this.deniedReason = "revoked";
    });
  }
}
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
export const operationStore = new OperationStore();
