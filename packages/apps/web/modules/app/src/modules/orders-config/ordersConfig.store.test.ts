import { describe, expect, it, vi } from "vitest";
import { AccessError } from "@/modules/business-access/public";
import { PedidosError, type PedidosApi } from "./api/pedidosApi";
import { DEFAULT_CARRIERS, PROFILE_DEFAULTS } from "./constants";
import { ordersConfigErrorMessage, OrdersConfigStore } from "./ordersConfig.store";
import { PedidosOperationStore } from "./operation/stores/operation.store";
import { ALL_OPERATOR_STAGES, type OrdersProfileId, type PedidosApiResponse, type PedidosOperatorView } from "./types";

function makeApiResponse(
  overrides: Partial<PedidosApiResponse> = {},
  profile: OrdersProfileId = "food",
): PedidosApiResponse {
  const defaults = PROFILE_DEFAULTS[profile];
  return {
    business: {
      id: "biz-1",
      name: "Restaurante Oliva",
      category: "gastronomy",
      categoryOther: null,
      currency: "USD",
      timezone: "America/Bogota",
      ...(overrides.business ?? {}),
    },
    profile: {
      id: profile,
      suggested: profile,
      ...(overrides.profile ?? {}),
    },
    schedule: {
      timezone: "America/Bogota",
      inherit: true,
      openNow: true,
      ...(overrides.schedule ?? {}),
    },
    modalities: overrides.modalities ?? [...defaults.modalities],
    onSiteMode: overrides.onSiteMode ?? defaults.onSiteMode,
    fulfillment: {
      ...defaults.fulfillment,
      carriers: DEFAULT_CARRIERS.map((c) => ({ ...c })),
      ...(overrides.fulfillment ?? {}),
    },
    payments: {
      ...defaults.payments,
      methods: [...defaults.payments.methods],
      ...(overrides.payments ?? {}),
    },
    sla: {
      ...defaults.sla,
      ...(overrides.sla ?? {}),
    },
    operators: overrides.operators ?? [],
    progress: {
      currentStep: "profile",
      visitedSteps: ["profile"],
      ready: false,
      readyAt: null,
      touched: false,
      ...(overrides.progress ?? {}),
    },
    ...(overrides.created ? { created: overrides.created } : {}),
  };
}

