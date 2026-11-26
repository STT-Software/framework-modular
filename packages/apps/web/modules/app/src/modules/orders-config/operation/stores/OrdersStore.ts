import { makeAutoObservable } from "mobx";
import type { OrderOperatorStage, OrdersProfileId } from "../../types";
import type { Carrier } from "../domain/carrierDirectory";
import {
  getProfilePreset,
  readActiveBusinessProfile,
} from "../domain/profilePresets";
import {
  getDefaultCarrier,
  getEnabledCarriers,
  getFavoriteCarrier,
  loadCarrierPreferences,
  saveCarrierPreferences,
  type CarrierPreferences,
} from "../domain/carrierSelection";
import {
  formatDeliveryIncidentNote,
  type DeliveryFailureOutcome,
} from "../domain/incidentDomain";
import {
  canOperatorMoveTo,
  createSeedOrders,
  DEFAULT_ACTIVE_COLUMNS,
  formatCOP,
  nextStageFor,
  STAGE_LABELS,
  type CreateOrderInput,
  type Order,
  type OrderAddress,
  type OrderColumn,
  type OrderExtraCharge,
  type OrderItem,
  type OrderStage,
  type SavedCustomerAddress,
} from "../domain/order";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or restricted-mode errors.
  }
}

function seedAddressesFromOrders(orders: Order[]): SavedCustomerAddress[] {
  const seen = new Set<string>();
  const results: SavedCustomerAddress[] = [];
  for (const order of orders) {
    if (order.modality !== "delivery" || !order.address?.street) continue;
    const key = `${normalizePhone(order.customerPhone)}|${order.address.street.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      id: `addr-seed-${results.length + 1}`,
      phone: order.customerPhone,
      customerName: order.customerName,
      address: { ...order.address },
      updatedAt: order.updatedAt,
    });
  }
  return results;
}

const CUSTOM_COLUMN_COLORS = [
  "#0EA5E9",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
  "#F97316",
  "#84CC16",
];

export class OrdersStore {
  orders: Order[] = [];
  columns: OrderColumn[] = [];
  savedAddresses: SavedCustomerAddress[] = [];
  carrierPreferences: CarrierPreferences;

  private readonly businessId: string;

  constructor(businessId: string, profile?: OrdersProfileId) {
    this.businessId = businessId || "default";
    this.carrierPreferences = loadCarrierPreferences(this.businessId);

    makeAutoObservable<OrdersStore, "businessId">(this, {
      businessId: false,
    });

    this.load();
    this.applyProfileLabels(profile ?? readActiveBusinessProfile(this.businessId));
  }

  applyProfileLabels(profile: OrdersProfileId): void {
    const stageLabels = getProfilePreset(profile).stageLabels;
    let changed = false;
    for (const column of this.columns) {
      if (!column.isDefault) continue;
      if (
        column.id === "preparing" ||
        column.id === "ready" ||
        column.id === "in_transit"
      ) {
        const nextLabel = stageLabels[column.id];
        if (nextLabel && column.label !== nextLabel) {
          column.label = nextLabel;
          changed = true;
        }
      }
    }
    if (changed) {
      this.persistColumns();
    }
  }

  private get ordersKey(): string {
    return `necto.pedidos.orders.${this.businessId}`;
  }

  private get columnsKey(): string {
    return `necto.pedidos.columns.${this.businessId}`;
  }

  private get addressesKey(): string {
    return `necto.pedidos.addresses.${this.businessId}`;
  }

  private load(): void {
    const storedColumns = readStorage<OrderColumn[]>(this.columnsKey);
    this.columns =
      Array.isArray(storedColumns) && storedColumns.length > 0
        ? storedColumns
        : DEFAULT_ACTIVE_COLUMNS.map((col) => ({ ...col }));

    const storedOrders = readStorage<Order[]>(this.ordersKey);
    if (Array.isArray(storedOrders)) {
      this.orders = storedOrders;
    } else {
      this.orders = createSeedOrders();
      writeStorage(this.ordersKey, this.orders);
    }

    const storedAddresses = readStorage<SavedCustomerAddress[]>(this.addressesKey);
    if (Array.isArray(storedAddresses)) {
      this.savedAddresses = storedAddresses;
    } else {
      this.savedAddresses = seedAddressesFromOrders(this.orders);
      writeStorage(this.addressesKey, this.savedAddresses);
    }

    if (!Array.isArray(storedColumns) || storedColumns.length === 0) {
      writeStorage(this.columnsKey, this.columns);
    }
  }

  private persistOrders(): void {
    writeStorage(this.ordersKey, this.orders);
  }

  private persistColumns(): void {
    writeStorage(this.columnsKey, this.columns);
  }

  private persistAddresses(): void {
    writeStorage(this.addressesKey, this.savedAddresses);
  }

  private nextOrderCode(): string {
    const highest = this.orders.reduce((max, order) => {
      const numeric = Number(order.code.replace(/\D/g, ""));
      return Number.isFinite(numeric) && numeric > max ? numeric : max;
    }, 0);
    return `P-${String(highest + 1).padStart(3, "0")}`;
  }

  private stageLabel(stage: OrderStage): string {
    const column = this.columns.find((col) => col.id === stage);
    if (column) return column.label;
    return STAGE_LABELS[stage] ?? stage;
  }

  private buildAutomationForStage(order: Order, stage: OrderStage): string | null {
    const firstName = order.customerName.trim().split(/\s+/)[0] || "cliente";
    switch (stage) {
      case "confirmed":
        return `Hola ${firstName}, tu pedido ${order.code} fue confirmado y pronto pasará a preparación.`;
      case "preparing":
        return `¡Manos a la obra! Estamos preparando tu pedido ${order.code}.`;
      case "ready":
        return order.modality === "pickup"
          ? `Tu pedido ${order.code} ya está listo para recoger en tienda.`
          : `Tu pedido ${order.code} está listo para despacho.`;
      case "in_transit":
        return order.carrier && order.trackingNumber
          ? `Tu pedido ${order.code} va en camino con ${order.carrier} (guía ${order.trackingNumber}).`
          : `Tu pedido ${order.code} va en camino hacia tu dirección.`;
      case "delivered":
        return `¡Pedido ${order.code} entregado! Gracias por comprar con nosotros.`;
      case "cancelled":
        return `Tu pedido ${order.code} fue cancelado. Si necesitas ayuda, escríbenos por este chat.`;
      default:
        return null;
    }
  }

  // -------------------------------------------------------------------------
  // Computed views
  // -------------------------------------------------------------------------

  get scheduledOrders(): Order[] {
    return this.orders
      .filter(
        (order) =>
          Boolean(order.scheduledFor) &&
          order.stage !== "delivered" &&
          order.stage !== "cancelled",
      )
      .sort((a, b) =>
        (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""),
      );
  }

  get activeOrders(): Order[] {
    return this.orders.filter(
      (order) =>
        !order.scheduledFor &&
        order.stage !== "delivered" &&
        order.stage !== "cancelled",
    );
  }

  get closedOrders(): Order[] {
    return this.orders.filter(
      (order) => order.stage === "delivered" || order.stage === "cancelled",
    );
  }

  get enabledCarriers(): Carrier[] {
    return getEnabledCarriers(this.carrierPreferences);
  }

  get favoriteCarrier(): Carrier | null {
    return getFavoriteCarrier(this.carrierPreferences);
  }

  get defaultCarrier(): Carrier {
    return getDefaultCarrier(this.carrierPreferences);
  }

  // -------------------------------------------------------------------------
  // Lookups
  // -------------------------------------------------------------------------

  byId(id: string): Order | undefined {
    return this.orders.find((order) => order.id === id);
  }

  byCode(code: string): Order | undefined {
    const needle = code.trim().toLowerCase();
    return this.orders.find((order) => order.code.trim().toLowerCase() === needle);
  }

  // -------------------------------------------------------------------------
  // Order mutations
  // -------------------------------------------------------------------------

  createOrder(input: CreateOrderInput, operatorName: string): Order {
    const nowIso = new Date().toISOString();
    const code = this.nextOrderCode();
    const id = makeId("ord");
    const actor = operatorName.trim() || "Operador";

    const items: OrderItem[] = input.items.map((item) => ({
      ...item,
      id: item.id ?? makeId("item"),
      name: item.name.trim(),
      quantity: Math.max(1, Math.round(item.quantity)),
      unitPrice: Math.max(0, Math.round(item.unitPrice)),
    }));

    const extraCharges: OrderExtraCharge[] = (input.extraCharges ?? [])
      .filter((charge) => charge.label.trim().length > 0 && charge.amount !== 0)
      .map((charge) => ({
        id: charge.id ?? makeId("extra"),
        label: charge.label.trim(),
        amount: Math.round(charge.amount),
      }));

    const shippingFee =
      input.modality === "delivery"
        ? Math.max(0, Math.round(input.shippingFee ?? 0))
        : 0;
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const extrasTotal = extraCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const total = subtotal + shippingFee + extrasTotal;

    const scheduledFor =
      input.scheduledFor && !Number.isNaN(new Date(input.scheduledFor).getTime())
        ? new Date(input.scheduledFor).toISOString()
        : null;

    const initialStage: OrderStage = scheduledFor
      ? "new"
      : input.confirmOnCreate
        ? "confirmed"
        : "new";

    const channel = input.channel ?? "operator";
    const statusHistory = [
      {
        id: makeId("ev"),
        stage: "new" as OrderStage,
        label: this.stageLabel("new"),
        at: nowIso,
        operator: actor,
        ...(scheduledFor ? { note: `Programado para ${scheduledFor}` } : {}),
      },
    ];

    if (initialStage === "confirmed") {
      statusHistory.push({
        id: makeId("ev"),
        stage: "confirmed",
        label: this.stageLabel("confirmed"),
        at: nowIso,
        operator: actor,
      });
    }

    const firstName = input.customerName.trim().split(/\s+/)[0] || "cliente";
    const automations = [
      {
        id: makeId("wa"),
        channel: "whatsapp" as const,
        event: scheduledFor ? "Pedido programado" : "Pedido recibido",
        message: scheduledFor
          ? `Hola ${firstName}, programamos tu pedido ${code} por ${formatCOP(total)}.`
          : `Hola ${firstName}, recibimos tu pedido ${code} por ${formatCOP(total)}.`,
        sentAt: nowIso,
        status: "sent" as const,
      },
    ];

    const operatorTrail = [
      {
        id: makeId("aud"),
        operator: actor,
        action: scheduledFor
          ? `Pedido ${code} programado (${formatCOP(total)})`
          : `Pedido ${code} creado (${formatCOP(total)})`,
        at: nowIso,
      },
    ];

    const cleanAddress =
      input.modality === "delivery" && input.address?.street?.trim()
        ? {
            street: input.address.street.trim(),
            neighborhood: input.address.neighborhood?.trim() || undefined,
            reference: input.address.reference?.trim() || undefined,
            department: input.address.department?.trim() || undefined,
            city: input.address.city?.trim() || undefined,
            notes: input.address.notes?.trim() || undefined,
          }
        : undefined;

    const order: Order = {
      id,
      code,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      items,
      extraCharges,
      shippingFee,
      subtotal,
      total,
      modality: input.modality,
      table: input.modality === "onsite" ? input.table?.trim() || undefined : undefined,
      address: cleanAddress,
      carrier: input.modality === "delivery" ? input.carrier?.trim() || undefined : undefined,
      courierName:
        input.modality === "delivery" ? input.courierName?.trim() || undefined : undefined,
      trackingNumber:
        input.modality === "delivery" ? input.trackingNumber?.trim() || undefined : undefined,
      paymentMethod: input.paymentMethod,
      paid: Boolean(input.paid),
      paidWith:
        input.paymentMethod === "cash" && input.paidWith && input.paidWith > 0
          ? Math.round(input.paidWith)
          : undefined,
      channel,
      stage: initialStage,
      scheduledFor,
      notes: input.notes?.trim() || undefined,
      urgent: Boolean(input.urgent),
      createdAt: nowIso,
      updatedAt: nowIso,
      statusHistory,
      automations,
      operatorTrail,
    };

    this.orders.unshift(order);
    this.persistOrders();

    if (cleanAddress && order.customerPhone && input.saveAddressToCrm !== false) {
      this.saveCustomerAddress(order.customerPhone, order.customerName, cleanAddress);
    }

    return order;
  }

  moveOrder(
    orderId: string,
    toStage: OrderStage,
    operatorName: string,
    allowedStages?: OrderOperatorStage[],
  ): { ok: boolean; error?: string } {
    const order = this.byId(orderId);
    if (!order) {
      return { ok: false, error: "El pedido ya no existe." };
    }

    if (allowedStages && !canOperatorMoveTo(toStage, allowedStages)) {
      return {
        ok: false,
        error: "No tienes permiso para mover pedidos a esta etapa.",
      };
    }

    if (order.stage === toStage && !order.scheduledFor) {
      return { ok: true };
    }

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";
    const label = this.stageLabel(toStage);

    order.stage = toStage;
    order.scheduledFor = null;
    order.updatedAt = nowIso;
    if (toStage === "delivered") {
      order.deliveredAt = nowIso;
    }

    order.statusHistory.push({
      id: makeId("ev"),
      stage: toStage,
      label,
      at: nowIso,
      operator: actor,
    });

    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: `Movido a ${label}`,
      at: nowIso,
    });

    const autoMsg = this.buildAutomationForStage(order, toStage);
    if (autoMsg) {
      order.automations.push({
        id: makeId("wa"),
        channel: "whatsapp",
        event: label,
        message: autoMsg,
        sentAt: nowIso,
        status: "sent",
      });
    }

    this.persistOrders();
    return { ok: true };
  }

  advanceOrder(
    orderId: string,
    operatorName: string,
    allowedStages?: OrderOperatorStage[],
  ): { ok: boolean; error?: string } {
    const order = this.byId(orderId);
    if (!order) {
      return { ok: false, error: "El pedido ya no existe." };
    }

    let next = nextStageFor(order.stage, this.columns);
    if (next === "in_transit" && order.modality !== "delivery") {
      next = "delivered";
    }
    if (!next) {
      return { ok: false, error: "Este pedido ya está en un estado final." };
    }

    return this.moveOrder(orderId, next, operatorName, allowedStages);
  }

  togglePaid(orderId: string, operatorName: string): void {
    const order = this.byId(orderId);
    if (!order) return;

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";
    order.paid = !order.paid;
    order.updatedAt = nowIso;
    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: order.paid ? "Marcado como pagado" : "Marcado como pendiente de pago",
      at: nowIso,
    });
    this.persistOrders();
  }

  updateCarrierAndTracking(
    orderId: string,
    carrier: string,
    trackingNumber: string,
    operatorName: string,
    courierName?: string,
  ): void {
    const order = this.byId(orderId);
    if (!order) return;

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";
    const cleanCarrier = carrier.trim();
    const cleanTracking = trackingNumber.trim();
    const cleanCourier = courierName !== undefined ? courierName.trim() : undefined;

    order.carrier = cleanCarrier || undefined;
    order.trackingNumber = cleanTracking || undefined;
    if (courierName !== undefined) {
      order.courierName = cleanCourier || undefined;
    } else if (cleanCarrier && cleanCarrier.toLowerCase() !== "envío propio" && cleanCarrier.toLowerCase() !== "envio propio") {
      order.courierName = undefined;
    }
    order.updatedAt = nowIso;

    const details = [
      `Transportadora actualizada: ${cleanCarrier || "Sin definir"}`,
      order.courierName ? `Domiciliario ${order.courierName}` : null,
      cleanTracking ? `Guía ${cleanTracking}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: details,
      at: nowIso,
    });
    this.persistOrders();
  }

  unassignCarrier(orderId: string, operatorName: string): void {
    const order = this.byId(orderId);
    if (!order) return;

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";
    const previous = order.carrier;

    order.carrier = undefined;
    order.courierName = undefined;
    order.trackingNumber = undefined;
    order.updatedAt = nowIso;
    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: previous
        ? `Desasignada transportadora ${previous} y guía`
        : "Transportadora y guía desasignadas",
      at: nowIso,
    });
    this.persistOrders();
  }

  scheduleOrder(
    orderId: string,
    scheduledForIso: string,
    operatorName: string,
  ): void {
    const order = this.byId(orderId);
    if (!order) return;
    const parsed = new Date(scheduledForIso);
    if (Number.isNaN(parsed.getTime())) return;

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";
    const iso = parsed.toISOString();

    order.scheduledFor = iso;
    order.stage = "new";
    order.updatedAt = nowIso;
    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: `Reprogramado para ${parsed.toLocaleString("es-CO")}`,
      at: nowIso,
    });
    this.persistOrders();
  }

  activateScheduledOrder(orderId: string, operatorName: string): void {
    const order = this.byId(orderId);
    if (!order || !order.scheduledFor) return;

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";

    order.scheduledFor = null;
    order.stage = "new";
    order.updatedAt = nowIso;
    order.statusHistory.push({
      id: makeId("ev"),
      stage: "new",
      label: this.stageLabel("new"),
      at: nowIso,
      operator: actor,
      note: "Activado desde pedidos programados",
    });
    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: "Pedido programado activado manualmente en el tablero",
      at: nowIso,
    });
    this.persistOrders();
  }

  cancelOrder(orderId: string, reason: string, operatorName: string): void {
    const order = this.byId(orderId);
    if (!order) return;

    const nowIso = new Date().toISOString();
    const actor = operatorName.trim() || "Operador";
    const cleanReason = reason.trim() || "Cancelado por operador";

    order.stage = "cancelled";
    order.scheduledFor = null;
    order.cancellationReason = cleanReason;
    order.updatedAt = nowIso;

    order.statusHistory.push({
      id: makeId("ev"),
      stage: "cancelled",
      label: STAGE_LABELS.cancelled,
      at: nowIso,
      operator: actor,
      note: cleanReason,
    });

    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: `Pedido cancelado: ${cleanReason}`,
      at: nowIso,
    });

    const autoMsg = this.buildAutomationForStage(order, "cancelled");
    if (autoMsg) {
      order.automations.push({
        id: makeId("wa"),
        channel: "whatsapp",
        event: "Pedido cancelado",
        message: autoMsg,
        sentAt: nowIso,
        status: "sent",
      });
    }

    this.persistOrders();
  }

  bulkCancelOrders(
    orderIds: string[],
    reason: string,
    operatorName: string,
  ): void {
    const uniqueIds = Array.from(new Set(orderIds));
    for (const id of uniqueIds) {
      this.cancelOrder(id, reason, operatorName);
    }
  }

  deliverOrder(orderId: string, operatorName: string): void {
    this.moveOrder(orderId, "delivered", operatorName);
  }

  recordDeliveryFailure(
    orderId: string,
    motiveLabel: string,
    detail: string,
    outcome: DeliveryFailureOutcome,
    operatorName: string,
  ): Order | undefined {
    const order = this.byId(orderId);
    if (!order) return undefined;

    const now = new Date();
    const nowIso = now.toISOString();
    const actor = operatorName.trim() || "Operador";
    const noteLine = formatDeliveryIncidentNote(motiveLabel, detail, outcome, now);
    const existingNotes = (order.notes ?? "").trim();

    order.notes = existingNotes ? `${existingNotes}\n${noteLine}` : noteLine;
    order.scheduledFor = null;
    order.updatedAt = nowIso;

    if (outcome === "cancel") {
      order.stage = "cancelled";
      order.cancellationReason = detail.trim()
        ? `${motiveLabel}: ${detail.trim()}`
        : motiveLabel;
    } else {
      order.stage = "ready";
      order.urgent = true;
    }

    const label = this.stageLabel(order.stage);
    order.statusHistory.push({
      id: makeId("ev"),
      stage: order.stage,
      label,
      at: nowIso,
      operator: actor,
      note: noteLine,
    });

    order.operatorTrail.push({
      id: makeId("aud"),
      operator: actor,
      action: `Novedad de entrega registrada (${motiveLabel})`,
      at: nowIso,
    });

    this.persistOrders();
    return order;
  }

  // -------------------------------------------------------------------------
  // Board column management
  // -------------------------------------------------------------------------

  addColumn(label: string, color?: string): { ok: boolean; error?: string } {
    const clean = label.trim();
    if (!clean) {
      return { ok: false, error: "Escribe un nombre para la columna." };
    }
    if (
      this.columns.some(
        (col) => col.label.trim().toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return { ok: false, error: "Ya existe una columna con ese nombre." };
    }

    const slug = clean
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const id = `col_${slug || "etapa"}_${Date.now().toString(36).slice(-4)}`;
    const chosenColor =
      color?.trim() ||
      CUSTOM_COLUMN_COLORS[this.columns.length % CUSTOM_COLUMN_COLORS.length];

    this.columns.push({
      id,
      label: clean,
      color: chosenColor,
      isDefault: false,
    });
    this.persistColumns();
    return { ok: true };
  }

  renameColumn(
    columnId: string,
    label: string,
  ): { ok: boolean; error?: string } {
    const clean = label.trim();
    if (!clean) {
      return { ok: false, error: "El nombre de la columna no puede quedar vacío." };
    }
    const column = this.columns.find((col) => col.id === columnId);
    if (!column) {
      return { ok: false, error: "La columna ya no existe." };
    }
    if (
      this.columns.some(
        (col) =>
          col.id !== columnId &&
          col.label.trim().toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return { ok: false, error: "Ya existe otra columna con ese nombre." };
    }

    column.label = clean;
    this.persistColumns();
    return { ok: true };
  }

  moveColumn(columnId: string, direction: "left" | "right"): void {
    const index = this.columns.findIndex((col) => col.id === columnId);
    if (index === -1) return;
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= this.columns.length) return;

    const updated = [...this.columns];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    this.columns = updated;
    this.persistColumns();
  }

  deleteColumn(columnId: string): { ok: boolean; error?: string } {
    const column = this.columns.find((col) => col.id === columnId);
    if (!column) {
      return { ok: false, error: "La columna ya no existe." };
    }
    if (column.isDefault) {
      return {
        ok: false,
        error: "Las columnas predeterminadas del flujo no se pueden eliminar.",
      };
    }

    const nowIso = new Date().toISOString();
    let movedAny = false;
    for (const order of this.orders) {
      if (order.stage === columnId) {
        order.stage = "new";
        order.updatedAt = nowIso;
        order.operatorTrail.push({
          id: makeId("aud"),
          operator: "Sistema",
          action: `Movido a Nuevo al eliminar la columna «${column.label}»`,
          at: nowIso,
        });
        movedAny = true;
      }
    }

    this.columns = this.columns.filter((col) => col.id !== columnId);
    this.persistColumns();
    if (movedAny) {
      this.persistOrders();
    }
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // CRM saved customer addresses & carrier preferences
  // -------------------------------------------------------------------------

  saveCustomerAddress(
    phone: string,
    customerName: string,
    address: OrderAddress,
  ): void {
    const normalized = normalizePhone(phone);
    const street = address.street.trim();
    if (!normalized || !street) return;

    const nowIso = new Date().toISOString();
    const existingIndex = this.savedAddresses.findIndex(
      (entry) =>
        normalizePhone(entry.phone) === normalized &&
        entry.address.street.trim().toLowerCase() === street.toLowerCase(),
    );

    const record: SavedCustomerAddress = {
      id: existingIndex >= 0 ? this.savedAddresses[existingIndex].id : makeId("addr"),
      phone: phone.trim(),
      customerName: customerName.trim(),
      address: { ...address, street },
      updatedAt: nowIso,
    };

    if (existingIndex >= 0) {
      this.savedAddresses.splice(existingIndex, 1);
    }
    this.savedAddresses.unshift(record);
    this.persistAddresses();
  }

  getCustomerAddresses(phone: string): SavedCustomerAddress[] {
    const normalized = normalizePhone(phone);
    if (!normalized) return [];
    return this.savedAddresses.filter((entry) => {
      const entryDigits = normalizePhone(entry.phone);
      return (
        entryDigits === normalized ||
        (normalized.length >= 7 && entryDigits.endsWith(normalized.slice(-10)))
      );
    });
  }

  updateCarrierPreferences(prefs: CarrierPreferences): void {
    this.carrierPreferences = {
      enabledIds: [...prefs.enabledIds],
      favoriteId: prefs.favoriteId,
    };
    saveCarrierPreferences(this.businessId, this.carrierPreferences);
  }

  // -------------------------------------------------------------------------
  // Scheduler & demo reset
  // -------------------------------------------------------------------------

  tickScheduledOrders(now: Date = new Date()): number {
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    let activated = 0;

    for (const order of this.orders) {
      if (
        !order.scheduledFor ||
        order.stage === "delivered" ||
        order.stage === "cancelled"
      ) {
        continue;
      }
      const targetMs = new Date(order.scheduledFor).getTime();
      if (!Number.isNaN(targetMs) && targetMs <= nowMs) {
        order.scheduledFor = null;
        order.stage = "new";
        order.updatedAt = nowIso;
        order.statusHistory.push({
          id: makeId("ev"),
          stage: "new",
          label: this.stageLabel("new"),
          at: nowIso,
          operator: "Programador automático",
          note: "Activado automáticamente al llegar la hora programada",
        });
        order.operatorTrail.push({
          id: makeId("aud"),
          operator: "Programador automático",
          action: "Pedido programado activado automáticamente",
          at: nowIso,
        });
        activated += 1;
      }
    }

    if (activated > 0) {
      this.persistOrders();
    }
    return activated;
  }

  resetDemo(): void {
    this.columns = DEFAULT_ACTIVE_COLUMNS.map((col) => ({ ...col }));
    this.applyProfileLabels(readActiveBusinessProfile(this.businessId));
    this.orders = createSeedOrders();
    this.savedAddresses = seedAddressesFromOrders(this.orders);
    this.persistColumns();
    this.persistOrders();
    this.persistAddresses();
  }
}
