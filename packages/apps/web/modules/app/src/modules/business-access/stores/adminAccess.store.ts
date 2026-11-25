import { makeAutoObservable, runInAction } from "mobx";
import {
  AccessError,
  businessAccessApi,
  type AccessGrant,
  type AdministeredBusiness,
  type CodeRules,
  type SessionGrant,
} from "../api/businessAccessApi";

/** The five screens of the access flow, plus the first look at the browser's session. */
export type AccessView = "loading" | "acceso" | "codigo" | "regreso" | "negocios" | "listo";

export function accessErrorMessage(error: unknown): string {
  if (error instanceof AccessError) {
    switch (error.kind) {
      case "rate-limited": {
        const seconds = error.retryAfterSeconds;
        if (!seconds) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
        return `Demasiados intentos. Espera ${seconds < 90 ? `${seconds} segundos` : `${Math.ceil(seconds / 60)} minutos`} e inténtalo de nuevo.`;
      }
      case "network":
      case "timeout":
        return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.";
      case "validation":
        return "Revisa los datos ingresados.";
      case "email-not-assigned":
        return "Este correo todavía no está asignado a ningún negocio. Primero el superadministrador debe invitarte, o un administrador debe agregarte como operador.";
      case "not-found":
        return "Este negocio ya no está disponible para ti.";
      case "forbidden":
        return "No tienes permiso para hacer esto.";
      default:
        return "Ocurrió un problema en el servicio. Inténtalo de nuevo en unos minutos.";
    }
  }
  return "Ocurrió un error inesperado.";
}

/**
 * The state of the business administrator's access page. The server decides everything that matters (who may enter,
 * which businesses, how long the session lasts); this only remembers what the page needs to show:
 *
 * - the access token lives only in memory, so reloading the page asks the server, by the HttpOnly cookie, whether
 *   there is still a session ("regreso") instead of keeping anything in the browser's storage;
 * - the accesses (a business in a role: administrator or operator) are exactly the ones the server returned after
 *   authenticating the person; the same email can hold several.
 */
class AdminAccessStore {
  view: AccessView = "loading";
  email = "";
  /** A message above the form (for example "your session ended"). */
  notice = "";
  /** An error from the last action, to show next to it. */
  error: string | null = null;
  busy = false;
  rules: CodeRules | null = null;
  /** When the current code was requested, to count the expiry and the wait before asking for another one. */
  codeRequestedAt = 0;
  remember = false;
  /** Everything the person may open, in any role. */
  accesses: AccessGrant[] = [];
  /** The access the person chose (or the only one they have). */
  access: AccessGrant | null = null;
  /** The businesses they ADMINISTER (the `admin` accesses). */
  businesses: AdministeredBusiness[] = [];
  /** The administered business behind the chosen access; null when the chosen access is an operator one. */
  business: AdministeredBusiness | null = null;
  private accessToken: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Looks at the browser's session:
   * - if the user already has a live token in memory (e.g. returning from configuration or operator view to switch space/role),
   *   refreshes their authorized accesses from the server so newly created operator assignments appear immediately and opens
   *   the space picker (`negocios`) directly when they hold more than one access;
   * - otherwise checks the HttpOnly cookie and offers to continue (`regreso`) or asks for the email (`acceso`).
   */
  async start(): Promise<void> {
    const hadActiveToken = this.accessToken !== null;
    if (hadActiveToken) {
      this.view = "loading";
      this.error = null;
      try {
        const grant = await businessAccessApi.refresh();
        runInAction(() => {
          this.accessToken = grant.accessToken;
          this.email = grant.admin.email;
          this.remember = grant.admin.remember;
          this.accesses = grant.accesses;
          this.businesses = grant.businesses;
          this.access = null;
          this.business = null;
          this.view = grant.accesses.length > 0 ? "negocios" : "regreso";
        });
        return;
      } catch {
        // Fallback to standard session check below if refresh failed.
      }
    }

    this.clearAccount();
    this.view = "loading";
    try {
      const session = await businessAccessApi.currentSession();
      runInAction(() => {
        this.email = session.email;
        this.remember = session.remember;
        this.view = "regreso";
      });
    } catch (error) {
      runInAction(() => {
        this.view = "acceso";
        if (!(error instanceof AccessError && error.kind === "session-expired")) this.error = accessErrorMessage(error);
      });
    }
  }

  async submitEmail(email: string): Promise<void> {
    await this.run(async () => {
      this.rules = await businessAccessApi.requestCode(email);
      runInAction(() => {
        this.email = email;
        this.codeRequestedAt = Date.now();
        this.notice = "";
        this.view = "codigo";
      });
    });
  }

  /** Asks for another code. The answer is the same whether or not a code was sent, so the page says so honestly. */
  async resend(): Promise<boolean> {
    return this.run(async () => {
      this.rules = await businessAccessApi.requestCode(this.email);
      runInAction(() => {
        this.codeRequestedAt = Date.now();
      });
    });
  }

