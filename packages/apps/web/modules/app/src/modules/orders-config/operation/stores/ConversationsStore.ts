import { makeAutoObservable } from "mobx";
import type { OrdersProfileId } from "../../types";
import type { CatalogProduct } from "../domain/catalogDomain";
import { readActiveBusinessProfile } from "../domain/profilePresets";
import {
  createSeedConversations,
  DEFAULT_CHANNEL_CONFIG,
  deriveCrmStage,
  derivePipelineStage,
  formatOrderNotificationMessage,
  generateLocalBotReply,
  matchesDateFilter,
  phonesMatch,
  type ChannelConfigState,
  type Conversation,
  type ConversationEvent,
  type ConversationMessage,
  type CrmStageId,
  type DateFilter,
  type InboxFilter,
  type OrderNotificationEventType,
  type PipelineOverrideEntry,
  type PipelineStageId,
  type TimelineItem,
} from "../domain/conversationsDomain";
import type { Order } from "../domain/order";

const MAX_MESSAGE_LENGTH = 4096;

const NEW_THREAD_AVATAR_COLORS = [
  "#0F766E",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#DB2777",
  "#059669",
];

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function cloneDefaultChannelConfig(): ChannelConfigState {
  return {
    ...DEFAULT_CHANNEL_CONFIG,
    workDays: [...DEFAULT_CHANNEL_CONFIG.workDays],
    templates: DEFAULT_CHANNEL_CONFIG.templates.map((tpl) => ({ ...tpl })),
    faqs: DEFAULT_CHANNEL_CONFIG.faqs.map((faq) => ({ ...faq })),
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatAddressFromOrder(order: Order): string | undefined {
  if (!order.address?.street) return undefined;
  return [
    order.address.street,
    order.address.neighborhood,
    order.address.city,
  ]
    .filter(Boolean)
    .join(", ");
}

export class ConversationsStore {
  conversations: Conversation[] = [];
  selectedId: string | null = null;
  pipelineOverrides: Record<string, PipelineOverrideEntry> = {};
  crmOverrides: Record<string, CrmStageId> = {};
  channelConfig: ChannelConfigState = cloneDefaultChannelConfig();
  sending = false;
  inboxFilter: InboxFilter = "all";
  dateFilter: DateFilter = "all";
  searchQuery = "";

  private readonly businessId: string;
  private seedOrders: Order[];

  constructor(businessId: string, seedOrders: Order[] = []) {
    this.businessId = businessId || "default";
    this.seedOrders = seedOrders;

    makeAutoObservable<ConversationsStore, "businessId" | "seedOrders">(this, {
      businessId: false,
      seedOrders: false,
    });

    this.load();
  }

  private get conversationsKey(): string {
    return `necto.pedidos.conversations.${this.businessId}`;
  }

  private get overridesKey(): string {
    return `necto.pedidos.conversations.pipelineOverrides.${this.businessId}`;
  }

  private get crmOverridesKey(): string {
    return `necto.pedidos.conversations.crmOverrides.${this.businessId}`;
  }

  private get configKey(): string {
    return `necto.pedidos.conversations.channelConfig.${this.businessId}`;
  }

  private load(): void {
    const storedConversations = readStorage<Conversation[]>(
      this.conversationsKey,
    );
    if (Array.isArray(storedConversations)) {
      this.conversations = storedConversations;
    } else {
      this.conversations = createSeedConversations(this.seedOrders);
      writeStorage(this.conversationsKey, this.conversations);
    }

    const storedOverrides = readStorage<Record<string, PipelineOverrideEntry>>(
      this.overridesKey,
    );
    if (storedOverrides && typeof storedOverrides === "object") {
      this.pipelineOverrides = storedOverrides;
    } else {
      this.pipelineOverrides = {};
      writeStorage(this.overridesKey, this.pipelineOverrides);
    }

    const storedCrmOverrides = readStorage<Record<string, CrmStageId>>(
      this.crmOverridesKey,
    );
    if (storedCrmOverrides && typeof storedCrmOverrides === "object") {
      this.crmOverrides = storedCrmOverrides;
    } else {
      this.crmOverrides = {};
      writeStorage(this.crmOverridesKey, this.crmOverrides);
    }

    const storedConfig = readStorage<Partial<ChannelConfigState>>(
      this.configKey,
    );
    if (storedConfig && typeof storedConfig === "object") {
      const defaults = cloneDefaultChannelConfig();
      this.channelConfig = {
        ...defaults,
        ...storedConfig,
        apiKey:
          typeof storedConfig.apiKey === "string"
            ? storedConfig.apiKey
            : defaults.apiKey,
        temperature:
          typeof storedConfig.temperature === "number" &&
          Number.isFinite(storedConfig.temperature)
            ? storedConfig.temperature
            : defaults.temperature,
        maxTokens:
          typeof storedConfig.maxTokens === "number" &&
          Number.isFinite(storedConfig.maxTokens)
            ? storedConfig.maxTokens
            : defaults.maxTokens,
        assistantName:
          typeof storedConfig.assistantName === "string" &&
          storedConfig.assistantName.trim()
            ? storedConfig.assistantName
            : defaults.assistantName,
        treatment:
          storedConfig.treatment === "usted" || storedConfig.treatment === "tu"
            ? storedConfig.treatment
            : defaults.treatment,
        responseStyle:
          storedConfig.responseStyle === "direct" ||
          storedConfig.responseStyle === "guided"
            ? storedConfig.responseStyle
            : defaults.responseStyle,
        useEmojis:
          typeof storedConfig.useEmojis === "boolean"
            ? storedConfig.useEmojis
            : defaults.useEmojis,
        autoEscalateClaims:
          typeof storedConfig.autoEscalateClaims === "boolean"
            ? storedConfig.autoEscalateClaims
            : defaults.autoEscalateClaims,
        welcomeMessage:
          typeof storedConfig.welcomeMessage === "string"
            ? storedConfig.welcomeMessage
            : defaults.welcomeMessage,
        handoffRules:
          typeof storedConfig.handoffRules === "string"
            ? storedConfig.handoffRules
            : defaults.handoffRules,
        guardrails:
          typeof storedConfig.guardrails === "string"
            ? storedConfig.guardrails
            : defaults.guardrails,
        faqs: Array.isArray(storedConfig.faqs)
          ? storedConfig.faqs.map((faq) => ({ ...faq }))
          : defaults.faqs,
        autoQuoteServices:
          typeof storedConfig.autoQuoteServices === "boolean"
            ? storedConfig.autoQuoteServices
            : defaults.autoQuoteServices,
        servicesNote:
          typeof storedConfig.servicesNote === "string"
            ? storedConfig.servicesNote
            : defaults.servicesNote,
        workDays: Array.isArray(storedConfig.workDays)
          ? [...storedConfig.workDays]
          : defaults.workDays,
        templates: Array.isArray(storedConfig.templates)
          ? storedConfig.templates.map((tpl) => ({ ...tpl }))
          : defaults.templates,
      };
    } else {
      this.channelConfig = cloneDefaultChannelConfig();
      writeStorage(this.configKey, this.channelConfig);
    }
  }

  private persistConversations(): void {
    writeStorage(this.conversationsKey, this.conversations);
  }

  private persistOverrides(): void {
    writeStorage(this.overridesKey, this.pipelineOverrides);
  }

  private persistCrmOverrides(): void {
    writeStorage(this.crmOverridesKey, this.crmOverrides);
  }

  private persistConfig(): void {
    writeStorage(this.configKey, this.channelConfig);
  }

  private pushEvent(
    conv: Conversation,
    kind: ConversationEvent["kind"],
    text: string,
    createdAt: string = new Date().toISOString(),
  ): void {
    conv.events.push({
      id: makeId("cev"),
      conversationId: conv.id,
      kind,
      text,
      createdAt,
    });
  }

  // -------------------------------------------------------------------------
  // Computed getters
  // -------------------------------------------------------------------------

  get selectedConversation(): Conversation | undefined {
    if (!this.selectedId) return undefined;
    return this.conversations.find((conv) => conv.id === this.selectedId);
  }

  get unreadTotal(): number {
    return this.conversations.reduce(
      (sum, conv) => sum + Math.max(0, conv.unreadCount),
      0,
    );
  }

  get needsAttentionCount(): number {
    return this.conversations.filter(
      (conv) =>
        (conv.needsAttention || conv.status === "waiting") &&
        conv.status !== "closed",
    ).length;
  }

  get urgentConversations(): Conversation[] {
    return this.conversations
      .filter(
        (conv) =>
          (conv.needsAttention || conv.status === "waiting") &&
          conv.status !== "closed",
      )
      .sort(
        (a, b) =>
          b.lastActivityAt.localeCompare(a.lastActivityAt) ||
          a.id.localeCompare(b.id),
      );
  }

  get ticketStats(): {
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
  } {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;

    for (const conv of this.conversations) {
      if (conv.status === "closed") {
        resolved += 1;
      } else if (conv.status === "waiting" || conv.needsAttention) {
        pending += 1;
      } else {
        inProgress += 1;
      }
    }

    return {
      total: this.conversations.length,
      pending,
      inProgress,
      resolved,
    };
  }

  // -------------------------------------------------------------------------
  // Selection, filtering & lookups
  // -------------------------------------------------------------------------

  select(id: string | null): void {
    this.selectedId = id;
    if (!id) return;

    const target = this.byId(id);
    if (!target) return;

    let changed = false;
    if (target.unreadCount > 0) {
      target.unreadCount = 0;
      changed = true;
    }
    for (const msg of target.messages) {
      if (msg.read === false) {
        msg.read = true;
        changed = true;
      }
    }

    if (changed) {
      this.persistConversations();
    }
  }

  setSearch(q: string): void {
    this.searchQuery = q;
  }

  setInboxFilter(f: InboxFilter): void {
    this.inboxFilter = f;
  }

  setDateFilter(f: DateFilter): void {
    this.dateFilter = f;
  }

  clearFilters(): void {
    this.inboxFilter = "all";
    this.dateFilter = "all";
    this.searchQuery = "";
  }

  filteredConversations(currentOperatorId?: string): Conversation[] {
    const query = normalizeSearchText(this.searchQuery);
    const queryDigits = this.searchQuery.replace(/\D/g, "");

    return this.conversations
      .filter((conv) => {
        switch (this.inboxFilter) {
          case "needs_attention":
            if (
              conv.status === "closed" ||
              (!conv.needsAttention && conv.status !== "waiting")
            ) {
              return false;
            }
            break;
          case "mine":
            if (conv.status === "closed") return false;
            if (currentOperatorId) {
              if (conv.assignedOperatorId !== currentOperatorId) return false;
            } else if (!conv.assignedOperatorId) {
              return false;
            }
            break;
          case "unassigned":
            if (conv.status === "closed" || conv.assignedOperatorId !== null) {
              return false;
            }
            break;
          case "ai_active":
            if (
              conv.status === "closed" ||
              !conv.aiActive ||
              conv.attentionMode !== "bot"
            ) {
              return false;
            }
            break;
          case "unread":
            if (conv.unreadCount <= 0) return false;
            break;
          case "closed":
            if (conv.status !== "closed") return false;
            break;
          case "all":
          default:
            break;
        }

        if (!matchesDateFilter(conv.lastActivityAt, this.dateFilter)) {
          return false;
        }

        if (!query) return true;

        const nameMatch = normalizeSearchText(conv.contact.name).includes(query);
        const phoneMatch =
          normalizeSearchText(conv.contact.phone).includes(query) ||
          (queryDigits.length >= 3 &&
            conv.contact.phone.replace(/\D/g, "").includes(queryDigits));
        const operatorMatch = conv.assignedOperatorName
          ? normalizeSearchText(conv.assignedOperatorName).includes(query)
          : false;
        const channelMatch = conv.channel.toLowerCase().includes(query);
        const messageMatch = conv.messages.some((msg) =>
          normalizeSearchText(msg.text).includes(query),
        );

        return (
          nameMatch ||
          phoneMatch ||
          operatorMatch ||
          channelMatch ||
          messageMatch
        );
      })
      .sort(
        (a, b) =>
          b.lastActivityAt.localeCompare(a.lastActivityAt) ||
          a.id.localeCompare(b.id),
      );
  }

  byId(id: string): Conversation | undefined {
    return this.conversations.find((conv) => conv.id === id);
  }

  byPhone(phone: string): Conversation | undefined {
    return this.conversations.find((conv) =>
      phonesMatch(conv.contact.phone, phone),
    );
  }

  hasConversation(phone: string): boolean {
    return Boolean(this.byPhone(phone));
  }

  timelineOf(id: string): TimelineItem[] {
    const conv = this.byId(id);
    if (!conv) return [];

    const messageItems: TimelineItem[] = conv.messages.map((msg) => ({
      ...msg,
      kind: "message",
    }));

    const eventItems: TimelineItem[] = conv.events.map((ev) => ({
      id: ev.id,
      conversationId: ev.conversationId,
      text: ev.text,
      createdAt: ev.createdAt,
      kind: "event",
      eventKind: ev.kind,
    }));

    return [...messageItems, ...eventItems].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  }

  // -------------------------------------------------------------------------
  // Conversation state actions
  // -------------------------------------------------------------------------

  toggleStar(id: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    conv.starred = !conv.starred;
    this.persistConversations();
  }

  markUnread(id: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    if (conv.unreadCount === 0) {
      conv.unreadCount = 1;
      this.persistConversations();
    }
  }

  requestHuman(id: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    const nowIso = new Date().toISOString();

    conv.status = "waiting";
    conv.needsAttention = true;
    conv.aiActive = false;
    conv.lastActivityAt = nowIso;
    this.pushEvent(
      conv,
      "handoff_requested",
      "Se solicitó atención de un asesor humano.",
      nowIso,
    );
    this.persistConversations();
  }

  takeOver(id: string, operatorId: string, operatorName: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    const nowIso = new Date().toISOString();
    const cleanName = operatorName.trim() || "Operador";

    conv.attentionMode = "human";
    conv.aiActive = false;
    conv.needsAttention = false;
    conv.status = "attended";
    conv.assignedOperatorId = operatorId;
    conv.assignedOperatorName = cleanName;
    conv.unreadCount = 0;
    conv.lastActivityAt = nowIso;

    this.pushEvent(conv, "taken", `${cleanName} tomó la conversación.`, nowIso);
    this.persistConversations();
  }

  assign(
    id: string,
    operatorId: string | null,
    operatorName?: string,
  ): void {
    if (operatorId === null) {
      this.returnToBot(id);
      return;
    }

    const conv = this.byId(id);
    if (!conv) return;
    const nowIso = new Date().toISOString();
    const cleanName = operatorName?.trim() || "Operador";

    conv.attentionMode = "human";
    conv.aiActive = false;
    conv.needsAttention = false;
    if (conv.status !== "closed") {
      conv.status = "attended";
    }
    conv.assignedOperatorId = operatorId;
    conv.assignedOperatorName = cleanName;
    conv.lastActivityAt = nowIso;

    this.pushEvent(
      conv,
      "taken",
      `Conversación asignada a ${cleanName}.`,
      nowIso,
    );
    this.persistConversations();
  }

  returnToBot(id: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    const nowIso = new Date().toISOString();

    conv.attentionMode = "bot";
    conv.aiActive = true;
    conv.needsAttention = false;
    conv.assignedOperatorId = null;
    conv.assignedOperatorName = null;
    if (conv.status !== "closed") {
      conv.status = "open";
    }
    conv.lastActivityAt = nowIso;

    this.pushEvent(
      conv,
      "returned_to_bot",
      "Conversación devuelta al Bot Inteligente.",
      nowIso,
    );
    this.persistConversations();
  }

  closeConversation(id: string, operatorName?: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    const nowIso = new Date().toISOString();

    conv.status = "closed";
    conv.needsAttention = false;
    conv.unreadCount = 0;
    conv.lastActivityAt = nowIso;

    const actor = operatorName?.trim();
    this.pushEvent(
      conv,
      "closed",
      actor
        ? `Conversación cerrada por ${actor}.`
        : "Conversación marcada como cerrada.",
      nowIso,
    );
    this.persistConversations();
  }

  reopenConversation(id: string): void {
    const conv = this.byId(id);
    if (!conv) return;
    const nowIso = new Date().toISOString();

    conv.status = conv.attentionMode === "human" ? "attended" : "open";
    conv.lastActivityAt = nowIso;

    this.pushEvent(conv, "reopened", "Conversación reabierta.", nowIso);
    this.persistConversations();
  }

  // -------------------------------------------------------------------------
  // Messaging & order integration
  // -------------------------------------------------------------------------

  sendAgentMessage(
    id: string,
    text: string,
    operatorId: string,
    operatorName: string,
    orderId?: string,
  ): { ok: boolean; error?: string } {
    const cleanText = text.trim();
    if (!cleanText) {
      return { ok: false, error: "Escribe un mensaje antes de enviar." };
    }
    if (cleanText.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `El mensaje supera el límite de ${MAX_MESSAGE_LENGTH} caracteres.`,
      };
    }

    const conv = this.byId(id);
    if (!conv) {
      return { ok: false, error: "La conversación ya no existe." };
    }

    const cleanOperator = operatorName.trim() || "Operador";

    if (conv.attentionMode === "bot" || conv.aiActive) {
      this.takeOver(id, operatorId, cleanOperator);
    } else if (conv.status === "closed") {
      conv.status = "attended";
      this.pushEvent(conv, "reopened", "Conversación reabierta por asesor.");
    }

    const nowIso = new Date().toISOString();
    const message: ConversationMessage = {
      id: makeId("msg"),
      conversationId: id,
      author: "agent",
      authorName: cleanOperator,
      text: cleanText,
      createdAt: nowIso,
      read: true,
      ...(orderId ? { orderId } : {}),
    };

    conv.messages.push(message);
    conv.lastActivityAt = nowIso;
    conv.unreadCount = 0;
    conv.needsAttention = false;
    conv.status = "attended";

    this.persistConversations();
    return { ok: true };
  }

  addInternalNote(
    id: string,
    text: string,
    operatorName: string,
  ): { ok: boolean; error?: string } {
    const cleanText = text.trim();
    if (!cleanText) {
      return { ok: false, error: "Escribe una nota interna antes de guardar." };
    }
    if (cleanText.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `La nota supera el límite de ${MAX_MESSAGE_LENGTH} caracteres.`,
      };
    }

    const conv = this.byId(id);
    if (!conv) {
      return { ok: false, error: "La conversación ya no existe." };
    }

    const nowIso = new Date().toISOString();
    conv.messages.push({
      id: makeId("note"),
      conversationId: id,
      author: "agent",
      authorName: operatorName.trim() || "Operador",
      text: cleanText,
      createdAt: nowIso,
      isInternalNote: true,
      read: true,
    });

    this.persistConversations();
    return { ok: true };
  }

  sendCustomerMessage(
    id: string,
    text: string,
    linkedOrders: Order[] = [],
    catalogProducts: CatalogProduct[] = [],
  ): void {
    const cleanText = text.trim();
    if (!cleanText) return;

    const conv = this.byId(id);
    if (!conv) return;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (conv.status === "closed") {
      conv.status = conv.attentionMode === "human" ? "attended" : "open";
      this.pushEvent(
        conv,
        "reopened",
        "Conversación reabierta por mensaje del cliente.",
        nowIso,
      );
    }

    conv.messages.push({
      id: makeId("msg"),
      conversationId: id,
      author: "customer",
      authorName: conv.contact.name,
      text: cleanText,
      createdAt: nowIso,
      read: this.selectedId === id,
    });
    conv.lastActivityAt = nowIso;

    if (this.selectedId !== id) {
      conv.unreadCount += 1;
    }

    if (conv.attentionMode === "bot" && this.channelConfig.masterAutoReply) {
      const reply = generateLocalBotReply(
        cleanText,
        conv,
        linkedOrders,
        catalogProducts,
        this.channelConfig,
      );
      const replyIso = new Date(nowMs + 1000).toISOString();

      conv.messages.push({
        id: makeId("msg"),
        conversationId: id,
        author: "bot",
        authorName: this.channelConfig.assistantName || this.channelConfig.modelName,
        text: reply.text,
        createdAt: replyIso,
        read: true,
        ...(reply.traceability.orderId
          ? { orderId: reply.traceability.orderId }
          : {}),
        traceability: reply.traceability,
      });
      conv.lastActivityAt = replyIso;

      if (reply.requestHuman) {
        conv.status = "waiting";
        conv.needsAttention = true;
        conv.aiActive = false;
        this.pushEvent(
          conv,
          "handoff_requested",
          "Bot escaló la conversación a un asesor humano.",
          replyIso,
        );
      }
    }

    this.persistConversations();
  }

  sendOrderReceiptToChat(
    phoneOrConvId: string,
    order: Order,
    messageText: string,
    operatorId: string,
    operatorName: string,
  ): Conversation {
    const cleanOperator = operatorName.trim() || "Operador";
    const nowIso = new Date().toISOString();

    let conv =
      this.byId(phoneOrConvId) ??
      this.byPhone(phoneOrConvId) ??
      this.byPhone(order.customerPhone);

    if (!conv) {
      const id = makeId("conv");
      const colorIndex = this.conversations.length % NEW_THREAD_AVATAR_COLORS.length;
      conv = {
        id,
        channel: "whatsapp",
        contact: {
          name: order.customerName.trim() || "Cliente",
          phone: order.customerPhone.trim() || phoneOrConvId.trim(),
          avatarColor: NEW_THREAD_AVATAR_COLORS[colorIndex],
          address: formatAddressFromOrder(order),
        },
        status: "attended",
        attentionMode: "human",
        assignedOperatorId: operatorId,
        assignedOperatorName: cleanOperator,
        needsAttention: false,
        aiActive: false,
        unreadCount: 0,
        starred: false,
        createdAt: nowIso,
        lastActivityAt: nowIso,
        messages: [],
        events: [],
      };
      this.conversations.unshift(conv);
    }

    const cleanText =
      messageText.trim() ||
      `Hola ${order.customerName.split(" ")[0] || "cliente"}, aquí tienes el resumen de tu pedido ${order.code}.`;

    conv.messages.push({
      id: makeId("msg"),
      conversationId: conv.id,
      author: "agent",
      authorName: cleanOperator,
      text: cleanText,
      createdAt: nowIso,
      read: true,
      orderId: order.id,
    });

    this.pushEvent(
      conv,
      "order_linked",
      `Resumen del pedido ${order.code} enviado al chat.`,
      nowIso,
    );

    if (conv.status === "closed") {
      conv.status = "attended";
    }
    if (!conv.assignedOperatorId) {
      conv.assignedOperatorId = operatorId;
      conv.assignedOperatorName = cleanOperator;
      conv.attentionMode = "human";
      conv.aiActive = false;
    }
    if (!conv.contact.address) {
      conv.contact.address = formatAddressFromOrder(order);
    }
    conv.needsAttention = false;
    conv.lastActivityAt = nowIso;

    this.persistConversations();
    return conv;
  }

  notifyOrderEvent(
    order: Order,
    eventType: OrderNotificationEventType,
    businessName: string,
    profile?: OrdersProfileId,
  ): void {
    const conv = this.byPhone(order.customerPhone);
    if (!conv) return;

    const nowIso = new Date().toISOString();
    const resolvedProfile = profile ?? readActiveBusinessProfile(this.businessId);
    const text = formatOrderNotificationMessage(
      eventType,
      order,
      businessName,
      resolvedProfile,
    );

    conv.messages.push({
      id: makeId("msg"),
      conversationId: conv.id,
      author: "bot",
      authorName: this.channelConfig.assistantName || this.channelConfig.modelName,
      text,
      createdAt: nowIso,
      read: true,
      orderId: order.id,
      traceability: {
        flow: "Notificación automática de pedido",
        moduleTag: eventType === "delivery_incident" ? "Incidencias" : "Pedidos",
        suggestedAction:
          eventType === "delivery_incident"
            ? "Contactar al cliente y reprogramar entrega"
            : "Monitorear avance del pedido",
        confidence: 0.99,
        orderId: order.id,
      },
    });

    if (eventType === "delivery_incident") {
      conv.needsAttention = true;
      if (conv.status === "open") {
        conv.status = "waiting";
        conv.aiActive = false;
      }
      this.pushEvent(
        conv,
        "handoff_requested",
        `Novedad de entrega en pedido ${order.code}: requiere seguimiento humano.`,
        nowIso,
      );
    }

    conv.lastActivityAt = nowIso;
    this.persistConversations();
  }

  // -------------------------------------------------------------------------
  // Pipeline, contact notes & channel config
  // -------------------------------------------------------------------------

  effectivePipelineStage(
    conv: Conversation,
    linkedOrders: Order[],
  ): PipelineStageId | null {
    const autoStage = derivePipelineStage(conv, linkedOrders);
    if (autoStage === null) {
      return null;
    }
    const override = this.pipelineOverrides[conv.id];
    if (override && override.autoSnapshot === autoStage) {
      return override.stage;
    }
    return autoStage;
  }

  setPipelineStageOverride(
    convId: string,
    stage: PipelineStageId,
    currentAutoStage: PipelineStageId,
  ): void {
    this.pipelineOverrides = {
      ...this.pipelineOverrides,
      [convId]: {
        stage,
        autoSnapshot: currentAutoStage,
      },
    };
    this.persistOverrides();
  }

  resetPipelineOverrides(): void {
    this.pipelineOverrides = {};
    this.persistOverrides();
  }

  effectiveCrmStage(conv: Conversation, linkedOrders: Order[]): CrmStageId {
    return this.crmOverrides[conv.id] ?? deriveCrmStage(conv, linkedOrders);
  }

  isCrmManual(convId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.crmOverrides, convId);
  }

  setCrmStageOverride(convId: string, stage: CrmStageId): void {
    this.crmOverrides = {
      ...this.crmOverrides,
      [convId]: stage,
    };
    this.persistCrmOverrides();
  }

  resetCrmStageOverride(convId: string): void {
    if (!this.isCrmManual(convId)) return;
    const next = { ...this.crmOverrides };
    delete next[convId];
    this.crmOverrides = next;
    this.persistCrmOverrides();
  }

  saveContactNotes(convId: string, notes: string): void {
    const conv = this.byId(convId);
    if (!conv) return;
    conv.contact.notes = notes.trim() || undefined;
    this.persistConversations();
  }

  updateChannelConfig(patch: Partial<ChannelConfigState>): void {
    this.channelConfig = {
      ...this.channelConfig,
      ...patch,
      workDays: patch.workDays
        ? [...patch.workDays]
        : this.channelConfig.workDays,
      templates: patch.templates
        ? patch.templates.map((tpl) => ({ ...tpl }))
        : this.channelConfig.templates,
      faqs: patch.faqs
        ? patch.faqs.map((faq) => ({ ...faq }))
        : this.channelConfig.faqs,
    };
    this.persistConfig();
  }

  toggleMasterAutoReply(): void {
    this.channelConfig = {
      ...this.channelConfig,
      masterAutoReply: !this.channelConfig.masterAutoReply,
    };
    this.persistConfig();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  reload(): void {
    this.load();
  }

  resetDemo(seedOrders: Order[]): void {
    this.seedOrders = seedOrders;
    this.conversations = createSeedConversations(seedOrders);
    this.pipelineOverrides = {};
    this.crmOverrides = {};
    this.channelConfig = cloneDefaultChannelConfig();
    this.selectedId = null;
    this.sending = false;
    this.clearFilters();

    this.persistConversations();
    this.persistOverrides();
    this.persistCrmOverrides();
    this.persistConfig();
  }
}
