import { makeAutoObservable, runInAction } from "mobx";
import { onboardingApi, OnboardingError, type Profile } from "../api/onboardingApi";
import type { SourceId } from "../sources";

type Status = "idle" | "loading" | "ready" | "error";

/**
 * Perfil del onboarding de la persona con sesión (teléfono y dónde nos conoció).
 * Vive en memoria: cada pantalla del onboarding lo recarga al abrirse, así nunca
 * se ve el perfil de otra cuenta si se cambia de usuario en la misma pestaña.
 */
class OnboardingProfileStore {
  profile: Profile | null = null;
  status: Status = "idle";
  loadError: OnboardingError | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Trae el perfil del servicio. Mientras carga no se muestra el anterior. */
  async load(): Promise<void> {
    this.status = "loading";
    this.profile = null;
    this.loadError = null;
    try {
      const profile = await onboardingApi.getProfile();
      runInAction(() => {
        this.profile = profile;
        this.status = "ready";
      });
    } catch (error) {
      runInAction(() => {
        this.loadError = error instanceof OnboardingError ? error : new OnboardingError("server", null, "Unexpected error");
        this.status = "error";
      });
    }
  }

  /** Paso 1. Lanza `OnboardingError` (por ejemplo `conflict` si otra cuenta ya usa el número). */
  async savePhone(phone: string): Promise<void> {
    const profile = await onboardingApi.savePhone(phone);
    runInAction(() => {
      this.profile = profile;
    });
  }

  /** Paso 2. Marca el perfil como completado. */
  async saveSources(sources: SourceId[]): Promise<void> {
    const profile = await onboardingApi.saveSources(sources);
    runInAction(() => {
      this.profile = profile;
    });
  }
}

export const onboardingProfileStore = new OnboardingProfileStore();
