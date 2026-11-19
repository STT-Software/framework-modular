import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access";
import { turnosApi, TurnosError } from "../api/turnosApi";
import { firstIssue, turnosErrorMessage } from "../messages";
import { TURNOS_STEPS, type OperatorForm, type QueueForm, type RulesForm, type TurnosProfileId, type TurnosState, type TurnosStep } from "../types";
import { operatorBody, operatorProblem, queueBody, queueProblem, rulesBody, rulesProblem } from "../validation";

export type TurnosStatus = "idle" | "loading" | "ready" | "blocked" | "unavailable" | "signed-out" | "error";

/** El resultado de una escritura. Si falla por datos, `message` es lo que se le muestra a la persona junto al formulario. */
export type WriteResult = { ok: true; created?: string } | { ok: false; message: string; fields: Record<string, string[]>; code: string | null };

function formFromRules(state: TurnosState): RulesForm {
  const rules = state.rules;
  return {
    prefixMode: rules.prefixMode,
    fixedPrefix: rules.fixedPrefix ?? "T",
    dailyReset: rules.dailyReset,
    urgentMinutes: String(rules.urgentMinutes),
    busyLimit: String(rules.busyLimit),
    fullLimit: String(rules.fullLimit),
  };
}

/** A qué paso lleva un problema que el servidor encontró al guardar como preparada. */
export function stepOfIssue(path: string): TurnosStep {
  if (path.startsWith("rules")) return "rules";
  if (path.startsWith("operators")) return "operators";
  return "queues";
}

/**
 * La configuración de Turnos de UN negocio, para su administrador. El servidor decide todo lo importante (quién puede entrar, qué
 * valores son válidos, cómo se heredan las reglas, qué pasa con los operadores al eliminar una fila); aquí solo vive lo último que
 * guardó (`state`) y el borrador del formulario de reglas. Filas, operadores y perfil se guardan en el servidor al confirmar su
 * diálogo, y las reglas al avanzar: cerrar sesión no pierde nada, al volver `load` recupera todo.
 */
class TurnosStore {
  status: TurnosStatus = "idle";
  businessId: string | null = null;
  state: TurnosState | null = null;
  /** Un problema de la última acción que no es de datos (conexión, permisos), para mostrarlo en la página. */
  error: string | null = null;
  saving = false;
  announcement = "";

  rulesForm: RulesForm | null = null;
  rulesError = "";
  private rulesDirty = false;

  constructor() {
    makeAutoObservable<TurnosStore, "rulesDirty">(this, { rulesDirty: false });
  }

  // ── Carga ────────────────────────────────────────────────────────────────────────────────────────────────

  async load(businessId: string): Promise<void> {
    this.status = "loading";
    this.businessId = businessId;
    this.error = null;
    try {
      if (!(await adminAccessStore.ensureSession())) {
        runInAction(() => (this.status = "signed-out"));
        return;
      }
      const state = await adminAccessStore.withToken((token) => turnosApi.get(token, businessId));
      runInAction(() => {
        this.rulesDirty = false;
        this.applyState(state);
        this.status = "ready";
      });
    } catch (error) {
      runInAction(() => this.fail(error, true));
    }
  }

  reset(): void {
    this.status = "idle";
    this.businessId = null;
    this.state = null;
    this.error = null;
    this.rulesForm = null;
    this.rulesError = "";
    this.rulesDirty = false;
  }

  private applyState(state: TurnosState): void {
    this.state = state;
    if (!this.rulesDirty) this.rulesForm = formFromRules(state);
  }

