import { describe, expect, it, vi } from "vitest";
import { BusinessesError } from "../api/businessesApi";
import type { Business, BusinessPage } from "../types";
import { BusinessesStore, SWITCHER_PAGE_SIZE, type BusinessesListApi } from "./businesses.store";

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: "biz-1",
    name: "Casa Oliva",
    legalName: "Casa Oliva S.A.S.",
    taxId: "900123456-7",
    phone: "+573001234567",
    address: "Calle 10 # 5-20",
    supportEmail: "hola@casaoliva.com",
    website: null,
    category: "gastronomy",
    categoryOther: null,
    currency: "COP",
    timezone: "America/Bogota",
    modules: ["reservas"],
    status: "active",
    boss: {
      name: "Laura Gómez",
      email: "laura@casaoliva.com",
      assignedAt: "2026-01-10T12:00:00.000Z",
    },
    summary: { hasActivity: false },
    createdAt: "2026-01-10T12:00:00.000Z",
    updatedAt: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}

function makePage(items: Business[], total = items.length, page = 1, pageSize = SWITCHER_PAGE_SIZE): BusinessPage {
  return { items, total, page, pageSize };
}

/** Deferred promise helper for simulating slow and out-of-order network responses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  const api = {
    list: vi.fn<BusinessesListApi["list"]>(),
  };
  const store = new BusinessesStore(api);
  return { api, store };
}

describe("BusinessesStore · switcher slice", () => {
  it("loads switcherItems, switcherTotal and count independently from filtered directory items", async () => {
    const { api, store } = setup();
    const filteredBusiness = makeBusiness({ id: "biz-2", name: "Boutique Luna", category: "retail" });
    const allBusinesses = [
      makeBusiness({ id: "biz-1", name: "Casa Oliva" }),
      filteredBusiness,
      makeBusiness({ id: "biz-3", name: "Clínica Sol", status: "paused" }),
    ];

    api.list.mockResolvedValueOnce(makePage([filteredBusiness], 1, 1, 12));
    store.setFilters({ q: "luna", category: "retail" });
    await vi.waitFor(() => expect(store.state).toBe("ready"));

    expect(store.items).toEqual([filteredBusiness]);
    expect(store.total).toBe(1);
    expect(store.count).toBeNull();

    api.list.mockResolvedValueOnce(makePage(allBusinesses, 3, 1, SWITCHER_PAGE_SIZE));
    await store.loadSwitcher();

    expect(api.list).toHaveBeenLastCalledWith({ q: "", category: "", status: "" }, 1, SWITCHER_PAGE_SIZE);
    expect(store.switcherItems).toEqual(allBusinesses);
    expect(store.switcherTotal).toBe(3);
    expect(store.switcherState).toBe("ready");
    expect(store.switcherError).toBe("");
    expect(store.count).toBe(3);
    // Filtered directory slice stays untouched.
    expect(store.items).toEqual([filteredBusiness]);
    expect(store.total).toBe(1);
    expect(store.filters).toEqual({ q: "luna", category: "retail", status: "" });

    // Cached load skips duplicate fetch unless force is true.
    await store.loadSwitcher();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent loadSwitcher calls while loading", async () => {
    const { api, store } = setup();
    const pending = deferred<BusinessPage>();
    api.list.mockReturnValueOnce(pending.promise);

    const first = store.loadSwitcher();
    const second = store.loadSwitcher();

    expect(store.switcherState).toBe("loading");
    expect(api.list).toHaveBeenCalledTimes(1);

    pending.resolve(makePage([makeBusiness()], 1));
    await Promise.all([first, second]);

    expect(store.switcherState).toBe("ready");
    expect(store.switcherItems).toHaveLength(1);
  });

  it("ignores stale out-of-order responses using switcherRequestId", async () => {
    const { api, store } = setup();
    const stale = deferred<BusinessPage>();
    const fresh = deferred<BusinessPage>();
    const staleBusiness = makeBusiness({ id: "biz-old", name: "Antiguo" });
    const freshBusiness = makeBusiness({ id: "biz-new", name: "Nuevo" });

    api.list.mockReturnValueOnce(stale.promise);
    const first = store.loadSwitcher();

    api.list.mockReturnValueOnce(fresh.promise);
    const second = store.loadSwitcher(true);

    fresh.resolve(makePage([freshBusiness], 1));
    await second;

    stale.resolve(makePage([staleBusiness], 9));
    await first;

    expect(store.switcherItems).toEqual([freshBusiness]);
    expect(store.switcherTotal).toBe(1);
    expect(store.count).toBe(1);
    expect(store.switcherState).toBe("ready");
  });

  it("records switcherError on failure and allows retrying", async () => {
    const { api, store } = setup();
    api.list.mockRejectedValueOnce(new Error("Unexpected failure"));

    await store.loadSwitcher();
    expect(store.switcherState).toBe("error");
    expect(store.switcherError).toBe("No pudimos cargar tus negocios.");

    api.list.mockRejectedValueOnce(new BusinessesError("network", null, "Offline"));
    await store.loadSwitcher(true);
    expect(store.switcherState).toBe("error");
    expect(store.switcherError).toBe("No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.");

    const recovered = makeBusiness({ id: "biz-1", name: "Casa Oliva" });
    api.list.mockResolvedValueOnce(makePage([recovered], 1));
    await store.loadSwitcher();

    expect(store.switcherState).toBe("ready");
    expect(store.switcherError).toBe("");
    expect(store.switcherItems).toEqual([recovered]);
  });

  it("updates both items and switcherItems when replace() is called", async () => {
    const { api, store } = setup();
    const active = makeBusiness({ id: "biz-1", name: "Casa Oliva", status: "active" });
    const other = makeBusiness({ id: "biz-2", name: "Boutique Luna", status: "active" });

    api.list.mockResolvedValueOnce(makePage([active], 1, 1, 12));
    await store.load();

    api.list.mockResolvedValueOnce(makePage([active, other], 2, 1, SWITCHER_PAGE_SIZE));
    await store.loadSwitcher();

    const paused = makeBusiness({ id: "biz-1", name: "Casa Oliva", status: "paused" });
    store.replace(paused);

    expect(store.items[0].status).toBe("paused");
    expect(store.switcherItems[0].status).toBe("paused");
    expect(store.switcherItems[1]).toEqual(other);
  });

  it("marks switcher stale on invalidate() so the next loadSwitcher() fetches fresh data", async () => {
    const { api, store } = setup();
    const initial = makeBusiness({ id: "biz-1", name: "Casa Oliva" });
    const created = makeBusiness({ id: "biz-2", name: "Panadería Sur" });

    api.list.mockResolvedValueOnce(makePage([initial], 1));
    await store.loadSwitcher();
    expect(store.switcherItems).toEqual([initial]);
    expect(store.count).toBe(1);

    store.invalidate();
    expect(store.count).toBeNull();
    expect(store.page).toBe(1);

    api.list.mockResolvedValueOnce(makePage([initial, created], 2));
    await store.loadSwitcher();

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(store.switcherItems).toEqual([initial, created]);
    expect(store.switcherTotal).toBe(2);
    expect(store.count).toBe(2);
  });

  it("discards an in-flight switcher response if invalidate() runs before it settles", async () => {
    const { api, store } = setup();
    const inFlight = deferred<BusinessPage>();
    api.list.mockReturnValueOnce(inFlight.promise);

    const first = store.loadSwitcher();
    store.invalidate();

    const freshBusiness = makeBusiness({ id: "biz-2", name: "Nuevo" });
    api.list.mockResolvedValueOnce(makePage([freshBusiness], 1));
    await store.loadSwitcher();

    inFlight.resolve(makePage([makeBusiness({ id: "biz-1", name: "Viejo" })], 1));
    await first;

    expect(store.switcherItems).toEqual([freshBusiness]);
    expect(store.switcherTotal).toBe(1);
    expect(store.count).toBe(1);
  });

  it("clears all switcher state on reset() and ignores responses from the previous session", async () => {
    const { api, store } = setup();
    const previousSession = deferred<BusinessPage>();

    api.list.mockResolvedValueOnce(makePage([makeBusiness({ id: "biz-1" })], 1));
    await store.loadSwitcher();
    expect(store.switcherItems).toHaveLength(1);

    api.list.mockReturnValueOnce(previousSession.promise);
    const pending = store.loadSwitcher(true);

    store.reset();
    expect(store.switcherItems).toEqual([]);
    expect(store.switcherTotal).toBe(0);
    expect(store.switcherState).toBe("idle");
    expect(store.switcherError).toBe("");
    expect(store.count).toBeNull();

    previousSession.resolve(makePage([makeBusiness({ id: "biz-leaked" })], 1));
    await pending;

    expect(store.switcherItems).toEqual([]);
    expect(store.switcherTotal).toBe(0);
    expect(store.switcherState).toBe("idle");
    expect(store.count).toBeNull();
  });
});
