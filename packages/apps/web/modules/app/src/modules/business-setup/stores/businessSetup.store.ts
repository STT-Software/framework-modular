import { makeAutoObservable, runInAction } from "mobx";
import { AccessError, adminAccessStore } from "@/modules/business-access";
import type { CategoryId, ModuleId } from "@/modules/businesses";
import { optimizeImage } from "@/utils";
import { businessSetupApi, SetupError } from "../api/businessSetupApi";
import { cloneSchedule, hoursProblems, problemsFromFields, workday, type HoursProblem } from "../schedule";
import { SETUP_STEPS, WEEK_DAYS, type ProfileForm, type SetupState, type SetupStep, type WeekSchedule } from "../types";

export type SetupStatus = "idle" | "loading" | "ready" | "unavailable" | "signed-out" | "error";
export type HoursScope = "business" | ModuleId;
type FormField = keyof ProfileForm;

/** Limit of the service for the uploaded file (after shrinking). */
const LOGO_MAX_BYTES = 1_048_576;
/** The picked file is shrunk in the browser first, so a bigger original is accepted. */
const LOGO_MAX_SOURCE_BYTES = 10 * 1_048_576;
const EMPTY_FORM: ProfileForm = { name: "", phone: "", supportEmail: "", address: "", legalName: "", taxId: "", website: "", description: "" };
const LOGO_MAX_SIDE = 256;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_HINT = "Selecciona una imagen PNG, JPG o WebP de hasta 10 MB.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function setupErrorMessage(error: unknown): string {
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
        return error.status === 413 ? "El archivo es demasiado grande." : "Revisa los datos indicados.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}

const blank = (value: string | null | undefined) => value ?? "";

function formFrom(state: SetupState): ProfileForm {
  const p = state.profile;
  return {
    name: p.name,
    phone: blank(p.phone),
    supportEmail: blank(p.supportEmail),
    address: blank(p.address),
    legalName: blank(p.legalName),
    taxId: blank(p.taxId),
    website: blank(p.website),
    description: blank(p.description),
  };
}

/**
 * Reduce el logo a un máximo de 256×256 (manteniendo la proporción) antes de subirlo y lo exporta a WebP (PNG si el
 * navegador no sabe codificar WebP). Un SVG no se toca. Si algo falla, o el resultado no es más pequeño, se sube el original.
 */
async function shrinkLogo(file: File): Promise<File> {
  return optimizeImage(file, { maxSide: LOGO_MAX_SIDE, quality: 0.85 });
}

/**
 * El estado de la configuración inicial de UN negocio. El servidor decide todo lo importante (quién puede entrar, qué
 * módulos tiene, qué horarios son válidos); aquí solo viven los borradores de lo que la persona está escribiendo y lo
 * último que el servidor guardó (`state`). Cada paso se guarda en el servidor al avanzar, así que cerrar sesión no pierde
 * nada: al volver, `load` recupera todo.
 */
class BusinessSetupStore {
  status: SetupStatus = "idle";
  businessId: string | null = null;
  state: SetupState | null = null;
  /** Mensaje de la última acción que falló, para mostrarlo junto a ella. */
  error: string | null = null;
  saving = false;
  announcement = "";
  logoUrl: string | null = null;
  logoError: string | null = null;

  form: ProfileForm = { ...EMPTY_FORM };
  formErrors: Partial<Record<FormField, string>> = {};
  private formDirty = false;

  categoryDraft: CategoryId | null = null;
  categoryOther = "";
  /** El perfil de atención de Turnos que se está eligiendo (solo para un negocio con Turnos). */
  turnosProfileDraft: string | null = null;
  categoryError = "";
  private categoryDirty = false;

  baseDraft: WeekSchedule | null = null;
  moduleDrafts: Record<string, { inherit: boolean; own: WeekSchedule }> = {};
  hoursScope: HoursScope = "business";
  hoursErrors: Array<HoursProblem & { scope: HoursScope }> = [];
  private baseDirty = false;
  private dirtyModules = new Set<string>();

