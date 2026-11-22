import { describe, expect, it, vi } from "vitest";
import { createInitialConfigState, DEFAULT_CARRIERS, PROFILE_DEFAULTS } from "./constants";
import { ALL_OPERATOR_STAGES, type OrderOperator, type OrdersConfigState, type OrdersProfileId } from "./types";
import {
  generateOperatorId,
  hasActiveDeliveryChannel,
  hasUpfrontPaymentMethod,
  hydrateOrdersConfigState,
  isConfirmationExpiryApplicable,
  isConfirmationSlaApplicable,
  isDeliveryPricingApplicable,
  isDispatchSlaApplicable,
  isFlatShippingFeeApplicable,
  isFreeShippingThresholdApplicable,
  isFreightRiskThresholdApplicable,
  isOnSiteModeApplicable,
  isTransferReceiptApplicable,
  isWhatsappChannelApplicable,
  normalizeEmail,
  normalizePhone,
  ORDERS_CONFIG_LIMITS,
  validateOperatorInput,
  validateOrdersConfig,
  validateStep,
} from "./validation";

function makeState(overrides: Partial<OrdersConfigState> = {}, profile: OrdersProfileId = "food"): OrdersConfigState {
  const base = createInitialConfigState("biz-1", profile);
  return {
    ...base,
    ...overrides,
    fulfillment: {
      ...base.fulfillment,
      ...(overrides.fulfillment ?? {}),
      carriers: overrides.fulfillment?.carriers ?? base.fulfillment.carriers.map((c) => ({ ...c })),
    },
    payments: {
      ...base.payments,
      ...(overrides.payments ?? {}),
      methods: overrides.payments?.methods ?? [...base.payments.methods],
    },
    sla: {
      ...base.sla,
      ...(overrides.sla ?? {}),
    },
    operators: overrides.operators ?? [],
  };
}

