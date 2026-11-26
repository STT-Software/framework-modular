import { describe, expect, it } from "vitest";
import { OrdersStore } from "./stores/OrdersStore";
import { IncidentStore } from "./stores/IncidentStore";
import { PickupStore } from "./stores/PickupStore";
import { CatalogStore } from "./stores/CatalogStore";
import { ConversationsStore } from "./stores/ConversationsStore";
import {
  classifyIntention,
  computeConversationAnalytics,
  deriveCrmStage,
  derivePipelineStage,
  formatOrderNotificationMessage,
  phonesMatch,
} from "./domain/conversationsDomain";
import {
  getProfilePreset,
  readActiveBusinessProfile,
  writeActiveBusinessProfile,
} from "./domain/profilePresets";
import {
  DEFAULT_CARRIER_PREFERENCES,
  getDefaultCarrier,
  getEnabledCarriers,
  getFavoriteCarrier,
  setFavoriteCarrier,
  toggleCarrierEnabled,
} from "./domain/carrierSelection";
import {
  CATALOG_CATEGORIES,
  generateCatalogCsvTemplate,
  parseCatalogBulkText,
} from "./domain/catalogDomain";
import {
  buildAnalyticsCsv,
  computeAnalyticsKPIs,
  computeChannelBreakdown,
  computeModalityBreakdown,
  computePaymentStatusStats,
  presetToRange,
} from "./domain/analyticsUtils";
import {
  buildPaymentLink,
  buildPaymentMessage,
  generateQrSvgDataUrl,
} from "./domain/orderBilling";