  /** Returns true when the code was accepted; a wrong one throws the error to the caller, which counts the tries. */
  async verify(code: string, remember: boolean): Promise<void> {
    const grant = await businessAccessApi.verifyCode(this.email, code, remember);
    runInAction(() => this.applyGrant(grant));
  }

  /** "Continue with my session": a new token from the cookie, and the businesses authorized right now. */
  async continueWithSession(): Promise<void> {
    await this.run(async () => {
      try {
        this.applyGrant(await businessAccessApi.refresh());
      } catch (error) {
        if (error instanceof AccessError && error.kind === "session-expired") {
          runInAction(() => this.endSession("Tu sesión terminó. Verifica tu correo para continuar."));
          return;
        }
        throw error;
      }
    });
  }

  /** Ends the session on the server (and so on this device) and goes back to the email form. */
  async leave(notice: string): Promise<void> {
    await this.run(async () => {
      // If the server cannot be reached this throws and the page stays where it is, showing the error: it never
      // pretends to be signed out while the session is still alive.
      await businessAccessApi.signOut();
      runInAction(() => this.endSession(notice));
    });
  }

  /** From an access back to the list, when the person has more than one. */
  backToBusinesses(): void {
    this.business = null;
    this.access = null;
    this.error = null;
    this.view = "negocios";
  }

  backToEmail(): void {
    this.error = null;
    this.notice = "";
    this.view = "acceso";
  }

  /**
   * Opens one of the authorized accesses. An administrator access is confirmed with the server (it must still be the boss of an
   * active business); an operator one is confirmed by the server on the first request of its own page.
   */
  async openAccess(key: string): Promise<void> {
    const access = this.accesses.find((item) => item.key === key);
    if (!access) return;
    await this.run(async () => {
      if (access.role === "admin") {
        const business = await this.withToken((token) => businessAccessApi.business(token, access.businessId));
        runInAction(() => {
          this.business = business;
          this.access = access;
          this.view = "listo";
        });
      } else {
        runInAction(() => {
          this.business = null;
          this.access = access;
          this.view = "listo";
        });
      }
    });
  }

  private applyGrant(grant: SessionGrant): void {
    this.accessToken = grant.accessToken;
    this.email = grant.admin.email;
    this.remember = grant.admin.remember;
    this.accesses = grant.accesses;
    this.businesses = grant.businesses;
    this.error = null;
    this.notice = "";
    if (grant.accesses.length === 1) {
      const only = grant.accesses[0];
      this.access = only;
      this.business = only.role === "admin" ? (grant.businesses.find((item) => item.id === only.businessId) ?? null) : null;
      this.view = "listo";
    } else {
      this.access = null;
      this.business = null;
      this.view = "negocios";
    }
  }

  /**
   * For the pages of an administrator that come after signing in (the business setup): is there a usable session? Without a
   * token in memory (the page was reloaded) it asks the server, by the HttpOnly cookie, for a new one. False when the session
   * ended: the caller sends the person to the access page.
   */
  async ensureSession(): Promise<boolean> {
    if (this.accessToken) return true;
    try {
      this.applyGrant(await businessAccessApi.refresh());
      return true;
    } catch (error) {
      if (error instanceof AccessError && error.kind === "session-expired") return false;
      throw error;
    }
  }
  /** Runs a call with the access token; if it expired, renews it once from the session cookie and tries again. */
  async withToken<T>(call: (token: string) => Promise<T>): Promise<T> {
    if (!this.accessToken) throw new AccessError("session-expired", 401, "No session");
    try {
      return await call(this.accessToken);
    } catch (error) {
      if (!(error instanceof AccessError && error.kind === "session-expired")) throw error;
      const grant = await businessAccessApi.refresh();
      runInAction(() => {
        this.accessToken = grant.accessToken;
        this.accesses = grant.accesses;
        this.businesses = grant.businesses;
      });
      return call(grant.accessToken);
    }
  }

  private endSession(notice: string): void {
    this.clearAccount();
    this.notice = notice;
    this.view = "acceso";
  }

  private clearAccount(): void {
    this.accessToken = null;
    this.email = "";
    this.remember = false;
    this.accesses = [];
    this.access = null;
    this.businesses = [];
    this.business = null;
    this.rules = null;
    this.codeRequestedAt = 0;
    this.error = null;
    this.notice = "";
  }

  /** Runs an action showing "busy", and turns its failure into a message. Returns whether it worked. */
  private async run(action: () => Promise<void>): Promise<boolean> {
    this.busy = true;
    this.error = null;
    try {
      await action();
      return true;
    } catch (error) {
      runInAction(() => {
        if (error instanceof AccessError && error.kind === "session-expired") {
          this.endSession("Tu sesión terminó. Verifica tu correo para continuar.");
        } else {
          this.error = accessErrorMessage(error);
        }
      });
      return false;
    } finally {
      runInAction(() => {
        this.busy = false;
      });
    }
  }
}

export const adminAccessStore = new AdminAccessStore();
