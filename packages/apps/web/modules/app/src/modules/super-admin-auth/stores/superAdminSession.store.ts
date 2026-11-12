import { makeAutoObservable } from "mobx";
import type { LoginResult, SuperAdmin } from "../api/superAdminAuthApi";

const STORAGE_KEY = "super-admin-auth:session";

interface StoredSession {
  accessToken: string;
  superAdmin: SuperAdmin;
}

/** True si el JWT ya venció (o no se puede leer). Solo mira la fecha: el servidor es quien valida de verdad. */
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json) as { exp?: number };
    return typeof exp !== "number" || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Sesión del superadmin. Se guarda en sessionStorage: sobrevive a recargar la
 * pestaña y se borra al cerrarla. Los demás módulos que necesiten saber si hay un
 * superadmin autenticado pueden importarla desde la puerta pública del módulo.
 */
class SuperAdminSessionStore {
  accessToken: string | null = null;
  superAdmin: SuperAdmin | null = null;

  constructor() {
    makeAutoObservable(this);
    this.restore();
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  signIn(result: LoginResult): void {
    this.accessToken = result.accessToken;
    this.superAdmin = result.superAdmin;
    this.persist();
  }

  signOut(): void {
    this.accessToken = null;
    this.superAdmin = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sessionStorage no disponible */
    }
  }

  private persist(): void {
    if (!this.accessToken || !this.superAdmin) return;
    const stored: StoredSession = { accessToken: this.accessToken, superAdmin: this.superAdmin };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* sessionStorage no disponible */
    }
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<StoredSession>;
      if (typeof stored.accessToken === "string" && stored.superAdmin) {
        if (isTokenExpired(stored.accessToken)) {
          this.signOut();
          return;
        }
        this.accessToken = stored.accessToken;
        this.superAdmin = stored.superAdmin;
      }
    } catch {
      this.signOut();
    }
  }
}

export const superAdminSessionStore = new SuperAdminSessionStore();