function makeMockApi(initialResponse: PedidosApiResponse = makeApiResponse()): {
  api: { [K in keyof PedidosApi]: ReturnType<typeof vi.fn<PedidosApi[K]>> };
  getState: () => PedidosApiResponse;
} {
  let current = structuredClone(initialResponse);

  const api = {
    get: vi.fn<PedidosApi["get"]>().mockImplementation(async () => structuredClone(current)),
    changeProfile: vi.fn<PedidosApi["changeProfile"]>().mockImplementation(async (_token, _id, profile) => {
      const next = makeApiResponse(
        {
          business: current.business,
          schedule: current.schedule,
          operators: current.operators,
          progress: {
            currentStep: current.progress.currentStep,
            visitedSteps: [...current.progress.visitedSteps],
            ready: false,
            readyAt: null,
            touched: false,
          },
        },
        profile,
      );
      current = next;
      return structuredClone(current);
    }),
    updateModalities: vi.fn<PedidosApi["updateModalities"]>().mockImplementation(async (_token, _id, body) => {
      current = {
        ...current,
        modalities: [...body.modalities],
        onSiteMode: body.onSiteMode,
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return structuredClone(current);
    }),
    updateFulfillment: vi.fn<PedidosApi["updateFulfillment"]>().mockImplementation(async (_token, _id, body) => {
      current = {
        ...current,
        fulfillment: { ...body, carriers: body.carriers.map((c) => ({ ...c })) },
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return structuredClone(current);
    }),
    updatePayments: vi.fn<PedidosApi["updatePayments"]>().mockImplementation(async (_token, _id, body) => {
      current = {
        ...current,
        payments: { ...body, methods: [...body.methods] },
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return structuredClone(current);
    }),
    updateSla: vi.fn<PedidosApi["updateSla"]>().mockImplementation(async (_token, _id, body) => {
      current = {
        ...current,
        sla: { ...body },
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return structuredClone(current);
    }),
    createOperator: vi.fn<PedidosApi["createOperator"]>().mockImplementation(async (_token, _id, body) => {
      const id = `op_${current.operators.length + 1}`;
      current = {
        ...current,
        operators: [
          ...current.operators,
          {
            id,
            name: body.name,
            email: body.email,
            phone: body.phone,
            stages: [...body.stages],
            createdAt: "2026-11-22T20:00:00.000Z",
          },
        ],
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return { ...structuredClone(current), created: { id } };
    }),
    updateOperator: vi.fn<PedidosApi["updateOperator"]>().mockImplementation(async (_token, _id, operatorId, body) => {
      current = {
        ...current,
        operators: current.operators.map((op) =>
          op.id === operatorId
            ? { ...op, name: body.name, email: body.email, phone: body.phone, stages: [...body.stages] }
            : op,
        ),
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return structuredClone(current);
    }),
    deleteOperator: vi.fn<PedidosApi["deleteOperator"]>().mockImplementation(async (_token, _id, operatorId) => {
      current = {
        ...current,
        operators: current.operators.filter((op) => op.id !== operatorId),
        progress: { ...current.progress, ready: false, readyAt: null, touched: true },
      };
      return structuredClone(current);
    }),
    saveProgress: vi.fn<PedidosApi["saveProgress"]>().mockImplementation(async (_token, _id, body) => {
      current = {
        ...current,
        progress: {
          ...current.progress,
          currentStep: body.currentStep,
          visitedSteps: [...body.visitedSteps],
        },
      };
      return structuredClone(current);
    }),
    complete: vi.fn<PedidosApi["complete"]>().mockImplementation(async () => {
      current = {
        ...current,
        progress: {
          ...current.progress,
          currentStep: "review",
          visitedSteps: current.progress.visitedSteps.includes("review")
            ? current.progress.visitedSteps
            : [...current.progress.visitedSteps, "review"],
          ready: true,
          readyAt: "2026-11-22T20:05:00.000Z",
        },
      };
      return structuredClone(current);
    }),
    operator: vi.fn<PedidosApi["operator"]>(),
  };

  return { api, getState: () => current };
}

function setup(options: { initialResponse?: PedidosApiResponse; hasSession?: boolean } = {}) {
  const { api } = makeMockApi(options.initialResponse);
  const ensureSession = vi.fn<() => Promise<boolean>>().mockResolvedValue(options.hasSession ?? true);
  const store = new OrdersConfigStore({
    api,
    access: {
      ensureSession,
      withToken: (call) => call("test-token"),
    },
  });
  return { store, api, ensureSession };
}

describe("OrdersConfigStore · load and error mapping", () => {
  it("loads server state including business currency, schedule, suggestedProfile, and operators", async () => {
    const initial = makeApiResponse({
      business: {
        id: "biz-1",
        name: "Casa Oliva",
        category: "gastronomy",
        categoryOther: null,
        currency: "MXN",
        timezone: "America/Mexico_City",
      },
      profile: { id: "food", suggested: "food" },
      schedule: { timezone: "America/Mexico_City", inherit: false, openNow: false },
      operators: [
        {
          id: "op_99",
          name: "Camila Rojas",
          email: "camila@oliva.mx",
          phone: "+525512345678",
          stages: ["confirmation", "dispatch"],
          createdAt: "2026-11-20T12:00:00.000Z",
        },
      ],
      progress: {
        currentStep: "sla",
        visitedSteps: ["profile", "modalities", "fulfillment", "payments", "sla"],
        ready: true,
        readyAt: "2026-11-21T10:00:00.000Z",
        touched: true,
      },
    });
    const { store, api } = setup({ initialResponse: initial });
    await store.load("biz-1");

    expect(api.get).toHaveBeenCalledWith("test-token", "biz-1");
    expect(store.status).toBe("ready");
    expect(store.currency).toBe("MXN");
    expect(store.suggestedProfile).toBe("food");
    expect(store.schedule).toEqual({ timezone: "America/Mexico_City", inherit: false, openNow: false });
    expect(store.state?.status).toBe("ready");
    expect(store.state?.step).toBe("sla");
    expect(store.state?.touched).toBe(true);
    expect(store.state?.operators[0]).toMatchObject({
      id: "op_99",
      name: "Camila Rojas",
      email: "camila@oliva.mx",
      phone: "+525512345678",
      stages: ["confirmation", "dispatch"],
      role: "operator",
    });

    // Empty currency falls back to COP
    const fallback = setup({
      initialResponse: makeApiResponse({
        business: {
          id: "biz-2",
          name: "Sin Moneda",
          category: "retail",
          categoryOther: null,
          currency: "",
          timezone: "America/Bogota",
        },
      }),
    });
    await fallback.store.load("biz-2");
    expect(fallback.store.currency).toBe("COP");
  });

  it("handles signed-out, blocked, unavailable, and error states distinctly with Spanish copy", async () => {
    const signedOut = setup({ hasSession: false });
    await signedOut.store.load("biz-1");
    expect(signedOut.store.status).toBe("signed-out");

    const blocked = setup();
    blocked.api.get.mockRejectedValueOnce(new PedidosError("forbidden", 403, "Module disabled", {}, "module-not-enabled"));
    await blocked.store.load("biz-1");
    expect(blocked.store.status).toBe("blocked");
    expect(blocked.store.errorMessage).toBe("El módulo de Pedidos no está habilitado para este negocio.");

    const unavailable = setup();
    unavailable.api.get.mockRejectedValueOnce(new PedidosError("not-found", 404, "Not found"));
    await unavailable.store.load("biz-1");
    expect(unavailable.store.status).toBe("unavailable");
    expect(unavailable.store.errorMessage).toBe("Este negocio ya no está disponible para ti.");

    const errored = setup();
    errored.api.get.mockRejectedValueOnce(new PedidosError("network", null, "Could not reach the service"));
    await errored.store.load("biz-1");
    expect(errored.store.status).toBe("error");
    expect(errored.store.errorMessage).toBe("No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.");
  });

  it("maps PedidosError codes and AccessError kinds to localized Spanish messages", () => {
    expect(ordersConfigErrorMessage(new PedidosError("validation", 409, "dup", {}, "duplicate-operator-email"))).toBe(
      "Este correo ya pertenece a otro operador registrado.",
    );
    expect(ordersConfigErrorMessage(new PedidosError("validation", 409, "incomplete", {}, "pedidos-incomplete"))).toBe(
      "Todavía hay ajustes pendientes por revisar antes de guardar la configuración.",
    );
    expect(ordersConfigErrorMessage(new PedidosError("validation", 409, "conflict", {}, "concurrent-change"))).toBe(
      "Alguien más cambió esta configuración al mismo tiempo. Recarga e inténtalo de nuevo.",
    );
    expect(ordersConfigErrorMessage(new AccessError("rate-limited", 429, "Too many requests"))).toBe(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    );
    expect(ordersConfigErrorMessage(new Error("Raw technical error"))).toBe(
      "No pudimos cargar la configuración de Pedidos. Inténtalo de nuevo.",
    );
  });
});

describe("OrdersConfigStore · step progress, dirty section flushing, and profile switching", () => {
  it("tracks visitedSteps on setStep via PUT /progress without marking touched or invalidating ready status", async () => {
    const { store, api } = setup();
    await store.load("biz-1");
    expect(await store.completeSetup()).toEqual({ ok: true });
    expect(store.state?.status).toBe("ready");
    const versionBeforeNav = store.state!.version;

    await store.setStep("modalities");
    await store.setStep("sla");
    await store.setStep("sla"); // Redundant step skips extra PUT /progress

    expect(api.saveProgress).toHaveBeenCalledTimes(2);
    expect(api.saveProgress).toHaveBeenLastCalledWith("test-token", "biz-1", {
      currentStep: "sla",
      visitedSteps: ["profile", "review", "modalities", "sla"],
    });
    expect(store.state?.touched).toBe(false);
    expect(store.state?.status).toBe("ready");
    expect(store.state?.version).toBe(versionBeforeNav);
  });

  it("flushes valid dirty sections in canonical order and preserves invalid drafts in memory", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    const callOrder: string[] = [];
    const origModalities = api.updateModalities.getMockImplementation()!;
    const origFulfillment = api.updateFulfillment.getMockImplementation()!;
    const origPayments = api.updatePayments.getMockImplementation()!;
    api.updateModalities.mockImplementationOnce(async (t, id, body) => {
      callOrder.push("modalities");
      return origModalities(t, id, body);
    });
    api.updateFulfillment.mockImplementationOnce(async (t, id, body) => {
      callOrder.push("fulfillment");
      return origFulfillment(t, id, body);
    });
    api.updatePayments.mockImplementationOnce(async (t, id, body) => {
      callOrder.push("payments");
      return origPayments(t, id, body);
    });

    // Edit sla invalidly (preparationMinutes = 0), while modalities, fulfillment, and payments are valid
    store.updateSla({ preparationMinutes: 0 });
    store.setCancellationLimit("before_confirmation");
    store.setPickupMode("fixed");
    store.setOnSiteMode("counter");

    const flushed = await store.flushDirtySections();
    expect(flushed).toBe(true);
    expect(callOrder).toEqual(["modalities", "fulfillment", "payments"]);
    expect(api.updateSla).not.toHaveBeenCalled();
    // Invalid SLA draft is preserved in memory so inline validation stays visible
    expect(store.state?.sla.preparationMinutes).toBe(0);
    expect(store.state?.onSiteMode).toBe("counter");
    expect(store.state?.fulfillment.pickupMode).toBe("fixed");
    expect(store.state?.payments.cancellationLimit).toBe("before_confirmation");
  });

  it("sanitizes non-applicable NaN numeric fields to finite integers when flushing DTO payloads", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    store.setConfirmationMode("automatic");
    // confirmationMinutes is non-applicable in automatic mode; clearing input sets NaN
    store.updateSla({ confirmationMinutes: Number.NaN, preparationMinutes: 30 });

    expect(await store.flushDirtySections()).toBe(true);
    expect(api.updateSla).toHaveBeenCalledWith(
      "test-token",
      "biz-1",
      expect.objectContaining({
        confirmationMinutes: 0,
        preparationMinutes: 30,
      }),
    );
  });

  it("clamps and slices hidden/disabled out-of-range fulfillment and SLA fields before sending DTOs", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    // Enter invalid values while enabled, then toggle/hide each field so it becomes non-applicable
    store.setConfirmationMode("agent");
    store.setWhatsappNumber("9".repeat(80));
    store.setRiskThreshold(true, -500);
    store.setShippingPricingMode("free_from");
    store.setFlatShippingFee(-100);
    store.setFreeShippingThreshold(999_999_999);
    store.setMinimumOrder(true, -25);
    store.updateSla({
      confirmationMinutes: -20,
      dispatchMinutes: 50_000,
      outOfHoursAutoReply: true,
      outOfHoursMessage: "x".repeat(650),
    });

    // Now disable/hide all those fields: switch to automatic, disable delivery, disable thresholds and auto-reply
    store.toggleModality("delivery");
    store.setConfirmationMode("automatic");
    store.setRiskThreshold(false, -500);
    store.setMinimumOrder(false, -25);
    store.updateSla({ outOfHoursAutoReply: false });

    expect(await store.flushDirtySections()).toBe(true);

    expect(api.updateFulfillment).toHaveBeenCalledWith(
      "test-token",
      "biz-1",
      expect.objectContaining({
        whatsappNumber: "9".repeat(60),
        maxShippingCostRisk: 0,
        flatShippingFee: 0,
        freeShippingThreshold: 100_000_000,
        minimumOrderAmount: 0,
      }),
    );
    expect(api.updateSla).toHaveBeenCalledWith(
      "test-token",
      "biz-1",
      expect.objectContaining({
        confirmationMinutes: 0,
        dispatchMinutes: 10_080,
        outOfHoursAutoReply: false,
        outOfHoursMessage: "x".repeat(500),
      }),
    );
  });

  it("serializes overlapping flushDirtySections calls and flushes mid-flight edits without concurrent PUTs", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    let inFlight = 0;
    let maxConcurrent = 0;
    let notifyFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      notifyFirstStarted = resolve;
    });
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const origModalities = api.updateModalities.getMockImplementation()!;
    let modalitiesCalls = 0;
    api.updateModalities.mockImplementation(async (token, id, body) => {
      modalitiesCalls += 1;
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      if (modalitiesCalls === 1) {
        notifyFirstStarted();
        await firstGate;
      }
      const res = await origModalities(token, id, body);
      inFlight -= 1;
      return res;
    });

    const origFulfillment = api.updateFulfillment.getMockImplementation()!;
    api.updateFulfillment.mockImplementation(async (token, id, body) => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      const res = await origFulfillment(token, id, body);
      inFlight -= 1;
      return res;
    });

    store.setOnSiteMode("counter");
    const firstFlush = store.flushDirtySections();
    await firstStarted;

    // While first PUT /modalities ("counter") is suspended in flight, trigger another edit and an overlapping flush
    store.setOnSiteMode("table_or_zone");
    store.setPickupMode("fixed");
    const secondFlush = store.flushDirtySections();

    releaseFirst();
    const [ok1, ok2] = await Promise.all([firstFlush, secondFlush]);

    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
    expect(maxConcurrent).toBe(1);
    expect(api.updateModalities).toHaveBeenCalledTimes(2);
    expect(api.updateModalities).toHaveBeenLastCalledWith(
      "test-token",
      "biz-1",
      expect.objectContaining({ onSiteMode: "table_or_zone" }),
    );
    expect(api.updateFulfillment).toHaveBeenCalledTimes(1);
    expect(store.state?.onSiteMode).toBe("table_or_zone");
    expect(store.state?.fulfillment.pickupMode).toBe("fixed");
  });

  it("switches profile immediately when untouched and requires force when touched, calling PUT /profile", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    expect(await store.setProfile("fashion")).toBe(true);
    expect(api.changeProfile).toHaveBeenCalledWith("test-token", "biz-1", "fashion");
    expect(store.state?.profile).toBe("fashion");
    expect(store.state?.touched).toBe(false);

    // Customize a field -> touched becomes true
    store.setDefaultCarrier("envia");
    expect(store.state?.touched).toBe(true);

    // Without force, blocked locally (no API call)
    expect(await store.setProfile("general")).toBe(false);
    expect(api.changeProfile).toHaveBeenCalledTimes(1);

    // With force, calls PUT /profile and resets all sections cleanly
    expect(await store.setProfile("general", { force: true })).toBe(true);
    expect(api.changeProfile).toHaveBeenCalledWith("test-token", "biz-1", "general");
    expect(store.state?.profile).toBe("general");
    expect(store.state?.touched).toBe(false);
    expect(store.state?.payments).toEqual(PROFILE_DEFAULTS.general.payments);
  });

  it("treats updateSla as a no-op when all provided fields match current values", async () => {
    const { store } = setup();
    await store.load("biz-1");

    expect(await store.completeSetup()).toEqual({ ok: true });
    expect(store.state?.status).toBe("ready");
    expect(store.state?.touched).toBe(false);
    const versionBefore = store.state!.version;

    store.updateSla({ outOfHoursPolicy: store.state!.sla.outOfHoursPolicy });
    store.updateSla({
      preparationMinutes: store.state!.sla.preparationMinutes,
      outOfHoursAutoReply: store.state!.sla.outOfHoursAutoReply,
    });

    expect(store.state?.status).toBe("ready");
    expect(store.state?.touched).toBe(false);
    expect(store.state?.version).toBe(versionBefore);
  });
});

