import { makeAutoObservable, reaction, runInAction } from "mobx";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { onboardingApi, OnboardingError, type Profile } from "../api/onboardingApi";
import type { SourceId } from "../sources";

type Status = "idle" | "loading" | "ready" | "error";

/** Lo que el store necesita del servicio (en las pruebas se pasa uno falso). */
export type ProfileApi = Pick<typeof onboardingApi, "getProfile" | "savePhone" | "saveSources" | "markIntroSeen">;

export interface EnsureLoadedOptions {
  /**
   * Antigüedad máxima (ms) del perfil en memoria para usarlo sin pedirlo otra vez. `0` obliga a consultar el servicio
   * (si ya hay una consulta en vuelo, se reutiliza). Por defecto, 30 s: entre pasos no se repite el GET.
   */
  maxAgeMs?: number;
}

/** Antigüedad por defecto del perfil en memoria: lo bastante para pasar entre pantallas sin volver a pedirlo. */
export const DEFAULT_MAX_AGE_MS = 30_000;

function asOnboardingError(error: unknown): OnboardingError {
  return error instanceof OnboardingError ? error : new OnboardingError("server", null, "Unexpected error");
}

/**
 * Perfil del onboarding de la persona con sesión (teléfono y dónde nos conoció), en memoria y compartido por todas las
 * pantallas del flujo, así no se pide en cada paso ni aparece «Cargando…» entre ellos.
 *
 * - Es siempre de una cuenta (`accountId`): si cambia la sesión se borra (`reset`) y nunca se ve el de otra cuenta.
 * - `requestId` descarta respuestas viejas: una consulta que vuelve después de un guardado (o de cambiar de cuenta)
 *   no pisa lo más reciente.
 * - Si hay un perfil válido y una revalidación en segundo plano falla, se sigue mostrando ese perfil (`status` no cambia).
 */
export class OnboardingProfileStore {
  profile: Profile | null = null;
  /** Cuenta dueña de `profile`. */
  accountId: string | null = null;
  /** Momento (ms) en que se obtuvo `profile` del servicio. */
  loadedAt: number | null = null;
  status: Status = "idle";
  loadError: OnboardingError | null = null;
  /**
   * True solo cuando, en esta pestaña, el perfil pasó de incompleto a completo (al guardar el paso 2). Ready lo usa
   * para saber que la persona viene de terminar; se apaga con `acknowledgeCompletion` o `reset`.
   */
  justCompleted = false;

  private requestId = 0;
  private inFlight: { accountId: string | null; promise: Promise<Profile> } | null = null;

  constructor(
    private readonly api: ProfileApi,
    private readonly currentAccountId: () => string | null,
    private readonly now: () => number = () => Date.now(),
  ) {
    makeAutoObservable<this, "requestId" | "inFlight" | "api" | "currentAccountId" | "now">(this, {
      requestId: false,
      inFlight: false,
      api: false,
      currentAccountId: false,
      now: false,
    });
  }

  /** El perfil en memoria, solo si es de la cuenta con sesión. */
  get currentProfile(): Profile | null {
    return this.profile && this.accountId === this.currentAccountId() ? this.profile : null;
  }

  /**
   * Devuelve el perfil de la cuenta con sesión: el de memoria si es lo bastante reciente; si no, lo pide (una sola
   * petición aunque lo pidan varias pantallas a la vez).
   *
   * Mientras revalida un perfil de la misma cuenta no lo borra ni cambia `status`. Si la consulta falla y hay un perfil
   * válido, se resuelve con ese perfil; si no lo hay, `status` pasa a `error` y la promesa se rechaza con un
   * `OnboardingError`.
   */
  ensureLoaded({ maxAgeMs = DEFAULT_MAX_AGE_MS }: EnsureLoadedOptions = {}): Promise<Profile> {
    const account = this.currentAccountId();
    // Lo que haya en memoria es de otra cuenta: fuera, antes de nada.
    if (this.accountId !== null && this.accountId !== account) this.reset();

    const cached = this.currentProfile;
    if (cached && this.loadedAt !== null && this.now() - this.loadedAt < maxAgeMs) return Promise.resolve(cached);
    if (this.inFlight && this.inFlight.accountId === account) return this.inFlight.promise;

    const id = ++this.requestId;
    if (!cached) {
      this.accountId = account;
      this.status = "loading";
      this.loadError = null;
    }
    const promise = this.fetchProfile(id, account);
    this.inFlight = { accountId: account, promise };
    const clear = () => {
      if (this.inFlight?.promise === promise) this.inFlight = null;
    };
    promise.then(clear, clear);
    return promise;
  }