  /** Cualquier fallo que no es de datos: sesión terminada, negocio que ya no es tuyo, módulo deshabilitado, conexión. */
  private fail(error: unknown, whileLoading: boolean): void {
    if (error instanceof AccessError && error.kind === "session-expired") this.status = "signed-out";
    else if (error instanceof TurnosError && error.code === "module-not-enabled") this.status = "blocked";
    else if (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden")) this.status = "unavailable";
    else if (whileLoading) {
      this.status = "error";
      this.error = turnosErrorMessage(error);
    } else this.error = turnosErrorMessage(error);
  }

  announce(message: string): void {
    this.announcement = message;
  }

  // ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────

  private async write(call: (token: string, businessId: string) => Promise<TurnosState>): Promise<WriteResult> {
    const id = this.businessId;
    if (!id) return { ok: false, message: "", fields: {}, code: null };
    this.saving = true;
    this.error = null;
    try {
      const state = await adminAccessStore.withToken((token) => call(token, id));
      runInAction(() => this.applyState(state));
      return { ok: true, created: state.created?.id };
    } catch (error) {
      if (error instanceof TurnosError && error.kind === "validation") {
        return { ok: false, message: firstIssue(error.fields) ?? turnosErrorMessage(error), fields: error.fields, code: error.code };
      }
      runInAction(() => this.fail(error, false));
      return { ok: false, message: turnosErrorMessage(error), fields: {}, code: error instanceof TurnosError ? error.code : null };
    } finally {
      runInAction(() => (this.saving = false));
    }
  }

  // ── Perfil ──

  changeProfile(profile: TurnosProfileId, addSuggestedQueues: boolean): Promise<WriteResult> {
    return this.write((token, id) => turnosApi.changeProfile(token, id, profile, addSuggestedQueues));
  }

  // ── Filas ────────────────────────────────────────────────────────────────────────────────────────────────

  async saveQueue(queueId: string | null, form: QueueForm): Promise<WriteResult> {
    const state = this.state;
    if (!state) return { ok: false, message: "", fields: {}, code: null };
    const problem = queueProblem(form, { rules: state.rules, queues: state.queues, selfId: queueId, limits: state.catalog.limits });
    if (problem) return { ok: false, message: problem, fields: {}, code: null };
    const body = queueBody(form);
    return this.write((token, id) => (queueId ? turnosApi.updateQueue(token, id, queueId, body) : turnosApi.createQueue(token, id, body)));
  }

  deleteQueue(queueId: string, reassignments: Array<{ operatorId: string; queueId: string }>): Promise<WriteResult> {
    return this.write((token, id) => turnosApi.deleteQueue(token, id, queueId, reassignments));
  }

  // ── Operadores ───────────────────────────────────────────────────────────────────────────────────────────

  async saveOperator(operatorId: string | null, form: OperatorForm): Promise<WriteResult> {
    const state = this.state;
    if (!state) return { ok: false, message: "", fields: {}, code: null };
    const problem = operatorProblem(form, { queues: state.queues, operators: state.operators, selfId: operatorId, limits: state.catalog.limits });
    if (problem) return { ok: false, message: problem, fields: {}, code: null };
    const body = operatorBody(form);
    return this.write((token, id) => (operatorId ? turnosApi.updateOperator(token, id, operatorId, body) : turnosApi.createOperator(token, id, body)));
  }

  deleteOperator(operatorId: string): Promise<WriteResult> {
    return this.write((token, id) => turnosApi.deleteOperator(token, id, operatorId));
  }

  // ── Reglas ───────────────────────────────────────────────────────────────────────────────────────────────

  setRulesField<K extends keyof RulesForm>(key: K, value: RulesForm[K]): void {
    if (!this.rulesForm || !this.state) return;
    this.rulesForm[key] = value;
    this.rulesDirty = true;
    this.rulesError = rulesProblem(this.rulesForm, this.state.queues, this.state.catalog.limits);
  }

  /** Guarda las reglas si cambiaron. False si no son válidas (el mensaje queda en `rulesError`). */
  async saveRulesIfNeeded(): Promise<boolean> {
    if (!this.rulesDirty || !this.rulesForm || !this.state) return true;
    const problem = rulesProblem(this.rulesForm, this.state.queues, this.state.catalog.limits);
    this.rulesError = problem;
    if (problem) return false;
    const result = await this.write((token, id) => turnosApi.saveRules(token, id, rulesBody(this.rulesForm!)));
    if (!result.ok) {
      runInAction(() => (this.rulesError = result.message));
      return false;
    }
    runInAction(() => {
      this.rulesDirty = false;
      this.rulesForm = this.state ? formFromRules(this.state) : this.rulesForm;
      this.rulesError = "";
    });
    return true;
  }

  // ── Pasos ────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Antes de pasar de `from` a `to`. Hacia adelante: sin ninguna fila no se sale de «Filas», y las reglas se validan y guardan al salir de
   * «Reglas»; si algo falla, devuelve el paso que hay que corregir. Hacia atrás se guardan las reglas solo si están completas.
   */
  async leaveStep(from: TurnosStep, to: TurnosStep): Promise<{ ok: true } | { ok: false; fix: TurnosStep }> {
    const order = (step: TurnosStep) => TURNOS_STEPS.indexOf(step);
    const state = this.state;
    if (!state) return { ok: true };
    if (order(to) > order(from)) {
      if (order(from) <= order("queues") && order(to) > order("queues") && state.queues.length === 0) return { ok: false, fix: "queues" };
      if (order(from) <= order("rules") && order(to) > order("rules") && !(await this.saveRulesIfNeeded())) return { ok: false, fix: "rules" };
      return { ok: true };
    }
    if (from === "rules" && this.rulesDirty && this.rulesForm && !rulesProblem(this.rulesForm, state.queues, state.catalog.limits)) await this.saveRulesIfNeeded();
    return { ok: true };
  }

  /** Recuerda en el servidor el paso en el que está la persona. No frena nada si falla, salvo que la sesión haya terminado. */
  async rememberStep(step: TurnosStep): Promise<void> {
    const id = this.businessId;
    if (!id || this.state?.progress.currentStep === step) return;
    try {
      const state = await adminAccessStore.withToken((token) => turnosApi.saveProgress(token, id, step));
      runInAction(() => {
        if (this.state) this.state.progress = state.progress;
      });
    } catch (error) {
      if (error instanceof AccessError && error.kind === "session-expired") runInAction(() => (this.status = "signed-out"));
    }
  }

  /** «Guardar configuración»: guarda las reglas pendientes y la marca como preparada. Si algo falta, dice a qué paso ir. */
  async complete(): Promise<{ ok: true } | { ok: false; fix: TurnosStep | null; message: string }> {
    if (!(await this.saveRulesIfNeeded())) return { ok: false, fix: "rules", message: this.rulesError };
    const result = await this.write((token, id) => turnosApi.complete(token, id));
    if (result.ok) return { ok: true };
    if (result.code === "turnos-incomplete") {
      const [path] = Object.keys(result.fields);
      const fix = path ? stepOfIssue(path) : null;
      const message = fix === "queues" ? "Crea al menos una fila para preparar el módulo de Turnos." : result.message;
      return { ok: false, fix, message };
    }
    return { ok: false, fix: null, message: result.message };
  }
}

export const turnosStore = new TurnosStore();