describe("OrdersConfigStore · modalities, payments, operators CRUD, and completeSetup", () => {
  it("prevents disabling the last modality or last payment method", async () => {
    const { store } = setup({ initialResponse: makeApiResponse({}, "services") });
    await store.load("biz-1");

    const modRes = store.toggleModality("on_site");
    expect(modRes.ok).toBe(false);

    expect(store.togglePaymentMethod("bank_transfer")).toEqual({ ok: true });
    const payRes = store.togglePaymentMethod("in_store");
    expect(payRes.ok).toBe(false);
  });

  it("persists operators via POST/PUT/DELETE, enforces stages, and maps server duplicate-operator-email", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    // Local validation rejects empty stages before calling API
    expect(await store.addOperator({ name: "Ana", email: "ana@necto.co", stages: [] })).toMatchObject({
      ok: false,
      field: "stages",
    });
    expect(api.createOperator).not.toHaveBeenCalled();

    const added = await store.addOperator({
      name: "  Ana Lopez ",
      email: "ANA@NECTO.CO",
      phone: "+57 (300) 555-0199",
      stages: ["confirmation", "dispatch"],
    });
    expect(added.ok).toBe(true);
    expect(api.createOperator).toHaveBeenCalledWith("test-token", "biz-1", {
      name: "Ana Lopez",
      email: "ana@necto.co",
      phone: "+57 (300) 555-0199",
      stages: ["confirmation", "dispatch"],
    });
    if (!added.ok) return;

    // Server duplicate email maps cleanly to email field error
    api.createOperator.mockRejectedValueOnce(
      new PedidosError("validation", 409, "duplicate", { email: ["already exists"] }, "duplicate-operator-email"),
    );
    const serverDup = await store.addOperator({
      name: "Luis Mora",
      email: "luis@necto.co",
      stages: [...ALL_OPERATOR_STAGES],
    });
    expect(serverDup).toEqual({
      ok: false,
      field: "email",
      message: "Este correo ya pertenece a otro operador registrado.",
    });

    // Update preserves existing stages when omitted and sends null phone when cleared
    const updated = await store.updateOperator(added.operator.id, {
      name: "Ana M.",
      email: "ana@necto.co",
      phone: "",
    });
    expect(updated.ok).toBe(true);
    expect(api.updateOperator).toHaveBeenCalledWith("test-token", "biz-1", added.operator.id, {
      name: "Ana M.",
      email: "ana@necto.co",
      phone: null,
      stages: ["confirmation", "dispatch"],
    });

    // Delete calls DELETE /operators/:id
    expect(await store.removeOperator(added.operator.id)).toBe(true);
    expect(api.deleteOperator).toHaveBeenCalledWith("test-token", "biz-1", added.operator.id);
    expect(store.state?.operators).toEqual([]);
  });

  it("gates completeSetup on local validation, flushes dirty sections, and handles server completion errors", async () => {
    const { store, api } = setup();
    await store.load("biz-1");

    // Local validation blocks without calling API
    store.setConfirmationMode("agent");
    store.setWhatsappNumber("");
    const invalidRes = await store.completeSetup();
    expect(invalidRes.ok).toBe(false);
    if (!invalidRes.ok) {
      expect(invalidRes.issues.some((i) => i.field === "whatsappNumber")).toBe(true);
    }
    expect(api.complete).not.toHaveBeenCalled();

    // Fix validation -> flushes fulfillment then calls POST /complete
    store.setWhatsappNumber("+57 300 123 4567");
    const okRes = await store.completeSetup();
    expect(okRes).toEqual({ ok: true });
    expect(api.updateFulfillment).toHaveBeenCalledTimes(1);
    expect(api.complete).toHaveBeenCalledWith("test-token", "biz-1");
    expect(store.state?.status).toBe("ready");

    // Server 409 concurrent-change surfaces saveError cleanly
    api.complete.mockRejectedValueOnce(new PedidosError("validation", 409, "conflict", {}, "concurrent-change"));
    const conflictRes = await store.completeSetup();
    expect(conflictRes.ok).toBe(false);
    expect(store.saveError).toBe(
      "Alguien más cambió esta configuración al mismo tiempo. Recarga e inténtalo de nuevo.",
    );
  });
});

