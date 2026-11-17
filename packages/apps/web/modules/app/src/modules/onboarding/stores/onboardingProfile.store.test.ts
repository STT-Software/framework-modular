import { describe, expect, it, vi } from "vitest";
import { OnboardingError, type Profile } from "../api/onboardingApi";
import { OnboardingProfileStore, type ProfileApi } from "./onboardingProfile.store";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  phone: null,
  sources: [],
  sourceOther: null,
  completed: false,
  introSeen: false,
  ...overrides,
});

/** Promesa que la prueba resuelve o rechaza cuando quiere (para simular la red lenta). */
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
  let now = 1_000;
  const account: { id: string | null } = { id: "acc-1" };
  const api = {
    getProfile: vi.fn<ProfileApi["getProfile"]>(),
    savePhone: vi.fn<ProfileApi["savePhone"]>(),
    saveSources: vi.fn<ProfileApi["saveSources"]>(),
    markIntroSeen: vi.fn<ProfileApi["markIntroSeen"]>(),
  };
  const store = new OnboardingProfileStore(api, () => account.id, () => now);
  return {
    api,
    store,
    account,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("OnboardingProfileStore · ensureLoaded", () => {
  it("deduplica la consulta en vuelo y reutiliza el perfil reciente", async () => {
    const { api, store, advance } = setup();
    const response = deferred<Profile>();
    api.getProfile.mockReturnValueOnce(response.promise);

    const first = store.ensureLoaded();
    const second = store.ensureLoaded({ maxAgeMs: 0 });
    expect(api.getProfile).toHaveBeenCalledTimes(1);
    expect(store.status).toBe("loading");

    response.resolve(profile({ phone: "+573001234567" }));
    await expect(first).resolves.toEqual(profile({ phone: "+573001234567" }));
    await expect(second).resolves.toEqual(profile({ phone: "+573001234567" }));
    expect(store.status).toBe("ready");
    expect(store.accountId).toBe("acc-1");
    expect(store.loadedAt).toBe(1_000);

    advance(5_000);
    await store.ensureLoaded({ maxAgeMs: 10_000 });
    expect(api.getProfile).toHaveBeenCalledTimes(1);

    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567" }));
    await store.ensureLoaded({ maxAgeMs: 0 });
    expect(api.getProfile).toHaveBeenCalledTimes(2);
  });

  it("revalida sin borrar el perfil y, si falla, no cambia el estado", async () => {
    const { api, store, advance } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567" }));
    await store.ensureLoaded();

    advance(60_000);
    const response = deferred<Profile>();
    api.getProfile.mockReturnValueOnce(response.promise);
    const revalidation = store.ensureLoaded();
    expect(store.status).toBe("ready");
    expect(store.currentProfile?.phone).toBe("+573001234567");

    response.reject(new OnboardingError("network", null, "offline"));
    await expect(revalidation).resolves.toEqual(profile({ phone: "+573001234567" }));
    expect(store.status).toBe("ready");
    expect(store.loadError).toBeNull();
  });

  it("sin perfil válido, un error deja status en error y rechaza", async () => {
    const { api, store } = setup();
    api.getProfile.mockRejectedValueOnce(new OnboardingError("server", 500, "boom"));
    await expect(store.ensureLoaded()).rejects.toBeInstanceOf(OnboardingError);
    expect(store.status).toBe("error");
    expect(store.loadError?.kind).toBe("server");
  });

  it("descarta una respuesta vieja que llega después de un guardado (requestId)", async () => {
    const { api, store } = setup();
    const stale = deferred<Profile>();
    api.getProfile.mockReturnValueOnce(stale.promise);
    const loading = store.ensureLoaded();

    api.savePhone.mockResolvedValueOnce(profile({ phone: "+573001234567", introSeen: true }));
    await store.savePhone("+573001234567");

    stale.resolve(profile());
    await expect(loading).resolves.toEqual(profile({ phone: "+573001234567", introSeen: true }));
    expect(store.currentProfile?.phone).toBe("+573001234567");
    expect(api.getProfile).toHaveBeenCalledTimes(1);
  });

  it("tras invalidate, una respuesta en vuelo no repone la copia vieja", async () => {
    const { api, store } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567" }));
    await store.ensureLoaded();

    const stale = deferred<Profile>();
    api.getProfile.mockReturnValueOnce(stale.promise);
    const revalidation = store.ensureLoaded({ maxAgeMs: 0 });
    store.invalidate();
    expect(store.currentProfile).toBeNull();

    api.getProfile.mockResolvedValueOnce(profile());
    stale.resolve(profile({ phone: "+573001234567" }));
    await expect(revalidation).resolves.toEqual(profile());
    expect(store.currentProfile).toEqual(profile());
    expect(api.getProfile).toHaveBeenCalledTimes(3);
  });

  it("nunca muestra el perfil de otra cuenta", async () => {
    const { api, store, account } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567", completed: true }));
    await store.ensureLoaded();

    account.id = "acc-2";
    expect(store.currentProfile).toBeNull();

    api.getProfile.mockResolvedValueOnce(profile());
    await expect(store.ensureLoaded()).resolves.toEqual(profile());
    expect(api.getProfile).toHaveBeenCalledTimes(2);
    expect(store.accountId).toBe("acc-2");
  });

  it("ignora la respuesta de la cuenta anterior si la sesión cambia en vuelo", async () => {
    const { api, store, account } = setup();
    const old = deferred<Profile>();
    api.getProfile.mockReturnValueOnce(old.promise);
    const previous = store.ensureLoaded();

    account.id = "acc-2";
    store.reset();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+14155550123" }));
    const fresh = store.ensureLoaded();

    old.resolve(profile({ phone: "+573001234567", completed: true }));
    await expect(previous).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(fresh).resolves.toEqual(profile({ phone: "+14155550123" }));
    expect(api.getProfile).toHaveBeenCalledTimes(2);
    expect(store.currentProfile?.phone).toBe("+14155550123");
    expect(store.accountId).toBe("acc-2");
  });
});

describe("OnboardingProfileStore · guardados", () => {
  it("markIntroSeen resuelto después de savePhone no borra el teléfono", async () => {
    const { api, store } = setup();
    api.getProfile.mockResolvedValueOnce(profile());
    await store.ensureLoaded();

    // El PUT de la intro salió antes de guardar el teléfono, pero su respuesta (sin teléfono) llega después.
    const intro = deferred<Profile>();
    api.markIntroSeen.mockReturnValueOnce(intro.promise);
    const marking = store.markIntroSeen();

    api.savePhone.mockResolvedValueOnce(profile({ phone: "+573001234567", introSeen: true }));
    await store.savePhone("+573001234567");

    intro.resolve(profile({ introSeen: true }));
    await marking;
    expect(store.currentProfile).toEqual(profile({ phone: "+573001234567", introSeen: true }));
  });

  it("markIntroSeen solo cambia introSeen", async () => {
    const { api, store } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567" }));
    await store.ensureLoaded();

    api.markIntroSeen.mockResolvedValueOnce(profile({ phone: null, introSeen: true }));
    await store.markIntroSeen();
    expect(store.currentProfile).toEqual(profile({ phone: "+573001234567", introSeen: true }));
  });

  it("markIntroSeen no falla hacia fuera", async () => {
    const { api, store } = setup();
    api.markIntroSeen.mockRejectedValueOnce(new OnboardingError("network", null, "offline"));
    await expect(store.markIntroSeen()).resolves.toBeUndefined();
  });

  it("justCompleted solo se activa al pasar de incompleto a completo", async () => {
    const { api, store } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567" }));
    await store.ensureLoaded();
    expect(store.justCompleted).toBe(false);

    const done = profile({ phone: "+573001234567", completed: true, introSeen: true });
    api.saveSources.mockResolvedValueOnce(done);
    await store.saveSources([]);
    expect(api.saveSources).toHaveBeenCalledWith([], undefined);
    expect(store.justCompleted).toBe(true);

    store.acknowledgeCompletion();
    api.saveSources.mockResolvedValueOnce(done);
    await store.saveSources(["other"], "Un amigo");
    expect(store.justCompleted).toBe(false);
  });

  it("un perfil que ya llega completo no cuenta como recién completado", async () => {
    const { api, store } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567", completed: true }));
    await store.ensureLoaded();
    expect(store.justCompleted).toBe(false);
  });

  it("reset borra todo, también justCompleted", async () => {
    const { api, store } = setup();
    api.getProfile.mockResolvedValueOnce(profile({ phone: "+573001234567" }));
    await store.ensureLoaded();
    api.saveSources.mockResolvedValueOnce(profile({ phone: "+573001234567", completed: true }));
    await store.saveSources(["instagram"]);
    expect(store.justCompleted).toBe(true);

    store.reset();
    expect(store.profile).toBeNull();
    expect(store.accountId).toBeNull();
    expect(store.loadedAt).toBeNull();
    expect(store.status).toBe("idle");
    expect(store.justCompleted).toBe(false);
  });
});

describe("OnboardingError", () => {
  it("conserva el código del servicio", () => {
    expect(new OnboardingError("conflict", 409, "Phone number already in use", "phone-in-use").code).toBe(
      "phone-in-use",
    );
    expect(new OnboardingError("network", null, "offline").code).toBeNull();
  });
});