describe("orders-config validation helpers", () => {
  it("normalizes emails by trimming and lowercasing", () => {
    expect(normalizeEmail("  Ana.Gomez@Example.COM  ")).toBe("ana.gomez@example.com");
    expect(normalizeEmail("   ")).toBe("");
  });

  it("normalizes optional phones and returns undefined for blanks", () => {
    expect(normalizePhone(undefined)).toBeUndefined();
    expect(normalizePhone("   ")).toBeUndefined();
    expect(normalizePhone("  +57   300  123-4567  ")).toBe("+57 300 123-4567");
  });

  it("generates unique operator IDs using crypto.randomUUID and falls back safely when unavailable", () => {
    const id1 = generateOperatorId();
    const id2 = generateOperatorId();
    expect(id1.startsWith("op_")).toBe(true);
    expect(id1).not.toBe(id2);

    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {});
    try {
      const fallbackId = generateOperatorId();
      expect(fallbackId.startsWith("op_")).toBe(true);
    } finally {
      vi.stubGlobal("crypto", originalCrypto);
    }
  });

  it("evaluates conditional applicability predicates accurately", () => {
    const manualDelivery = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...createInitialConfigState("biz-1").fulfillment,
        confirmationMode: "manual",
        shippingPricingMode: "fixed",
      },
      payments: { ...createInitialConfigState("biz-1").payments, methods: ["cash_on_delivery"] },
    });
    expect(isOnSiteModeApplicable(manualDelivery)).toBe(false);
    expect(isWhatsappChannelApplicable(manualDelivery)).toBe(false);
    expect(isFreightRiskThresholdApplicable(manualDelivery)).toBe(false);
    expect(isDeliveryPricingApplicable(manualDelivery)).toBe(true);
    expect(isFlatShippingFeeApplicable(manualDelivery)).toBe(true);
    expect(isFreeShippingThresholdApplicable(manualDelivery)).toBe(false);
    expect(isTransferReceiptApplicable(manualDelivery)).toBe(false);
    expect(isConfirmationExpiryApplicable(manualDelivery)).toBe(true);
    expect(isConfirmationSlaApplicable(manualDelivery)).toBe(true);
    expect(isDispatchSlaApplicable(manualDelivery)).toBe(true);

    const autoPickupOnSite = makeState({
      modalities: ["pickup", "on_site"],
      fulfillment: {
        ...createInitialConfigState("biz-1").fulfillment,
        confirmationMode: "automatic",
        shippingPricingMode: "free_from",
      },
      payments: { ...createInitialConfigState("biz-1").payments, methods: ["bank_transfer"] },
    });
    expect(isOnSiteModeApplicable(autoPickupOnSite)).toBe(true);
    expect(isWhatsappChannelApplicable(autoPickupOnSite)).toBe(false);
    expect(isFreightRiskThresholdApplicable(autoPickupOnSite)).toBe(false);
    expect(isDeliveryPricingApplicable(autoPickupOnSite)).toBe(false);
    expect(isFlatShippingFeeApplicable(autoPickupOnSite)).toBe(false);
    expect(isFreeShippingThresholdApplicable(autoPickupOnSite)).toBe(false);
    expect(isTransferReceiptApplicable(autoPickupOnSite)).toBe(true);
    expect(isConfirmationExpiryApplicable(autoPickupOnSite)).toBe(false);
    expect(isConfirmationSlaApplicable(autoPickupOnSite)).toBe(false);
    expect(isDispatchSlaApplicable(autoPickupOnSite)).toBe(false);

    const agentDeliveryFreeFrom = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...createInitialConfigState("biz-1").fulfillment,
        confirmationMode: "agent",
        shippingPricingMode: "free_from",
      },
    });
    expect(isWhatsappChannelApplicable(agentDeliveryFreeFrom)).toBe(true);
    expect(isFreightRiskThresholdApplicable(agentDeliveryFreeFrom)).toBe(true);
    expect(isFlatShippingFeeApplicable(agentDeliveryFreeFrom)).toBe(true);
    expect(isFreeShippingThresholdApplicable(agentDeliveryFreeFrom)).toBe(true);
    expect(isConfirmationExpiryApplicable(agentDeliveryFreeFrom)).toBe(true);
    expect(isConfirmationSlaApplicable(agentDeliveryFreeFrom)).toBe(true);
    expect(isDispatchSlaApplicable(agentDeliveryFreeFrom)).toBe(true);

    expect(hasUpfrontPaymentMethod(["cash_on_delivery", "in_store"])).toBe(false);
    expect(hasUpfrontPaymentMethod(["bank_transfer"])).toBe(true);
    expect(hasUpfrontPaymentMethod(["payment_link"])).toBe(true);
  });
});

