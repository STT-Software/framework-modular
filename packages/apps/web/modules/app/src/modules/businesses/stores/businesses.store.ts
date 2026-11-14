import { makeAutoObservable, reaction, runInAction } from "mobx";
import { superAdminSessionStore } from "@/modules/super-admin-auth";
import { businessesApi } from "../api/businessesApi";
import { businessErrorMessage } from "../errors";
import type { Business, BusinessFilters } from "../types";

export const PAGE_SIZE = 12;
const NO_FILTERS: BusinessFilters = { q: "", category: "", status: "" };

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * The businesses of the signed-in super admin, as the directory shows them: one page, with the filters
 * applied by the service. `count` is how many businesses exist without filters (the number in the sidebar).
 */
class BusinessesStore {
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
  private requestId = 0;

  constructor() {
    makeAutoObservable(this);
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
      const result = await businessesApi.list(this.filters, this.page, PAGE_SIZE);
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

  /** Makes sure the sidebar number is known, without touching the list. */
  async ensureCount(): Promise<void> {
    if (this.count !== null) return;
    try {
      const result = await businessesApi.list(NO_FILTERS, 1, 1);
      runInAction(() => {
        this.count = result.total;
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

  /** Replaces a business that changed (paused, resumed...) in the list on screen. */
  replace(business: Business): void {
    this.items = this.items.map((item) => (item.id === business.id ? business : item));
  }

  /** After creating or deleting from outside the list: the numbers and the page are no longer right. */
  invalidate(): void {
    this.count = null;
    this.page = 1;
  }

  setNotice(message: string | null): void {
    this.notice = message;
  }

  reset(): void {
    this.requestId++;
    this.items = [];
    this.total = 0;
    this.page = 1;
    this.filters = { ...NO_FILTERS };
    this.state = "idle";
    this.error = null;
    this.count = null;
    this.notice = null;
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
