import { makeAutoObservable } from "mobx";
import type { BossSessionResult } from "../api/businessAccessApi";

const STORAGE_KEY = "business-access:session";

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
 * Sesión del jefe de un negocio. Es DISTINTA de la del superadmin (otra clave de sessionStorage y otro store):
 * entrar como jefe nunca reemplaza ni da los permisos del superadmin, ni al revés.
 */
class BossSessionStore {
  session: BossSessionResult | null = null;

  constructor() {
    makeAutoObservable(this);
    this.restore();
  }

  get accessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  signIn(session: BossSessionResult): void {
    this.session = session;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* sessionStorage no disponible */
    }
  }

  signOut(): void {
    this.session = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sessionStorage no disponible */
    }
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<BossSessionResult>;
      if (typeof stored.accessToken === "string" && stored.business?.id && stored.boss?.email && !isTokenExpired(stored.accessToken)) {
        this.session = stored as BossSessionResult;
      } else {
        this.signOut();
      }
    } catch {
      this.signOut();
    }
  }
}

export const bossSessionStore = new BossSessionStore();