describe("PedidosOperationStore", () => {
  const sampleView: PedidosOperatorView = {
    business: { id: "biz-1", name: "Casa Oliva" },
    operator: {
      id: "op_1",
      name: "Camila Rojas",
      email: "camila@oliva.co",
      phone: "+573001112233",
      stages: ["confirmation", "preparation"],
    },
    schedule: {
      timezone: "America/Bogota",
      inherit: true,
      openNow: true,
    },
    modalities: ["delivery", "pickup"],
    confirmationMode: "manual",
  };

  function setupOperator(hasSession = true) {
    const operatorFn = vi.fn<PedidosApi["operator"]>().mockResolvedValue(sampleView);
    const ensureSession = vi.fn<() => Promise<boolean>>().mockResolvedValue(hasSession);
    const store = new PedidosOperationStore({
      api: {
        operator: operatorFn,
        get: vi.fn(),
        createOperator: vi.fn(),
        updateOperator: vi.fn(),
        deleteOperator: vi.fn(),
      },
      access: { ensureSession, chooseRole: () => "operator", withToken: (call) => call("op-token") },
    });
    return { store, operatorFn, ensureSession };
  }

  it("loads scoped operator view on ready session", async () => {
    const { store, operatorFn } = setupOperator();
    await store.load("biz-1");

    expect(operatorFn).toHaveBeenCalledWith("op-token", "biz-1");
    expect(store.status).toBe("ready");
    expect(store.view).toEqual(sampleView);
  });

  it("handles signed-out, unavailable, and error states cleanly", async () => {
    const signedOut = setupOperator(false);
    await signedOut.store.load("biz-1");
    expect(signedOut.store.status).toBe("signed-out");

    const notFound = setupOperator();
    notFound.operatorFn.mockRejectedValueOnce(new PedidosError("not-found", 404, "Not found"));
    await notFound.store.load("biz-1");
    expect(notFound.store.status).toBe("unavailable");

    const disabled = setupOperator();
    disabled.operatorFn.mockRejectedValueOnce(
      new PedidosError("forbidden", 403, "Disabled", {}, "module-not-enabled"),
    );
    await disabled.store.load("biz-1");
    expect(disabled.store.status).toBe("unavailable");

    const netErr = setupOperator();
    netErr.operatorFn.mockRejectedValueOnce(new PedidosError("network", null, "Offline"));
    await netErr.store.load("biz-1");
    expect(netErr.store.status).toBe("error");
    expect(netErr.store.error).toBe("No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.");
  });

  it("ignores stale responses after reset()", async () => {
    const { store, operatorFn } = setupOperator();
    let resolveView!: (v: PedidosOperatorView) => void;
    operatorFn.mockReturnValueOnce(
      new Promise<PedidosOperatorView>((res) => {
        resolveView = res;
      }),
    );

    const pending = store.load("biz-1");
    store.reset();
    resolveView(sampleView);
    await pending;

    expect(store.status).toBe("idle");
    expect(store.view).toBeNull();
  });

  function setupAdmin() {
    const response = makeApiResponse({
      operators: [
        { id: "op_1", name: "Camila Rojas", email: "camila@oliva.co", phone: null, stages: ["confirmation"], createdAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    const get = vi.fn<PedidosApi["get"]>().mockResolvedValue(response);
    const createOperator = vi.fn<PedidosApi["createOperator"]>().mockResolvedValue({
      ...response,
      operators: [
        ...response.operators,
        { id: "op_2", name: "Leo Paz", email: "leo@oliva.co", phone: null, stages: ["dispatch"], createdAt: "2026-01-02T00:00:00.000Z" },
      ],
    });
    const updateOperator = vi.fn<PedidosApi["updateOperator"]>().mockResolvedValue(response);
    const deleteOperator = vi.fn<PedidosApi["deleteOperator"]>().mockResolvedValue({ ...response, operators: [] });
    const store = new PedidosOperationStore({
      api: { get, operator: vi.fn(), createOperator, updateOperator, deleteOperator },
      access: { ensureSession: async () => true, chooseRole: () => "admin", withToken: (call) => call("token") },
    });
    return { store, response, createOperator, updateOperator, deleteOperator };
  }

  it("loads the real team for the administrator", async () => {
    const { store } = setupAdmin();
    await store.load("biz-1");

    expect(store.isAdmin).toBe(true);
    expect(store.operatorCount).toBe(1);
    expect(store.operators.map((operator) => operator.email)).toEqual(["camila@oliva.co"]);
  });

  it("adds and removes operators against the service", async () => {
    const { store, createOperator, deleteOperator } = setupAdmin();
    await store.load("biz-1");

    const added = await store.addOperator({ name: "Leo Paz", email: "leo@oliva.co", stages: ["dispatch"] });
    expect(added.ok).toBe(true);
    expect(createOperator).toHaveBeenCalledWith("token", "biz-1", {
      name: "Leo Paz",
      email: "leo@oliva.co",
      phone: null,
      stages: ["dispatch"],
    });
    expect(store.operators).toHaveLength(2);
    expect(store.operatorCount).toBe(2);

    const removed = await store.removeOperator("op_2");
    expect(removed.ok).toBe(true);
    expect(deleteOperator).toHaveBeenCalledWith("token", "biz-1", "op_2");
    expect(store.operators).toHaveLength(0);
  });

  it("rejects a duplicate email before calling the service", async () => {
    const { store, createOperator } = setupAdmin();
    await store.load("biz-1");

    const added = await store.addOperator({ name: "Otra Camila", email: "camila@oliva.co", stages: ["dispatch"] });
    expect(added.ok).toBe(false);
    expect(added.message).toBe("Este correo ya pertenece a otro operador registrado.");
    expect(createOperator).not.toHaveBeenCalled();
  });
});