describe("validateOrdersConfig and validateStep", () => {
  it.each<OrdersProfileId>(["food", "fashion", "general", "services"])(
    "passes validation out of the box for default profile '%s'",
    (profile) => {
      const state = createInitialConfigState("biz-1", profile);
      expect(validateOrdersConfig(state)).toEqual([]);
    },
  );

  it("exposes updated 'services' profile copy for custom orders without colliding with scheduling", () => {
    expect(PROFILE_DEFAULTS.services.name).toBe("Encargos y servicios a pedido");
    expect(PROFILE_DEFAULTS.services.description.toLowerCase()).not.toContain("agendamiento");
  });

  it("rejects empty modalities list", () => {
    const state = makeState({ modalities: [] });
    const issues = validateStep(state, "modalities");
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("modalities");
  });

  it("requires valid WhatsApp number when confirmationMode is 'agent' and ignores it otherwise", () => {
    const baseFulfillment = createInitialConfigState("biz-1", "food").fulfillment;

    const missingWhatsapp = makeState({
      fulfillment: { ...baseFulfillment, confirmationMode: "agent", whatsappNumber: "" },
    });
    expect(validateStep(missingWhatsapp, "fulfillment").map((i) => i.field)).toContain("whatsappNumber");

    const invalidWhatsapp = makeState({
      fulfillment: { ...baseFulfillment, confirmationMode: "agent", whatsappNumber: "123" },
    });
    expect(validateStep(invalidWhatsapp, "fulfillment").map((i) => i.field)).toContain("whatsappNumber");

    const validWhatsapp = makeState({
      fulfillment: { ...baseFulfillment, confirmationMode: "agent", whatsappNumber: "+57 (300) 123-4567" },
    });
    expect(validateStep(validWhatsapp, "fulfillment")).toEqual([]);

    const manualIgnored = makeState({
      fulfillment: { ...baseFulfillment, confirmationMode: "manual", whatsappNumber: "bad" },
    });
    expect(validateStep(manualIgnored, "fulfillment")).toEqual([]);
  });

  it("requires own courier or at least one enabled carrier when delivery is active", () => {
    const disabledCarriers = DEFAULT_CARRIERS.map((c) => ({ ...c, enabled: false, isDefault: false }));

    const invalid = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...createInitialConfigState("biz-1").fulfillment,
        hasOwnCourier: false,
        carriers: disabledCarriers,
      },
    });
    expect(hasActiveDeliveryChannel(invalid.fulfillment)).toBe(false);
    expect(validateStep(invalid, "fulfillment").some((i) => i.field === "deliveryChannel")).toBe(true);

    const withOwnCourier = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...createInitialConfigState("biz-1").fulfillment,
        hasOwnCourier: true,
        carriers: disabledCarriers,
      },
    });
    expect(validateStep(withOwnCourier, "fulfillment")).toEqual([]);

    const withoutDelivery = makeState({
      modalities: ["pickup"],
      fulfillment: {
        ...createInitialConfigState("biz-1").fulfillment,
        hasOwnCourier: false,
        carriers: disabledCarriers,
      },
    });
    expect(validateStep(withoutDelivery, "fulfillment")).toEqual([]);
  });

  it("validates delivery shipping pricing modes and minimum order bounds only when applicable", () => {
    const baseFulfillment = createInitialConfigState("biz-1", "food").fulfillment;

    // 'fixed': flatShippingFee 0..100_000_000, freeShippingThreshold ignored
    const fixedValid = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...baseFulfillment,
        shippingPricingMode: "fixed",
        flatShippingFee: 0,
        freeShippingThreshold: 0,
        minimumOrderActive: false,
        minimumOrderAmount: 0,
      },
    });
    expect(validateStep(fixedValid, "fulfillment")).toEqual([]);

    const fixedBadFee = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...baseFulfillment,
        shippingPricingMode: "fixed",
        flatShippingFee: -1,
        minimumOrderActive: false,
      },
    });
    expect(validateStep(fixedBadFee, "fulfillment").map((i) => i.field)).toContain("flatShippingFee");

    // 'free_from': requires flatShippingFee (0..100M) and freeShippingThreshold (1..100M)
    const freeFromInvalid = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...baseFulfillment,
        shippingPricingMode: "free_from",
        flatShippingFee: 100_000_001,
        freeShippingThreshold: 0,
        minimumOrderActive: true,
        minimumOrderAmount: 0,
      },
    });
    const fields = validateStep(freeFromInvalid, "fulfillment").map((i) => i.field);
    expect(fields).toContain("flatShippingFee");
    expect(fields).toContain("freeShippingThreshold");
    expect(fields).toContain("minimumOrderAmount");

    // 'to_confirm': ignores flatShippingFee and freeShippingThreshold
    const toConfirmIgnored = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...baseFulfillment,
        shippingPricingMode: "to_confirm",
        flatShippingFee: Number.NaN,
        freeShippingThreshold: Number.NaN,
        minimumOrderActive: true,
        minimumOrderAmount: 1,
      },
    });
    expect(validateStep(toConfirmIgnored, "fulfillment")).toEqual([]);

    // Without delivery: ignores all delivery pricing and minimum order fields
    const pickupOnly = makeState({
      modalities: ["pickup"],
      fulfillment: {
        ...baseFulfillment,
        shippingPricingMode: "free_from",
        flatShippingFee: -10,
        freeShippingThreshold: 0,
        minimumOrderActive: true,
        minimumOrderAmount: 0,
      },
    });
    expect(validateStep(pickupOnly, "fulfillment")).toEqual([]);
  });

  it("validates freight risk threshold only when delivery is active and confirmation is not manual", () => {
    const baseFulfillment = createInitialConfigState("biz-1", "general").fulfillment;

    // Boundary valid values: 0 and 100_000_000
    for (const validAmount of [0, ORDERS_CONFIG_LIMITS.maxShippingCostRisk.max]) {
      const state = makeState({
        modalities: ["delivery"],
        fulfillment: {
          ...baseFulfillment,
          confirmationMode: "automatic",
          riskThresholdActive: true,
          maxShippingCostRisk: validAmount,
        },
      });
      expect(validateStep(state, "fulfillment")).toEqual([]);
    }

    // Invalid values: negative, above max, decimal, NaN, Infinity
    for (const invalidAmount of [-1, 100_000_001, 1500.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = makeState({
        modalities: ["delivery"],
        fulfillment: {
          ...baseFulfillment,
          confirmationMode: "agent",
          whatsappNumber: "+573001234567",
          riskThresholdActive: true,
          maxShippingCostRisk: invalidAmount,
        },
      });
      expect(validateStep(state, "fulfillment").some((i) => i.field === "maxShippingCostRisk")).toBe(true);
    }

    // Ignored when manual confirmation or delivery disabled
    const manualIgnored = makeState({
      modalities: ["delivery"],
      fulfillment: {
        ...baseFulfillment,
        confirmationMode: "manual",
        riskThresholdActive: true,
        maxShippingCostRisk: -500,
      },
    });
    expect(validateStep(manualIgnored, "fulfillment")).toEqual([]);

    const noDeliveryIgnored = makeState({
      modalities: ["pickup"],
      fulfillment: {
        ...baseFulfillment,
        confirmationMode: "automatic",
        riskThresholdActive: true,
        maxShippingCostRisk: Number.NaN,
      },
    });
    expect(validateStep(noDeliveryIgnored, "fulfillment")).toEqual([]);
  });

  it("validates payment methods non-empty and prepayment invariant requiring bank_transfer or payment_link", () => {
    const emptyMethods = makeState({
      payments: {
        ...createInitialConfigState("biz-1").payments,
        methods: [],
        requirePrepaymentBeforePrep: false,
      },
    });
    expect(validateStep(emptyMethods, "payments").map((i) => i.field)).toContain("methods");

    // Prepayment required with only cash_on_delivery / in_store must fail
    const invalidPrepayment = makeState({
      payments: {
        ...createInitialConfigState("biz-1").payments,
        methods: ["cash_on_delivery", "in_store"],
        requirePrepaymentBeforePrep: true,
      },
    });
    expect(validateStep(invalidPrepayment, "payments").map((i) => i.field)).toContain(
      "requirePrepaymentBeforePrep",
    );

    // Prepayment with bank_transfer or payment_link passes
    const withTransfer = makeState({
      payments: {
        ...createInitialConfigState("biz-1").payments,
        methods: ["bank_transfer"],
        requirePrepaymentBeforePrep: true,
      },
    });
    expect(validateStep(withTransfer, "payments")).toEqual([]);

    const withPaymentLink = makeState({
      payments: {
        ...createInitialConfigState("biz-1").payments,
        methods: ["cash_on_delivery", "payment_link"],
        requirePrepaymentBeforePrep: true,
      },
    });
    expect(validateStep(withPaymentLink, "payments")).toEqual([]);
  });

  it("enforces SLA bounds only for applicable fields and validates out-of-hours message", () => {
    const baseSla = createInitialConfigState("biz-1", "food").sla;

    const invalidPrepAndUrgency = makeState({
      sla: { ...baseSla, preparationMinutes: 0, urgencyThresholdMinutes: 10_081 },
    });
    const fields = validateStep(invalidPrepAndUrgency, "sla").map((i) => i.field);
    expect(fields).toContain("preparationMinutes");
    expect(fields).toContain("urgencyThresholdMinutes");

    // Confirmation SLA ignored in automatic mode, validated in manual/agent mode
    const autoMode = makeState({
      fulfillment: { ...createInitialConfigState("biz-1").fulfillment, confirmationMode: "automatic" },
      sla: { ...baseSla, confirmationMinutes: 0 },
    });
    expect(validateStep(autoMode, "sla")).toEqual([]);

    const manualModeBadConfirm = makeState({
      fulfillment: { ...createInitialConfigState("biz-1").fulfillment, confirmationMode: "manual" },
      sla: { ...baseSla, confirmationMinutes: 1_441 },
    });
    expect(validateStep(manualModeBadConfirm, "sla").map((i) => i.field)).toContain("confirmationMinutes");

    // Dispatch SLA ignored when delivery is inactive, validated when delivery is active
    const pickupOnly = makeState({
      modalities: ["pickup"],
      sla: { ...baseSla, dispatchMinutes: 0 },
    });
    expect(validateStep(pickupOnly, "sla")).toEqual([]);

    const deliveryBadDispatch = makeState({
      modalities: ["delivery"],
      sla: { ...baseSla, dispatchMinutes: 15.5 },
    });
    expect(validateStep(deliveryBadDispatch, "sla").map((i) => i.field)).toContain("dispatchMinutes");

    // Out-of-hours message required & capped at 500 chars when enabled
    const emptyAutoReply = makeState({
      sla: { ...baseSla, outOfHoursAutoReply: true, outOfHoursMessage: "   " },
    });
    expect(validateStep(emptyAutoReply, "sla").map((i) => i.field)).toContain("outOfHoursMessage");

    const tooLongAutoReply = makeState({
      sla: { ...baseSla, outOfHoursAutoReply: true, outOfHoursMessage: "a".repeat(501) },
    });
    expect(validateStep(tooLongAutoReply, "sla").map((i) => i.field)).toContain("outOfHoursMessage");

    const disabledAutoReply = makeState({
      sla: { ...baseSla, outOfHoursAutoReply: false, outOfHoursMessage: "" },
    });
    expect(validateStep(disabledAutoReply, "sla")).toEqual([]);
  });

  it("flags stored operators with empty stages in validateStep('operators')", () => {
    const state = makeState({
      operators: [
        {
          id: "op_empty",
          name: "Ana Lopez",
          email: "ana@necto.co",
          stages: [],
          role: "operator",
        },
      ],
    });
    const issues = validateStep(state, "operators");
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("operator:op_empty:stages");
  });
});

