import { makeAutoObservable, reaction, runInAction } from "mobx";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { businessesApi } from "../api/businessesApi";
import { businessErrorMessage } from "../errors";
import type { Business, BusinessFilters } from "../types";

export const PAGE_SIZE = 12;
export const SWITCHER_PAGE_SIZE = 50;
const NO_FILTERS: BusinessFilters = { q: "", category: "", status: "" };

export type LoadState = "idle" | "loading" | "ready" | "error";

/** Minimal API contract required by BusinessesStore (injectable in unit tests). */
export type BusinessesListApi = Pick<typeof businessesApi, "list">;

/**
 * The businesses of the signed-in super admin.
 * - `items` / `total` / `page` / `filters`: current filtered/paginated directory view.
 * - `switcherItems` / `switcherTotal`: dedicated unfiltered slice for the top-bar business switcher.
 * - `count`: total number of businesses without filters (shown in the sidebar badge).
 */
export class BusinessesStore {
  items: Business[] = [];
  /** How many businesses match the current filters. */
  total = 0;
  page = 1;
  filters: BusinessFilters = { ...NO_FILTERS };
  state: LoadState = "idle";
  error: string | null = null;
  /** How many businesses there are in total, or null until it is known. */
  count: number | null = null;
  /** A message to show once on the directory (for example after creating a business). */
  notice: string | null = null;

  /** Unfiltered businesses slice for the top-bar portfolio switcher. */
  switcherItems: Business[] = [];
  switcherTotal = 0;
  switcherState: LoadState = "idle";
  switcherError = "";

  private requestId = 0;
  private countRequestId = 0;
  private switcherLoaded = false;
  private switcherRequestId = 0;

  constructor(private readonly api: BusinessesListApi = businessesApi) {
    makeAutoObservable<
      this,
      "api" | "requestId" | "countRequestId" | "switcherLoaded" | "switcherRequestId"
    >(this, {
      api: false,
      requestId: false,
      countRequestId: false,
      switcherLoaded: false,
      switcherRequestId: false,
    });
  }

  get hasFilters(): boolean {
    return Boolean(this.filters.q.trim() || this.filters.category || this.filters.status);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / PAGE_SIZE));
  }

  async load(): Promise<void> {
    const request = ++this.requestId;
    this.state = "loading";
    this.error = null;
    try {
      const result = await this.api.list(this.filters, this.page, PAGE_SIZE);
      if (request !== this.requestId) return;
      runInAction(() => {
        this.items = result.items;
        this.total = result.total;
        this.state = "ready";
        if (!this.hasFilters) this.count = result.total;
      });
    } catch (error) {
      if (request !== this.requestId) return;
      runInAction(() => {
        this.state = "error";
        this.error = businessErrorMessage(error);
      });
    }
  }

  /** Loads the unfiltered business list for the top-bar switcher without affecting directory filters/paging. */
  async loadSwitcher(force = false): Promise<void> {
    if (!force && (this.switcherLoaded || this.switcherState === "loading")) return;
    const request = ++this.switcherRequestId;
    this.switcherState = "loading";
    this.switcherError = "";
    try {
      const result = await this.api.list(NO_FILTERS, 1, SWITCHER_PAGE_SIZE);
      if (request !== this.switcherRequestId) return;
      runInAction(() => {
        this.switcherItems = result.items;
        this.switcherTotal = result.total;
        this.count = result.total;
        this.switcherState = "ready";
        this.switcherLoaded = true;
        this.switcherError = "";
      });
    } catch (error) {
      if (request !== this.switcherRequestId) return;
      runInAction(() => {
        this.switcherState = "error";
        this.switcherError = businessErrorMessage(error, "No pudimos cargar tus negocios.");
      });
    }
  }

  /** Makes sure the sidebar number is known, without touching the list. */
  async ensureCount(): Promise<void> {
    if (this.count !== null) return;
    const request = ++this.countRequestId;
    try {
      const result = await this.api.list(NO_FILTERS, 1, 1);
      if (request !== this.countRequestId) return;
      runInAction(() => {
        if (this.count === null) this.count = result.total;
      });
    } catch {
      /* The sidebar shows nothing until it is known; the directory reports the error on its own. */
    }
  }

  setFilters(filters: Partial<BusinessFilters>): void {
    this.filters = { ...this.filters, ...filters };
    this.page = 1;
    void this.load();
  }

  clearFilters(): void {
    this.filters = { ...NO_FILTERS };
    this.page = 1;
    void this.load();
  }

  goToPage(page: number): void {
    this.page = Math.min(Math.max(1, page), this.pageCount);
    void this.load();
  }

  /** Replaces a business that changed (paused, resumed...) in both the directory list and switcher slice. */
  replace(updated: Business): void {
    this.items = this.items.map((item) => (item.id === updated.id ? updated : item));
    this.switcherItems = this.switcherItems.map((item) => (item.id === updated.id ? updated : item));
  }

  /** After creating, editing or deleting from outside the list: counts, paging and switcher cache are stale. */
  invalidate(): void {
    this.count = null;
    this.page = 1;
    this.switcherLoaded = false;
    this.switcherRequestId++;
    this.countRequestId++;
    if (this.switcherState === "loading") this.switcherState = "idle";
  }

  setNotice(message: string | null): void {
    this.notice = message;
  }

  reset(): void {
    this.requestId++;
    this.countRequestId++;
    this.switcherRequestId++;
    this.items = [];
    this.total = 0;
    this.page = 1;
    this.filters = { ...NO_FILTERS };
    this.state = "idle";
    this.error = null;
    this.count = null;
    this.notice = null;
    this.switcherItems = [];
    this.switcherTotal = 0;
    this.switcherState = "idle";
    this.switcherError = "";
    this.switcherLoaded = false;
  }
}

export const businessesStore = new BusinessesStore();

// Another person may sign in on this tab: nothing of the previous session may stay on screen.
reaction(
  () => superAdminSessionStore.isAuthenticated,
  (signedIn) => {
    if (!signedIn) businessesStore.reset();
  },
);