  private logoStamp = "";

  constructor() {
    makeAutoObservable<BusinessSetupStore, "formDirty" | "categoryDirty" | "baseDirty" | "dirtyModules" | "logoStamp">(this, {
      formDirty: false,
      categoryDirty: false,
      baseDirty: false,
      dirtyModules: false,
      logoStamp: false,
    });
  }

  // ── Carga ────────────────────────────────────────────────────────────────────────────────────────────────

  /** Abre (o recupera) la configuración de un negocio. Sin sesión vigente no pregunta nada: avisa para ir al acceso. */
  async load(businessId: string): Promise<void> {
    this.status = "loading";
    this.businessId = businessId;
    this.error = null;
    try {
      if (!(await adminAccessStore.ensureSession())) {
        runInAction(() => (this.status = "signed-out"));
        return;
      }
      const state = await adminAccessStore.withToken((token) => businessSetupApi.get(token, businessId));
      runInAction(() => {
        this.hydrateAll(state);
        this.status = "ready";
      });
      await this.refreshLogo();
    } catch (error) {
      runInAction(() => this.failLoad(error));
    }
  }

  private failLoad(error: unknown): void {
    if (error instanceof AccessError && error.kind === "session-expired") this.status = "signed-out";
    else if (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden")) this.status = "unavailable";
    else {
      this.status = "error";
      this.error = setupErrorMessage(error);
    }
  }

  reset(): void {
    this.dropLogoUrl();
    this.status = "idle";
    this.businessId = null;
    this.state = null;
    this.error = null;
    this.hoursErrors = [];
    this.hoursScope = "business";
  }

  /** Los borradores vuelven a ser exactamente lo que guardó el servidor. */
  private hydrateAll(state: SetupState): void {
    this.state = state;
    this.hydrateForm(state);
    this.hydrateCategory(state);
    this.hydrateSchedules(state);
    if (this.hoursScope !== "business" && !state.modules.some((module) => module.id === this.hoursScope)) this.hoursScope = "business";
  }

  private hydrateForm(state: SetupState): void {
    this.form = formFrom(state);
    this.formErrors = {};
    this.formDirty = false;
  }

  private hydrateCategory(state: SetupState): void {
    this.categoryDraft = state.category.id;
    this.categoryOther = blank(state.category.other);
    this.turnosProfileDraft = state.turnos?.profile ?? null;
    this.categoryError = "";
    this.categoryDirty = false;
  }

  private hydrateSchedules(state: SetupState): void {
    this.baseDraft = cloneSchedule(state.schedule.base.days);
    this.moduleDrafts = Object.fromEntries(
      state.modules.map((module) => {
        const entry = state.schedule.modules[module.id];
        return [module.id, { inherit: entry?.inherit ?? true, own: cloneSchedule(entry?.ownDays ?? state.schedule.base.days) }];
      }),
    );
    this.baseDirty = false;
    this.dirtyModules = new Set();
    this.hoursErrors = [];
  }

  // ── Datos del negocio ────────────────────────────────────────────────────────────────────────────────────

  setField(field: FormField, value: string): void {
    this.form[field] = value;
    this.formDirty = true;
    if (this.formErrors[field]) delete this.formErrors[field];
    if (this.state) this.announce("");
  }

  /** Las mismas reglas que el formulario de la referencia; el servidor vuelve a validar todo. */
  validateForm(): boolean {
    const f = this.form;
    const errors: Partial<Record<FormField, string>> = {};
    if (f.name.trim().length < 2) errors.name = "Escribe un nombre de al menos 2 caracteres.";
    if (f.phone.trim() && f.phone.replace(/\D/g, "").length < 7) errors.phone = "Escribe un teléfono de contacto válido.";
    else if (f.phone.trim() && !/^\+?[0-9]{7,15}$/.test(f.phone.replace(/[\s().-]/g, ""))) errors.phone = "Escribe un teléfono de contacto válido.";
    if (f.supportEmail.trim() && !EMAIL.test(f.supportEmail.trim())) errors.supportEmail = "Escribe un correo electrónico válido.";
    if (f.website.trim() && !/^https?:\/\/\S+\.\S+/i.test(f.website.trim())) errors.website = "Escribe una dirección que comience con https:// o http://.";
    if (f.taxId.trim() && !/^[A-Za-z0-9][A-Za-z0-9.-]{3,19}$/.test(f.taxId.replace(/\s+/g, ""))) {
      errors.taxId = "Revisa el NIT o ID fiscal: de 4 a 20 caracteres entre letras, números, puntos o guiones.";
    }
    this.formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  get firstFormError(): FormField | null {
    return (Object.keys(this.formErrors)[0] as FormField | undefined) ?? null;
  }

  private async saveProfile(): Promise<boolean> {
    if (!this.validateForm()) return false;
    const f = this.form;
    const orNull = (value: string) => (value.trim() === "" ? null : value.trim());
    return this.write(
      (token, id) =>
        businessSetupApi.saveProfile(token, id, {
          name: f.name.trim(),
          legalName: orNull(f.legalName),
          taxId: orNull(f.taxId),
          phone: orNull(f.phone),
          supportEmail: orNull(f.supportEmail),
          address: orNull(f.address),
          website: orNull(f.website),
          description: orNull(f.description),
        }),
      (state) => this.hydrateForm(state),
      (error) => {
        for (const path of Object.keys(error.fields)) {
          if (path in EMPTY_FORM) this.formErrors[path as FormField] = "Revisa este campo.";
        }
      },
    );
  }

  // ── Logo ─────────────────────────────────────────────────────────────────────────────────────────────────

  async chooseLogo(file: File): Promise<void> {
    this.logoError = null;
    if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_SOURCE_BYTES) {
      this.logoError = LOGO_HINT;
      return;
    }
    const businessId = this.businessId;
    const upload = await shrinkLogo(file);
    if (this.businessId !== businessId) return;
    if (upload.size > LOGO_MAX_BYTES) {
      runInAction(() => (this.logoError = LOGO_HINT));
      return;
    }
    const ok = await this.write(
      (token, id) => businessSetupApi.uploadLogo(token, id, upload),
      undefined,
      (error) => {
        this.logoError = error.code === "invalid-logo" || error.status === 413 ? LOGO_HINT : null;
      },
    );
    // Si la página se desmontó (reset) o cambió de negocio mientras se subía, no se crea una URL que nadie revocaría.
    if (!ok || this.businessId !== businessId) return;
    // Ya tenemos los bytes subidos: se muestran tal cual, sin volver a descargarlos.
    const logo = this.state?.logo;
    if (!logo) return;
    runInAction(() => {
      this.dropLogoUrl();
      this.logoUrl = URL.createObjectURL(upload);
      this.logoStamp = `${logo.updatedAt}:${logo.sizeBytes}`;
    });
  }

  async removeLogo(): Promise<void> {
    this.logoError = null;
    if (await this.write((token, id) => businessSetupApi.removeLogo(token, id))) await this.refreshLogo();
  }

  /** La imagen necesita el token: se descarga y se muestra con un `blob:` URL (solo si cambió). */
  private async refreshLogo(): Promise<void> {
    const logo = this.state?.logo;
    const id = this.businessId;
    if (!logo || !id) {
      runInAction(() => this.dropLogoUrl());
      return;
    }
    const stamp = `${logo.updatedAt}:${logo.sizeBytes}`;
    if (stamp === this.logoStamp && this.logoUrl) return;
    try {
      const blob = await adminAccessStore.withToken((token) => businessSetupApi.downloadLogo(token, id));
      runInAction(() => {
        this.dropLogoUrl();
        this.logoUrl = URL.createObjectURL(blob);
        this.logoStamp = stamp;
      });
    } catch {
      // Sin la imagen la página muestra las iniciales: no es un error que deba frenar la configuración.
      runInAction(() => this.dropLogoUrl());
    }
  }

  private dropLogoUrl(): void {
    if (this.logoUrl) URL.revokeObjectURL(this.logoUrl);
    this.logoUrl = null;
    this.logoStamp = "";
  }

  // ── Horarios ─────────────────────────────────────────────────────────────────────────────────────────────

  /** El horario que se está editando o mostrando en la pestaña actual. */
  get scopeSchedule(): WeekSchedule | null {
    if (this.hoursScope === "business") return this.baseDraft;
    return this.moduleDrafts[this.hoursScope]?.own ?? null;
  }

  get scopeInherits(): boolean {
    return this.hoursScope !== "business" && (this.moduleDrafts[this.hoursScope]?.inherit ?? true);
  }

  /** El horario que de verdad tendrá un módulo: el del negocio mientras hereda. */
  effectiveSchedule(scope: HoursScope): WeekSchedule | null {
    if (scope === "business") return this.baseDraft;
    const draft = this.moduleDrafts[scope];
    return draft?.inherit === false ? draft.own : this.baseDraft;
  }

  setHoursScope(scope: HoursScope): void {
    this.hoursScope = scope;
  }

  /** Cualquier cambio de un horario: lo marca por guardar y quita los avisos de ese día. */
  touchSchedule(): void {
    if (this.hoursScope === "business") this.baseDirty = true;
    else this.dirtyModules.add(this.hoursScope);
    this.hoursErrors = this.hoursErrors.filter((problem) => problem.scope !== this.hoursScope);
  }

  setInherit(inherit: boolean): void {
    if (this.hoursScope === "business") return;
    const draft = this.moduleDrafts[this.hoursScope];
    if (!draft) return;
    draft.inherit = inherit;
    // Al dejar de heredar, el horario propio parte de una copia del del negocio, como en la referencia.
    if (!inherit && !this.state?.schedule.modules[this.hoursScope]?.ownDays && !this.dirtyModules.has(this.hoursScope)) {
      draft.own = cloneSchedule(this.baseDraft ?? draft.own);
    }
    this.touchSchedule();
  }

  toggleDay(day: (typeof WEEK_DAYS)[number][0], open: boolean): void {
    const schedule = this.scopeSchedule;
    if (!schedule) return;
    schedule[day].open = open;
    if (open && schedule[day].ranges.length === 0) schedule[day].ranges.push({ start: "08:00", end: "18:00" });
    this.touchSchedule();
  }

  addRange(day: (typeof WEEK_DAYS)[number][0]): void {
    this.scopeSchedule?.[day].ranges.push({ start: "", end: "" });
    this.touchSchedule();
  }

  removeRange(day: (typeof WEEK_DAYS)[number][0], index: number): void {
    const schedule = this.scopeSchedule;
    if (!schedule) return;
    schedule[day].ranges.splice(index, 1);
    if (schedule[day].ranges.length === 0) schedule[day].open = false;
    this.touchSchedule();
  }

  setTime(day: (typeof WEEK_DAYS)[number][0], index: number, edge: "start" | "end", value: string): void {
    const range = this.scopeSchedule?.[day].ranges[index];
    if (!range) return;
    range[edge] = value;
    this.touchSchedule();
  }

  copyDayToOpenDays(day: (typeof WEEK_DAYS)[number][0]): void {
    const schedule = this.scopeSchedule;
    if (!schedule) return;
    for (const [other] of WEEK_DAYS) if (schedule[other].open) schedule[other].ranges = structuredClone(schedule[day].ranges);
    this.touchSchedule();
  }

  applyShortcut(kind: "weekdays" | "everyday" | "weekend"): void {
    const schedule = this.scopeSchedule;
    if (!schedule) return;
    if (kind === "weekend") {
      schedule.sat.open = false;
      schedule.sun.open = false;
    } else {
      for (const [day] of WEEK_DAYS) {
        if (kind === "weekdays" && (day === "sat" || day === "sun")) continue;
        schedule[day] = workday();
      }
    }
    this.touchSchedule();
  }

  /** Los horarios que hay que revisar: el del negocio y el de cada módulo que no hereda. */
  private validateHours(): boolean {
    const problems: Array<HoursProblem & { scope: HoursScope }> = [];
    if (this.baseDraft) for (const problem of hoursProblems(this.baseDraft)) problems.push({ ...problem, scope: "business" });
    for (const [id, draft] of Object.entries(this.moduleDrafts)) {
      if (!draft.inherit) for (const problem of hoursProblems(draft.own)) problems.push({ ...problem, scope: id as ModuleId });
    }
    this.hoursErrors = problems;
    if (problems.length > 0) this.hoursScope = problems[0].scope;
    return problems.length === 0;
  }

  private async saveSchedules(): Promise<boolean> {
    if (!this.validateHours()) return false;
    const showServerProblems = (error: SetupError, scope: HoursScope) => {
      this.hoursErrors = problemsFromFields(error.fields).map((problem) => ({ ...problem, scope }));
      this.hoursScope = scope;
    };
    if (this.baseDirty && this.baseDraft) {
      const schedule = this.baseDraft;
      const ok = await this.write(
        (token, id) => businessSetupApi.saveSchedule(token, id, schedule),
        (state) => {
          this.state = state;
          this.baseDirty = false;
        },
        (error) => showServerProblems(error, "business"),
      );
      if (!ok) return false;
    }
    for (const id of [...this.dirtyModules]) {
      const draft = this.moduleDrafts[id];
      if (!draft) continue;
      const body = draft.inherit ? { inherit: true } : { inherit: false, schedule: draft.own };
      const ok = await this.write(
        (token, businessId) => businessSetupApi.saveModuleSchedule(token, businessId, id as ModuleId, body),
        (state) => {
          this.state = state;
          this.dirtyModules.delete(id);
        },
        (error) => showServerProblems(error, id as ModuleId),
      );
      if (!ok) return false;
    }
    return true;
  }

  // ── Tipo de negocio ──────────────────────────────────────────────────────────────────────────────────────

  chooseCategory(category: CategoryId): void {
    this.categoryDraft = category;
    this.categoryError = "";
    this.categoryDirty = true;
  }

  chooseTurnosProfile(profile: string): void {
    this.turnosProfileDraft = profile;
    this.categoryDirty = true;
  }

  setCategoryOther(value: string): void {
    this.categoryOther = value;
    this.categoryError = "";
    this.categoryDirty = true;
  }

  validateCategory(): boolean {
    if (!this.categoryDraft) this.categoryError = "Selecciona el tipo de negocio.";
    else if (this.categoryDraft === "other" && this.categoryOther.trim().length < 2) this.categoryError = "Escribe el tipo de negocio personalizado.";
    else this.categoryError = "";
    return this.categoryError === "";
  }

  private async saveCategory(): Promise<boolean> {
    if (!this.validateCategory() || !this.categoryDraft) return false;
    const category = this.categoryDraft;
    const other = category === "other" ? this.categoryOther.trim() : null;
    // El perfil de Turnos solo se envía si la persona lo cambió: elegirlo es de Turnos, que no pierde lo que ya configuró.
    const turnos = this.state?.turnos;
    const profile = turnos && this.turnosProfileDraft && this.turnosProfileDraft !== turnos.profile ? this.turnosProfileDraft : null;
    return this.write(
      (token, id) => businessSetupApi.saveCategory(token, id, category, other, profile),
      (state) => this.hydrateCategory(state),
      (error) => {
        if (error.fields.categoryOther) this.categoryError = "Escribe el tipo de negocio personalizado.";
      },
    );
  }

  // ── Pasos y guardado ─────────────────────────────────────────────────────────────────────────────────────

  private isDirty(step: SetupStep): boolean {
    if (step === "data") return this.formDirty;
    if (step === "category") return this.categoryDirty;
    if (step === "schedule") return this.baseDirty || this.dirtyModules.size > 0;
    return false;
  }

  private async saveStep(step: SetupStep): Promise<boolean> {
    if (step === "data") return this.saveProfile();
    if (step === "schedule") return this.saveSchedules();
    if (step === "category") return this.saveCategory();
    return true;
  }

  /**
   * Antes de pasar de `from` a `to`. Hacia adelante se guarda, en orden, cada paso anterior al destino que tenga cambios: si
   * uno no es válido, devuelve ese paso para llevar a la persona a corregirlo. Hacia atrás solo se guarda el paso actual si
   * está completo (si no, el borrador sigue en pantalla). Cada paso guardado es un avance que se recupera al volver a entrar.
   */
  async leaveStep(from: SetupStep | "modules", to: SetupStep | "modules"): Promise<{ ok: true } | { ok: false; fix: SetupStep }> {
    const order = (step: SetupStep | "modules") => (step === "modules" ? -1 : SETUP_STEPS.indexOf(step));
    if (order(to) <= order(from)) {
      if (from !== "modules" && this.isDirty(from)) await this.saveStep(from);
      return { ok: true };
    }
    for (const step of SETUP_STEPS.slice(0, Math.max(order(to), 0))) {
      if (this.isDirty(step) && !(await this.saveStep(step))) return { ok: false, fix: step };
    }
    return { ok: true };
  }

  /** Recuerda en el servidor el paso en el que está la persona (para continuar después). No frena nada si falla. */
  async rememberStep(step: SetupStep): Promise<void> {
    const id = this.businessId;
    if (!id || this.state?.progress.currentStep === step) return;
    try {
      const state = await adminAccessStore.withToken((token) => businessSetupApi.saveProgress(token, id, step));
      runInAction(() => {
        if (this.state) this.state.progress = state.progress;
      });
    } catch (error) {
      if (error instanceof AccessError && error.kind === "session-expired") runInAction(() => (this.status = "signed-out"));
    }
  }

  /** "Guardar configuración base": guarda lo pendiente y marca la base como preparada. Devuelve el paso a corregir si algo no es válido. */
  async complete(): Promise<{ ok: true } | { ok: false; fix: SetupStep | null }> {
    for (const step of ["data", "schedule", "category"] as const) {
      if (this.isDirty(step) && !(await this.saveStep(step))) return { ok: false, fix: step };
    }
    const done = await this.write(
      (token, id) => businessSetupApi.complete(token, id),
      (state) => this.hydrateAll(state),
      (error) => {
        if (error.code === "setup-incomplete") this.error = "Todavía hay datos por revisar antes de guardar la base. Vuelve a los pasos anteriores.";
      },
    );
    return done ? { ok: true } : { ok: false, fix: null };
  }

  // ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Hace una escritura con el token del administrador, guarda lo que devuelve el servidor (el estado completo) y, si falla,
   * muestra el motivo. Los borradores de los demás pasos no se tocan: solo `onSaved` decide qué borrador se rehace.
   */
  private async write(
    call: (token: string, businessId: string) => Promise<SetupState>,
    onSaved?: (state: SetupState) => void,
    onInvalid?: (error: SetupError) => void,
  ): Promise<boolean> {
    const id = this.businessId;
    if (!id) return false;
    this.saving = true;
    this.error = null;
    try {
      const state = await adminAccessStore.withToken((token) => call(token, id));
      runInAction(() => {
        this.state = state;
        onSaved?.(state);
      });
      return true;
    } catch (error) {
      runInAction(() => {
        if (error instanceof AccessError && error.kind === "session-expired") this.status = "signed-out";
        else if (error instanceof SetupError && error.kind === "validation") {
          this.error = error.code === "setup-incomplete" ? null : "Revisa los datos indicados.";
          onInvalid?.(error);
        } else if (error instanceof AccessError && (error.kind === "not-found" || error.kind === "forbidden")) this.status = "unavailable";
        else this.error = setupErrorMessage(error);
      });
      return false;
    } finally {
      runInAction(() => (this.saving = false));
    }
  }

  announce(message: string): void {
    this.announcement = message;
  }
}

export const businessSetupStore = new BusinessSetupStore();