describe("validateOperatorInput", () => {
  const existing: OrderOperator[] = [
    {
      id: "op_1",
      name: "Laura Gomez",
      email: "laura@necto.co",
      phone: "+57 300 111 2233",
      stages: [...ALL_OPERATOR_STAGES],
      role: "operator",
    },
  ];

  it("validates name, email normalization, optional phone, and operator stages", () => {
    const validWithoutPhone = validateOperatorInput(
      { name: "  Carlos Perez  ", email: "  CARLOS@Necto.co  ", phone: "   " },
      existing,
    );
    expect(validWithoutPhone).toEqual({
      ok: true,
      value: { name: "Carlos Perez", email: "carlos@necto.co", stages: [...ALL_OPERATOR_STAGES] },
    });

    const validWithPhoneAndCustomStages = validateOperatorInput(
      {
        name: "Marta Diaz",
        email: "marta@necto.co",
        phone: "+57 (300) 123-4567",
        stages: ["dispatch", "confirmation"],
      },
      existing,
    );
    expect(validWithPhoneAndCustomStages).toEqual({
      ok: true,
      value: {
        name: "Marta Diaz",
        email: "marta@necto.co",
        phone: "+57 (300) 123-4567",
        stages: ["confirmation", "dispatch"],
      },
    });
  });

  it("rejects operators with zero assigned stages", () => {
    expect(
      validateOperatorInput({ name: "Camila", email: "camila@necto.co", stages: [] }, []),
    ).toMatchObject({ ok: false, field: "stages" });
  });

  it("rejects invalid name lengths", () => {
    expect(validateOperatorInput({ name: "A", email: "a@necto.co" }, [])).toMatchObject({ ok: false, field: "name" });
    expect(validateOperatorInput({ name: "A".repeat(81), email: "a@necto.co" }, [])).toMatchObject({
      ok: false,
      field: "name",
    });
  });

  it("rejects malformed emails and case-insensitive duplicates, while allowing self-edit", () => {
    expect(validateOperatorInput({ name: "Camila", email: "not-an-email" }, existing)).toMatchObject({
      ok: false,
      field: "email",
    });

    expect(validateOperatorInput({ name: "Other Laura", email: "LAURA@NECTO.CO" }, existing)).toMatchObject({
      ok: false,
      field: "email",
    });

    // Self-edit keeps own email cleanly
    expect(
      validateOperatorInput({ name: "Laura Updated", email: "LAURA@NECTO.CO", stages: ["preparation"] }, existing, "op_1"),
    ).toEqual({
      ok: true,
      value: { name: "Laura Updated", email: "laura@necto.co", stages: ["preparation"] },
    });
  });

  it("rejects invalid phones outside 7-15 digits or containing letters", () => {
    expect(validateOperatorInput({ name: "Camila", email: "c@necto.co", phone: "123456" }, [])).toMatchObject({
      ok: false,
      field: "phone",
    });
    expect(
      validateOperatorInput({ name: "Camila", email: "c@necto.co", phone: "1234567890123456" }, []),
    ).toMatchObject({ ok: false, field: "phone" });
    expect(validateOperatorInput({ name: "Camila", email: "c@necto.co", phone: "300-ABC-1234" }, [])).toMatchObject({
      ok: false,
      field: "phone",
    });
  });
});