describe("Pedidos operational stores and migrated StockFlow domain", () => {
  it("OrdersStore seeds orders, respects saveAddressToCrm, supports custom columns, payment links, real QR and delivery failure", () => {
    const store = new OrdersStore(`test-orders-${Date.now()}`);
    expect(store.orders.length).toBeGreaterThanOrEqual(15);
    expect(store.columns.length).toBe(5);
    expect(store.scheduledOrders.length).toBeGreaterThanOrEqual(1);

    const addedCol = store.addColumn("Empaque especial", "#6366F1");
    expect(addedCol.ok).toBe(true);
    expect(store.columns.length).toBe(6);

    const created = store.createOrder(
      {
        customerName: "Laura Gómez",
        customerPhone: "+57 310 555 1234",
        modality: "delivery",
        items: [{ id: "i1", name: "Combo Clásico", quantity: 2, unitPrice: 28000 }],
        extraCharges: [{ id: "e1", label: "Empaque térmico", amount: 3000 }],
        shippingFee: 7000,
        paymentMethod: "cash",
        paid: false,
        paidWith: 80000,
        carrier: "Envío propio",
        courierName: "Javier Moto 04",
        address: { street: "Calle 80 #15-20", city: "Bogotá", department: "Bogotá D.C." },
        saveAddressToCrm: false,
      },
      "Operador Test",
    );

    expect(created.subtotal).toBe(56000);
    expect(created.total).toBe(66000);
    expect(created.stage).toBe("new");
    expect(created.courierName).toBe("Javier Moto 04");
    expect(store.getCustomerAddresses("+57 310 555 1234").length).toBe(0);

    const paymentLink = buildPaymentLink(created, "https://app.necto.test", "biz-123");
    expect(paymentLink).toContain("/checkout?");
    expect(paymentLink).toContain(`total=${created.total}`);
    expect(paymentLink).toContain("org=biz-123");

    const msg = buildPaymentMessage(created, "Negocio Test", "https://app.necto.test", "biz-123");
    expect(msg).toContain(created.code);
    expect(generateQrSvgDataUrl(paymentLink)).toMatch(/^data:image\/svg\+xml/);

    store.togglePaid(created.id, "Operador Test");
    expect(store.byId(created.id)?.paid).toBe(true);

    const failed = store.recordDeliveryFailure(
      created.id,
      "Destinatario no contesta",
      "Se llamó tres veces",
      "retry",
      "Operador Test",
    );
    expect(failed?.stage).toBe("ready");
    expect(failed?.notes).toContain("[Novedad Logística");
  });

  it("carrierSelection supports nullable favoriteId and safe fallback when all carriers are toggled off", () => {
    let prefs = DEFAULT_CARRIER_PREFERENCES;
    expect(getEnabledCarriers(prefs).length).toBeGreaterThan(1);
    expect(getFavoriteCarrier(prefs)?.id).toBe("coordinadora");

    const toggledFav = toggleCarrierEnabled(prefs, "coordinadora");
    expect(toggledFav.ok).toBe(true);
    if (toggledFav.ok) {
      prefs = toggledFav.value;
      expect(prefs.favoriteId).toBeNull();
      expect(getFavoriteCarrier(prefs)).toBeNull();
    }

    const withFav = setFavoriteCarrier(prefs, "tcc");
    expect(withFav.favoriteId).toBe("tcc");
    expect(withFav.enabledIds).toContain("tcc");

    const clearedFav = setFavoriteCarrier(withFav, null);
    expect(clearedFav.favoriteId).toBeNull();

    const emptyDisabled = toggleCarrierEnabled({ enabledIds: ["tcc"], favoriteId: "tcc" }, "tcc");
    expect(emptyDisabled.ok).toBe(true);
    if (emptyDisabled.ok) {
      expect(getDefaultCarrier(emptyDisabled.value)).toBeDefined();
    }
  });

  it("IncidentStore groups by tracking number and PickupStore manages schedules", () => {
    const incidents = new IncidentStore(`test-inc-${Date.now()}`);
    expect(incidents.incidents.length).toBeGreaterThanOrEqual(8);
    const grouped = incidents.byTracking("50000112926");
    expect(grouped.length).toBeGreaterThanOrEqual(2);

    const pickups = new PickupStore(`test-pick-${Date.now()}`);
    expect(pickups.pickups.length).toBeGreaterThanOrEqual(8);
    expect(pickups.schedules.length).toBeGreaterThanOrEqual(4);
  });

  it("CatalogStore uses StockFlow 11 universal categories, tracks dirty state, parses bulk import and publishes cleanly", async () => {
    expect(CATALOG_CATEGORIES).toContain("Salud, belleza y cuidado personal");
    expect(CATALOG_CATEGORIES).toContain("Tecnología y electrodomésticos");
    expect(CATALOG_CATEGORIES.length).toBe(11);

    const template = generateCatalogCsvTemplate();
    const parsedCsv = parseCatalogBulkText(template);
    expect(parsedCsv.length).toBe(3);

    const parsedText = parseCatalogBulkText(
      "Audífonos Inalámbricos Pro - $120.000 - Tecnología y electrodomésticos - Cancelación activa",
    );
    expect(parsedText.length).toBe(1);
    expect(parsedText[0].price).toBe(120000);

    const catalog = new CatalogStore(`test-cat-${Date.now()}`);
    expect(catalog.products.length).toBe(6);
    expect(catalog.loadDemoProducts()).toBe(0);
    expect(catalog.hasPendingChanges).toBe(false);

    const imported = catalog.bulkImport(
      "Audífonos Inalámbricos Pro - $120.000 - Tecnología y electrodomésticos - Cancelación activa",
    );
    expect(imported.ok).toBe(true);
    expect(catalog.products.length).toBe(7);
    expect(catalog.hasPendingChanges).toBe(true);

    await catalog.saveAndPublish();
    expect(catalog.hasPendingChanges).toBe(false);
    expect(catalog.publishedSuccess).toBe(true);
  });

  it("analyticsUtils computes KPIs, 100%-sum breakdowns, payment stats and 8-column CSV", () => {
    const store = new OrdersStore(`test-ana-${Date.now()}`);
    const kpis = computeAnalyticsKPIs(store.orders);
    expect(kpis.totalOrders).toBe(store.orders.length);
    expect(kpis.revenue).toBeGreaterThan(0);

    const channels = computeChannelBreakdown(store.orders);
    expect(channels.reduce((sum, item) => sum + item.percentage, 0)).toBe(100);

    const modalities = computeModalityBreakdown(store.orders);
    expect(modalities.reduce((sum, item) => sum + item.percentage, 0)).toBe(100);

    const payment = computePaymentStatusStats(store.orders);
    expect(payment.paidPercent + payment.pendingPercent).toBe(100);

    const range = presetToRange("7d");
    expect(range.start).toBeTruthy();

    const csv = buildAnalyticsCsv(store.orders);
    expect(csv.startsWith("\uFEFFID Pedido,Cliente,Teléfono,Canal,Modalidad,Monto Total,Estado,Fecha")).toBe(true);
  });

  it("ConversationsStore excludes closed/delivered orders from pipeline, tracks CRM stages, handoff and order notifications", () => {
    const ordersStore = new OrdersStore(`test-conv-orders-${Date.now()}`);
    const convStore = new ConversationsStore(`test-conv-${Date.now()}`, ordersStore.orders);

    expect(convStore.conversations.length).toBeGreaterThanOrEqual(15);
    const firstOrder = ordersStore.byCode("P-001")!;
    expect(firstOrder).toBeDefined();
    const linkedConv = convStore.byPhone(firstOrder.customerPhone);
    expect(linkedConv).toBeDefined();
    expect(phonesMatch(firstOrder.customerPhone, linkedConv!.contact.phone)).toBe(true);

    // Intention & pipeline derivation
    const intention = classifyIntention(linkedConv!, [firstOrder]);
    expect(["inquire", "buy", "track_order", "claim"]).toContain(intention);

    // Active new order enters the commercial pipeline and accepts manual override
    const openConv = { ...linkedConv!, status: "open" as const };
    const newOrder = { ...firstOrder, stage: "new" as const, paid: false, paymentMethod: "cash" as const };
    const autoStage = derivePipelineStage(openConv, [newOrder]);
    expect(autoStage).toBe("closing");
    if (autoStage) {
      convStore.setPipelineStageOverride(openConv.id, "offer_sent", autoStage);
      expect(convStore.effectivePipelineStage(openConv, [newOrder])).toBe("offer_sent");
    }

    // Delivered-only or cancelled-only contacts leave the sales pipeline (return null)
    const deliveredOrder = { ...firstOrder, stage: "delivered" as const };
    expect(derivePipelineStage(openConv, [deliveredOrder])).toBeNull();
    expect(convStore.effectivePipelineStage(openConv, [deliveredOrder])).toBeNull();

    // CRM stages work independently from pipeline stages
    expect(["new", "in_conversation", "interested", "customer", "lost"]).toContain(
      deriveCrmStage(linkedConv!, [firstOrder]),
    );
    convStore.setCrmStageOverride(linkedConv!.id, "customer");
    expect(convStore.isCrmManual(linkedConv!.id)).toBe(true);
    expect(convStore.effectiveCrmStage(linkedConv!, [firstOrder])).toBe("customer");
    convStore.resetCrmStageOverride(linkedConv!.id);
    expect(convStore.isCrmManual(linkedConv!.id)).toBe(false);

    // Agent reply auto-takes over when in bot mode + internal notes stay private
    convStore.returnToBot(linkedConv!.id);
    expect(convStore.byId(linkedConv!.id)?.attentionMode).toBe("bot");
    const sent = convStore.sendAgentMessage(linkedConv!.id, "Hola, ya reviso tu pedido", "op-1", "Carlos");
    expect(sent.ok).toBe(true);
    expect(convStore.byId(linkedConv!.id)?.attentionMode).toBe("human");

    const note = convStore.addInternalNote(linkedConv!.id, "Cliente VIP verificar empaque", "Carlos");
    expect(note.ok).toBe(true);

    // Pedidos -> Conversaciones notification appends bot message with orderId
    const beforeCount = convStore.byId(linkedConv!.id)!.messages.length;
    convStore.notifyOrderEvent(firstOrder, "in_transit", "Negocio Test");
    const updated = convStore.byId(linkedConv!.id)!;
    expect(updated.messages.length).toBe(beforeCount + 1);
    expect(updated.messages[updated.messages.length - 1].orderId).toBe(firstOrder.id);

    // Analytics summary
    const summary = computeConversationAnalytics(convStore.conversations, ordersStore.orders, "month");
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.sentiment.positive + summary.sentiment.neutral + summary.sentiment.negative).toBe(summary.total);
  });

  it("switches business profile end-to-end across CatalogStore, OrdersStore labels, WhatsApp copy and profile storage without losing orders", () => {
    const bizId = `test-profile-switch-${Date.now()}`;

    // 1. Start on food profile
    writeActiveBusinessProfile(bizId, "food");
    expect(readActiveBusinessProfile(bizId)).toBe("food");

    const catalog = new CatalogStore(bizId, "food");
    const orders = new OrdersStore(bizId, "food");
    expect(catalog.profile).toBe("food");
    expect(catalog.products.length).toBe(6);
    expect(catalog.products.some((p) => p.category === "Pizzas")).toBe(true);
    expect(orders.columns.find((c) => c.id === "preparing")?.label).toBe("En cocina");

    // Create a custom order and custom column before switching profiles
    orders.addColumn("Control de calidad", "#6366F1");
    const createdOrder = orders.createOrder(
      {
        customerName: "Camila Ruiz",
        customerPhone: "+57 312 444 9988",
        modality: "delivery",
        items: [{ name: "Pizza BBQ Artesanal", quantity: 1, unitPrice: 32000 }],
        paymentMethod: "transfer",
        paid: true,
      },
      "Admin",
    );
    const totalOrdersBeforeSwitch = orders.orders.length;

    // 2. Switch to fashion profile -> variants on catalog + fashion stage labels + historical orders preserved
    catalog.applyProfile("fashion");
    orders.applyProfileLabels("fashion");
    expect(readActiveBusinessProfile(bizId)).toBe("fashion");
    expect(catalog.profile).toBe("fashion");
    expect(catalog.products.length).toBe(6);
    expect(catalog.products.some((p) => Array.isArray(p.variants) && p.variants.includes("M"))).toBe(true);
    expect(orders.columns.find((c) => c.id === "preparing")?.label).toBe("Empacando pedido");
    expect(orders.columns.find((c) => c.id === "ready")?.label).toBe("Listo para despacho");
    expect(orders.columns.find((c) => c.id === "in_transit")?.label).toBe("Despachado");
    expect(orders.columns.some((c) => c.label === "Control de calidad")).toBe(true);
    expect(orders.orders.length).toBe(totalOrdersBeforeSwitch);
    expect(orders.byId(createdOrder.id)).toBeDefined();

    // Verify WhatsApp notification wording adapts to profile
    expect(
      formatOrderNotificationMessage("preparing", createdOrder, "Tienda Moda", "fashion"),
    ).toContain("empacando");
    expect(
      formatOrderNotificationMessage("preparing", createdOrder, "Bistro Oliva", "food"),
    ).toContain("cocina");

    // 3. Switch to services profile -> services catalog + services stage labels + orders still intact
    catalog.applyProfile("services");
    orders.applyProfileLabels("services");
    expect(readActiveBusinessProfile(bizId)).toBe("services");
    expect(catalog.profile).toBe("services");
    expect(catalog.products.some((p) => p.category === "Estilismo")).toBe(true);
    expect(orders.columns.find((c) => c.id === "preparing")?.label).toBe("En atención");
    expect(orders.columns.find((c) => c.id === "ready")?.label).toBe("Por finalizar");
    expect(orders.columns.find((c) => c.id === "in_transit")?.label).toBe("En curso");
    expect(orders.orders.length).toBe(totalOrdersBeforeSwitch);
    expect(orders.byId(createdOrder.id)).toBeDefined();
    expect(getProfilePreset("services").storefront.ctaLabel).toBe("Solicitar servicio");
  });
});