  private async fetchProfile(id: number, account: string | null): Promise<Profile> {
    try {
      const profile = await this.api.getProfile();
      if (id !== this.requestId) return this.afterStaleResponse(account);
      runInAction(() => this.apply(profile, account));
      return profile;
    } catch (error) {
      if (id !== this.requestId) return this.afterStaleResponse(account);
      const failure = asOnboardingError(error);
      const fallback = this.currentProfile;
      // Revalidación en segundo plano que falla con un perfil válido: se sigue con él, sin cambiar `status`.
      if (fallback && failure.kind !== "unauthorized") return fallback;
      runInAction(() => {
        this.loadError = failure;
        this.status = "error";
      });
      throw failure;
    }
  }

  /**
   * La respuesta llegó tarde (hubo un guardado, un `invalidate` o un cambio de cuenta mientras tanto): se ignora. A
   * quien la esperaba se le da lo más reciente de la misma cuenta (o lo que esté en vuelo); si la sesión ya es de otra
   * cuenta, se rechaza: esa pantalla pertenece a la sesión anterior.
   */
  private afterStaleResponse(account: string | null): Promise<Profile> {
    if (account !== this.currentAccountId()) {
      return Promise.reject(new OnboardingError("unauthorized", null, "The session changed"));
    }
    const latest = this.currentProfile;
    if (latest) return Promise.resolve(latest);
    return this.ensureLoaded({ maxAgeMs: Number.POSITIVE_INFINITY });
  }

  /** Guarda un perfil recién llegado del servicio como el actual de la cuenta. */
  private apply(profile: Profile, account: string | null): void {
    this.profile = profile;
    this.accountId = account;
    this.loadedAt = this.now();
    this.status = "ready";
    this.loadError = null;
  }

  /** Un guardado es más reciente que cualquier consulta en vuelo: la invalida y fija el perfil. */
  private applyWrite(profile: Profile, account: string | null): void {
    this.requestId++;
    this.inFlight = null;
    this.apply(profile, account);
  }

  /** Paso 1. Lanza `OnboardingError` (por ejemplo `code: "phone-in-use"` si otra cuenta ya usa el número). */
  async savePhone(phone: string): Promise<void> {
    const account = this.currentAccountId();
    const profile = await this.api.savePhone(phone);
    if (account !== this.currentAccountId()) return;
    runInAction(() => this.applyWrite(profile, account));
  }

  /**
   * Avisa al servicio que la intro ya se mostró. Solo cambia `introSeen` del perfil en memoria (nunca pisa el
   * teléfono ni nada más: esta respuesta puede llegar después de la de `savePhone`). No se espera ni falla hacia
   * fuera: si no llega (sin red), la intro podría volver a verse una vez más, y eso no debe interrumpir a la persona.
   */
  async markIntroSeen(): Promise<void> {
    const account = this.currentAccountId();
    try {
      const profile = await this.api.markIntroSeen();
      runInAction(() => {
        if (account !== this.currentAccountId() || !this.profile || this.accountId !== account) return;
        if (profile.introSeen && !this.profile.introSeen) this.profile = { ...this.profile, introSeen: true };
      });
    } catch {
      /* Sin efecto visible: ver arriba. */
    }
  }

  /**
   * Paso 2. `sources` vacío es «Omitir». Completa el perfil; si antes estaba incompleto activa `justCompleted`.
   * Lanza `OnboardingError` (`code: "phone-required"` si el servicio no tiene el teléfono).
   */
  async saveSources(sources: SourceId[], sourceOther?: string | null): Promise<void> {
    const account = this.currentAccountId();
    const profile = await this.api.saveSources(sources, sourceOther);
    if (account !== this.currentAccountId()) return;
    runInAction(() => {
      const wasCompleted = this.currentProfile?.completed === true;
      this.applyWrite(profile, account);
      if (!wasCompleted && profile.completed) this.justCompleted = true;
    });
  }

  /** Ready ya usó `justCompleted`: no se vuelve a tratar como recién completado. */
  acknowledgeCompletion(): void {
    this.justCompleted = false;
  }

  /**
   * Olvida el perfil en memoria (por ejemplo, si el servicio dice que falta el teléfono y la copia local lo tiene):
   * la próxima pantalla lo vuelve a pedir.
   */
  invalidate(): void {
    this.requestId++;
    this.inFlight = null;
    this.profile = null;
    this.loadedAt = null;
    this.status = "idle";
    this.loadError = null;
  }

  /** Borra todo (cambio o cierre de sesión): nada del perfil anterior queda a la vista. */
  reset(): void {
    this.invalidate();
    this.accountId = null;
    this.justCompleted = false;
  }
}

export const onboardingProfileStore = new OnboardingProfileStore(
  onboardingApi,
  () => superAdminSessionStore.superAdmin?.id ?? null,
);

// Otra persona puede iniciar sesión en esta pestaña: nada del perfil anterior puede quedar en memoria.
reaction(
  () => superAdminSessionStore.superAdmin?.id ?? null,
  () => onboardingProfileStore.reset(),
);