describe("hydrateOrdersConfigState", () => {
  it("defensively hydrates legacy pre-Bloque-1 payloads missing payments, onSiteMode, delivery pricing, outOfHoursPolicy, and operator stages", () => {
    const legacyPayload = {
      businessId: "old-id",
      version: 3,
      step: "sla",
      status: "ready",
      profile: "fashion",
      modalities: ["delivery"],
      fulfillment: {
        confirmationMode: "agent",
        carriers: [
          { id: "servientrega", name: "Servientrega", enabled: false, isDefault: true },
          { id: "coordinadora", name: "Coordinadora", enabled: true, isDefault: false },
          { id: "interrapidisimo", name: "Inter Rapidísimo", enabled: true, isDefault: false },
        ],
      },
      sla: {
        preparationMinutes: 90,
      },
      operators: [{ name: "  Juan  ", email: "JUAN@TIENDA.CO", phone: "" }],
    };

    const hydrated = hydrateOrdersConfigState(legacyPayload, "biz-actual");

    expect(hydrated.businessId).toBe("biz-actual");
    expect(hydrated.version).toBe(3);
    expect(hydrated.step).toBe("sla");
    expect(hydrated.visitedSteps).toEqual(["profile", "modalities", "fulfillment", "payments", "sla"]);
    expect(hydrated.touched).toBe(true);
    expect(hydrated.status).toBe("ready");
    expect(hydrated.profile).toBe("fashion");
    expect(hydrated.modalities).toEqual(["delivery"]);
    expect(hydrated.onSiteMode).toBe(PROFILE_DEFAULTS.fashion.onSiteMode);

    // Missing fulfillment fields fall back to fashion profile defaults
    expect(hydrated.fulfillment.hasOwnCourier).toBe(false);
    expect(hydrated.fulfillment.pickupMode).toBe("fixed");
    expect(hydrated.fulfillment.confirmationMode).toBe("agent");
    expect(hydrated.fulfillment.whatsappNumber).toBe("");
    expect(hydrated.fulfillment.shippingPricingMode).toBe(PROFILE_DEFAULTS.fashion.fulfillment.shippingPricingMode);
    expect(hydrated.fulfillment.flatShippingFee).toBe(PROFILE_DEFAULTS.fashion.fulfillment.flatShippingFee);
    expect(hydrated.fulfillment.freeShippingThreshold).toBe(
      PROFILE_DEFAULTS.fashion.fulfillment.freeShippingThreshold,
    );
    expect(hydrated.fulfillment.minimumOrderActive).toBe(PROFILE_DEFAULTS.fashion.fulfillment.minimumOrderActive);
    expect(hydrated.fulfillment.minimumOrderAmount).toBe(PROFILE_DEFAULTS.fashion.fulfillment.minimumOrderAmount);

    // Missing payments backfilled cleanly from fashion profile defaults
    expect(hydrated.payments).toEqual(PROFILE_DEFAULTS.fashion.payments);

    // Carriers hydrated with full catalog and default promoted off disabled carrier
    expect(hydrated.fulfillment.carriers).toHaveLength(DEFAULT_CARRIERS.length);
    const servientrega = hydrated.fulfillment.carriers.find((c) => c.id === "servientrega");
    const coordinadora = hydrated.fulfillment.carriers.find((c) => c.id === "coordinadora");
    expect(servientrega?.enabled).toBe(false);
    expect(servientrega?.isDefault).toBe(false);
    expect(coordinadora?.enabled).toBe(true);
    expect(coordinadora?.isDefault).toBe(true);

    // Missing SLA fields (including outOfHoursPolicy) fall back to fashion defaults while keeping saved prep minutes
    expect(hydrated.sla.preparationMinutes).toBe(90);
    expect(hydrated.sla.outOfHoursPolicy).toBe(PROFILE_DEFAULTS.fashion.sla.outOfHoursPolicy);
    expect(hydrated.sla.outOfHoursAutoReply).toBe(true);
    expect(hydrated.sla.outOfHoursMessage.length).toBeGreaterThan(0);

    // Legacy operator normalized with generated id, omitted empty phone, and all 3 stages by default
    expect(hydrated.operators).toHaveLength(1);
    expect(hydrated.operators[0].id.startsWith("op_")).toBe(true);
    expect(hydrated.operators[0].name).toBe("Juan");
    expect(hydrated.operators[0].email).toBe("juan@tienda.co");
    expect(hydrated.operators[0].phone).toBeUndefined();
    expect(hydrated.operators[0].stages).toEqual([...ALL_OPERATOR_STAGES]);
  });

  it("preserves explicit visitedSteps from pre-Bloque-1 payloads without falsely marking payments visited", () => {
    const hydrated = hydrateOrdersConfigState(
      {
        businessId: "biz-1",
        version: 2,
        step: "sla",
        visitedSteps: ["profile", "modalities", "fulfillment", "sla"],
        status: "pending",
        profile: "food",
      },
      "biz-1",
    );
    expect(hydrated.visitedSteps).toEqual(["profile", "modalities", "fulfillment", "sla"]);
  });

  it("infers touched from legacy status and version when touched field is absent", () => {
    const legacyReady = hydrateOrdersConfigState(
      { businessId: "biz-1", version: 1, status: "ready", profile: "food" },
      "biz-1",
    );
    expect(legacyReady.touched).toBe(true);

    const legacyEdited = hydrateOrdersConfigState(
      { businessId: "biz-1", version: 2, status: "pending", profile: "food" },
      "biz-1",
    );
    expect(legacyEdited.touched).toBe(true);

    const legacyFresh = hydrateOrdersConfigState(
      { businessId: "biz-1", version: 1, status: "pending", profile: "food" },
      "biz-1",
    );
    expect(legacyFresh.touched).toBe(false);

    const explicitFalse = hydrateOrdersConfigState(
      { businessId: "biz-1", version: 3, status: "ready", touched: false, profile: "food" },
      "biz-1",
    );
    expect(explicitFalse.touched).toBe(false);
  });

  it("returns clean defaults for malformed or non-object payloads", () => {
    const fromNull = hydrateOrdersConfigState(null, "biz-2");
    expect(fromNull.businessId).toBe("biz-2");
    expect(fromNull.profile).toBe("food");
    expect(fromNull.visitedSteps).toEqual(["profile"]);
    expect(fromNull.touched).toBe(false);
    expect(fromNull.payments).toEqual(PROFILE_DEFAULTS.food.payments);
  });
});
