import type { OrdersProfileId } from "../../types";
import type { CatalogProduct } from "./catalogDomain";
import {
  createSeedOrders,
  formatCOP,
  STAGE_LABELS,
  type Order,
  type OrderAddress,
} from "./order";
import { getProfilePreset } from "./profilePresets";

// ---------------------------------------------------------------------------
// Core conversations domain types
// ---------------------------------------------------------------------------

export type ConversationChannel =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "tiktok"
  | "telegram";

export type ConversationStatus = "open" | "waiting" | "attended" | "closed";

export type AttentionMode = "bot" | "human";

export type MessageAuthor = "customer" | "agent" | "bot";

export type ConversationIntention =
  | "inquire"
  | "buy"
  | "track_order"
  | "claim";

export type InboxFilter =
  | "all"
  | "needs_attention"
  | "mine"
  | "unassigned"
  | "ai_active"
  | "unread"
  | "closed";

export type DateFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "month";

export type PipelineStageId =
  | "initial_contact"
  | "offer_sent"
  | "follow_up"
  | "closing"
  | "payment_validation";

export type CrmStageId =
  | "new"
  | "in_conversation"
  | "interested"
  | "customer"
  | "lost";

export type ConversationViewTab =
  | "chats"
  | "pipeline"
  | "history"
  | "analytics"
  | "config";

export type ConversationEventKind =
  | "handoff_requested"
  | "taken"
  | "returned_to_bot"
  | "closed"
  | "reopened"
  | "order_linked";

export type OrderNotificationEventType =
  | "advanced"
  | "confirmed"
  | "preparing"
  | "ready"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "paid"
  | "delivery_incident";

export type AnalyticsPeriod = "today" | "week" | "month";

export interface MessageTraceability {
  flow: string;
  moduleTag: string;
  suggestedAction: string;
  confidence: number;
  orderId?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  author: MessageAuthor;
  authorName?: string;
  text: string;
  createdAt: string;
  isInternalNote?: boolean;
  wamid?: string;
  read?: boolean;
  orderId?: string;
  traceability?: MessageTraceability;
}

export interface ConversationEvent {
  id: string;
  conversationId: string;
  kind: ConversationEventKind;
  text: string;
  createdAt: string;
}

export type TimelineItem =
  | ({ kind: "message" } & ConversationMessage)
  | ({
      kind: "event";
      eventKind: ConversationEventKind;
    } & Omit<ConversationEvent, "kind">);

export interface ConversationContact {
  name: string;
  phone: string;
  lid?: string;
  avatarColor: string;
  address?: string;
  notes?: string;
}

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  contact: ConversationContact;
  status: ConversationStatus;
  attentionMode: AttentionMode;
  assignedOperatorId: string | null;
  assignedOperatorName: string | null;
  needsAttention: boolean;
  aiActive: boolean;
  unreadCount: number;
  starred: boolean;
  lastActivityAt: string;
  createdAt: string;
  messages: ConversationMessage[];
  events: ConversationEvent[];
}

export interface QuickTemplate {
  id: string;
  key: "menu" | "location" | "payment" | "tracking";
  label: string;
  text: string;
}

export interface ChannelFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface OpenRouterModelOption {
  id: string;
  label: string;
  provider: string;
  recommended?: boolean;
}

export interface ChannelConfigState {
  modelName: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  assistantName: string;
  personality: "friendly" | "professional" | "concise";
  treatment: "tu" | "usted";
  responseStyle: "guided" | "direct";
  useEmojis: boolean;
  autoEscalateClaims: boolean;
  instructions: string;
  welcomeMessage: string;
  handoffRules: string;
  guardrails: string;
  faqs: ChannelFaqItem[];
  autoQuoteServices: boolean;
  servicesNote: string;
  businessHoursEnabled: boolean;
  openTime: string;
  closeTime: string;
  workDays: string[];
  outOfHoursMessage: string;
  masterAutoReply: boolean;
  whatsappConnected: boolean;
  whatsappNumber: string;
  knowledgeNotes: string;
  templates: QuickTemplate[];
}

export interface PipelineStageMeta {
  id: PipelineStageId;
  label: string;
  description: string;
  color: string;
  progress: number;
}

export interface CrmStageMeta {
  id: CrmStageId;
  label: string;
  description: string;
  color: string;
  step: number;
}

export interface PipelineOverrideEntry {
  stage: PipelineStageId;
  autoSnapshot: PipelineStageId;
}

export interface BotReplyResult {
  text: string;
  traceability: MessageTraceability;
  requestHuman?: boolean;
}

export interface ConversationAnalyticsSummary {
  period: AnalyticsPeriod;
  total: number;
  botResolvedCount: number;
  botResolutionRate: number;
  avgResponseMinutes: number;
  orderConversionCount: number;
  orderConversionRate: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  intents: Record<ConversationIntention, number>;
}

// ---------------------------------------------------------------------------
// Constants & catalogs
// ---------------------------------------------------------------------------

export const STATUS_META: Record<
  ConversationStatus,
  { label: string; tone: "blue" | "amber" | "green" | "gray" }
> = {
  open: { label: "Abierto", tone: "blue" },
  waiting: { label: "Esperando asesor", tone: "amber" },
  attended: { label: "En atención", tone: "green" },
  closed: { label: "Cerrado", tone: "gray" },
};

export const INTENTION_META: Record<
  ConversationIntention,
  { label: string; tone: "gray" | "green" | "blue" | "amber" }
> = {
  inquire: { label: "Consulta", tone: "gray" },
  buy: { label: "Compra", tone: "green" },
  track_order: { label: "Seguimiento", tone: "blue" },
  claim: { label: "Reclamo", tone: "amber" },
};

export const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  tiktok: "TikTok",
  telegram: "Telegram",
};

export const PIPELINE_STAGES: PipelineStageMeta[] = [
  {
    id: "initial_contact",
    label: "Contacto Inicial",
    description: "Primer mensaje o consulta exploratoria del cliente.",
    color: "#64748B",
    progress: 20,
  },
  {
    id: "offer_sent",
    label: "Oferta Enviada",
    description: "Catálogo, precios o recomendación compartida con el cliente.",
    color: "#3B82F6",
    progress: 40,
  },
  {
    id: "follow_up",
    label: "Seguimiento",
    description: "Conversación activa con acompañamiento comercial o logístico.",
    color: "#8B5CF6",
    progress: 60,
  },
  {
    id: "closing",
    label: "En Cierre",
    description: "Confirmación de pedido, dirección o cierre de venta en curso.",
    color: "#F59E0B",
    progress: 80,
  },
  {
    id: "payment_validation",
    label: "Validación de pago",
    description: "Verificación de transferencia, comprobante o cobro contra entrega.",
    color: "#10B981",
    progress: 95,
  },
];

export const OPENROUTER_MODELS: ReadonlyArray<OpenRouterModelOption> = [
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    recommended: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    provider: "Anthropic",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    provider: "Meta",
  },
];

export const CRM_STAGES: ReadonlyArray<CrmStageMeta> = [
  {
    id: "new",
    label: "Nuevo",
    description: "Contacto recién llegado sin respuesta comercial todavía.",
    color: "#64748B",
    step: 1,
  },
  {
    id: "in_conversation",
    label: "En conversación",
    description: "Intercambio activo de mensajes con el bot o un asesor.",
    color: "#3B82F6",
    step: 2,
  },
  {
    id: "interested",
    label: "Interesado",
    description: "Consultó precios, disponibilidad o manifestó intención de compra.",
    color: "#8B5CF6",
    step: 3,
  },
  {
    id: "customer",
    label: "Cliente",
    description: "Cuenta con al menos un pedido activo o entregado.",
    color: "#10B981",
    step: 4,
  },
  {
    id: "lost",
    label: "Perdido",
    description: "Conversación cerrada sin compra o con pedidos cancelados.",
    color: "#EF4444",
    step: 5,
  },
];

export const DEFAULT_CHANNEL_CONFIG: ChannelConfigState = {
  modelName: "google/gemini-2.0-flash-001",
  apiKey: "",
  temperature: 0.4,
  maxTokens: 1024,
  assistantName: "Asistente Necto",
  personality: "friendly",
  treatment: "tu",
  responseStyle: "guided",
  useEmojis: true,
  autoEscalateClaims: true,
  instructions:
    "Atiende en español colombiano cordial y claro. Comparte precios exactos del catálogo, confirma dirección y medio de pago antes de cerrar un pedido, y escala a un asesor humano ante reclamos, cancelaciones o solicitudes especiales.",
  welcomeMessage:
    "¡Hola! Soy el Asistente Necto. Puedo compartirte nuestro catálogo, tomar tu pedido o ayudarte con el seguimiento de tu envío. ¿En qué te ayudo hoy?",
  handoffRules:
    "Escalar inmediatamente a un asesor humano ante reclamos, solicitud de reembolso, facturación electrónica especial o cuando el cliente pida hablar con una persona.",
  guardrails:
    "No inventar precios ni tiempos de entrega fuera de la política del negocio. Confirmar siempre ciudad, dirección y medio de pago antes de cerrar un pedido.",
  faqs: [
    {
      id: "faq-envios",
      question: "¿Hacen envíos a todo el país?",
      answer:
        "Sí, realizamos domicilios locales el mismo día y envíos nacionales a toda Colombia con Coordinadora, Servientrega, Envía, TCC e InterRapidísimo.",
    },
    {
      id: "faq-pagos",
      question: "¿Qué medios de pago aceptan?",
      answer:
        "Aceptamos transferencia Bancolombia, Nequi, Daviplata, tarjeta de crédito/débito, link de pago y efectivo contra entrega.",
    },
    {
      id: "faq-garantia",
      question: "¿Cómo funciona la garantía o cambios?",
      answer:
        "Si tu producto llega con algún inconveniente, escríbenos dentro de los primeros 5 días hábiles y un asesor gestionará el cambio sin costo adicional.",
    },
  ],
  autoQuoteServices: true,
  servicesNote:
    "Incluye cálculo estimado de domicilio local y tarifa base de envío nacional según ciudad de destino.",
  businessHoursEnabled: true,
  openTime: "08:00",
  closeTime: "20:00",
  workDays: [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ],
  outOfHoursMessage:
    "Hola, en este momento estamos fuera de nuestro horario de atención (8:00 a 20:00). Déjanos tu consulta o pedido y nuestro equipo te responderá a primera hora.",
  masterAutoReply: true,
  whatsappConnected: true,
  whatsappNumber: "+57 300 410 8820",
  knowledgeNotes:
    "Domicilios locales en 35-50 min y envíos nacionales con Servientrega, Coordinadora, Envía, TCC e InterRapidísimo. Aceptamos transferencia Bancolombia, Nequi, Daviplata, tarjeta y pago contra entrega.",
  templates: [
    {
      id: "tpl-menu",
      key: "menu",
      label: "Catálogo y menú",
      text: "Hola, aquí puedes revisar nuestros productos disponibles con precios actualizados. Cuéntame cuál te interesa y te ayudo a armar tu pedido.",
    },
    {
      id: "tpl-location",
      key: "location",
      label: "Ubicación y horarios",
      text: "Atendemos de lunes a sábado de 8:00 a. m. a 8:00 p. m. Realizamos domicilios en la ciudad, retiros en tienda y envíos a todo el país.",
    },
    {
      id: "tpl-payment",
      key: "payment",
      label: "Medios de pago",
      text: "Puedes pagar por transferencia Bancolombia, Nequi, Daviplata, tarjeta de crédito/débito o efectivo contra entrega. Si ya transferiste, envíanos el comprobante por aquí.",
    },
    {
      id: "tpl-tracking",
      key: "tracking",
      label: "Seguimiento de pedido",
      text: "Con gusto reviso el estado de tu envío. Compárteme el código de tu pedido (por ejemplo P-010) y te confirmo la transportadora y tu número de guía.",
    },
  ],
};

const AVATAR_PALETTE = [
  "#0F766E",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#DB2777",
  "#059669",
  "#EA580C",
  "#4F46E5",
  "#0284C7",
  "#BE123C",
];

const WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("3")) {
    return `+57${digits}`;
  }
  return `+${digits}`;
}

export function phonesMatch(a: string, b: string): boolean {
  const digitsA = a.replace(/\D/g, "");
  const digitsB = b.replace(/\D/g, "");
  if (!digitsA || !digitsB) return false;
  if (digitsA.length >= 10 && digitsB.length >= 10) {
    return digitsA.slice(-10) === digitsB.slice(-10);
  }
  return digitsA === digitsB;
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return "CL";
}

export function formatHour(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatChatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000,
  );

  if (diffDays <= 0) {
    return formatHour(iso);
  }
  if (diffDays < 7) {
    return WEEKDAYS_ES[date.getDay()] ?? "";
  }
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "ahora";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s{2,}/g, " ").trim();
}

export function getLastVisibleMessage(
  conv: Conversation,
): ConversationMessage | undefined {
  for (let i = conv.messages.length - 1; i >= 0; i -= 1) {
    if (!conv.messages[i].isInternalNote) {
      return conv.messages[i];
    }
  }
  return undefined;
}

export function classifyIntention(
  conv: Conversation,
  linkedOrders: Order[],
): ConversationIntention {
  const customerTexts = conv.messages
    .filter((msg) => msg.author === "customer" && !msg.isInternalNote)
    .map((msg) => normalizeText(msg.text))
    .join(" ");

  if (
    /(reclamo|queja|problema|danado|equivocado|incompleto|no llego|no ha llegado|reembolso|devolucion|cancelar|cancelado|demora|retraso|novedad|mal estado|falta|error)/.test(
      customerTexts,
    )
  ) {
    return "claim";
  }

  if (
    /(guia|rastreo|tracking|donde va|en camino|estado de mi pedido|seguimiento|transportadora|ya salio|cuando llega|repartidor|mensajero|mi pedido)/.test(
      customerTexts,
    )
  ) {
    return "track_order";
  }

  const hasInTransitOrder = linkedOrders.some(
    (order) => order.stage === "in_transit" || order.stage === "ready",
  );
  if (
    hasInTransitOrder &&
    /(llega|envio|entrega|pedido|despacho)/.test(customerTexts)
  ) {
    return "track_order";
  }

  if (
    /(quiero pedir|pedir|comprar|encargar|me llevo|confirmar|confirmo|comprobante|transferencia|nequi|daviplata|pagar|pago|domicilio|enviamelo|ordenar|cotizacion)/.test(
      customerTexts,
    ) ||
    linkedOrders.some((order) => order.stage !== "cancelled")
  ) {
    return "buy";
  }

  return "inquire";
}

export function derivePipelineStage(
  conv: Conversation,
  linkedOrders: Order[],
): PipelineStageId | null {
  if (conv.status === "closed") {
    return null;
  }

  if (linkedOrders.length > 0) {
    const activeOrders = linkedOrders
      .filter(
        (order) => order.stage !== "delivered" && order.stage !== "cancelled",
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (activeOrders.length === 0) {
      return null;
    }

    const latest = activeOrders[0];
    if (
      (latest.stage === "preparing" ||
        latest.stage === "ready" ||
        latest.stage === "in_transit") &&
      latest.paid
    ) {
      return null;
    }

    if (!latest.paid && latest.paymentMethod === "transfer") {
      return "payment_validation";
    }

    if (latest.stage === "new") {
      return "closing";
    }

    if (latest.stage === "confirmed") {
      return "payment_validation";
    }

    return null;
  }

  const visibleMessages = conv.messages.filter((msg) => !msg.isInternalNote);
  const recentCustomerText = visibleMessages
    .filter((msg) => msg.author === "customer")
    .slice(-3)
    .map((msg) => normalizeText(msg.text))
    .join(" ");

  if (
    /(confirmo|me lo llevo|direccion es|enviamelo|listo pido|quiero cerrar|aparta|cerrar el pedido|comprobante|ya pague|ya transferi)/.test(
      recentCustomerText,
    )
  ) {
    return "closing";
  }

  if (visibleMessages.length >= 4) {
    return "follow_up";
  }

  const outboundTexts = visibleMessages
    .filter((msg) => msg.author === "bot" || msg.author === "agent")
    .map((msg) => normalizeText(msg.text))
    .join(" ");

  if (
    /(\$|precio|catalogo|menu|disponible|te recomiendo|combo|oferta|envio gratis)/.test(
      outboundTexts,
    )
  ) {
    return "offer_sent";
  }

  return "initial_contact";
}

export function deriveCrmStage(
  conv: Conversation,
  linkedOrders: Order[],
): CrmStageId {
  if (linkedOrders.some((order) => order.stage !== "cancelled")) {
    return "customer";
  }

  if (
    linkedOrders.length > 0 &&
    linkedOrders.every((order) => order.stage === "cancelled")
  ) {
    return "lost";
  }

  if (conv.status === "closed") {
    return "lost";
  }

  const visibleMessages = conv.messages.filter((msg) => !msg.isInternalNote);
  const customerTexts = visibleMessages
    .filter((msg) => msg.author === "customer")
    .map((msg) => normalizeText(msg.text))
    .join(" ");

  if (
    classifyIntention(conv, linkedOrders) === "buy" ||
    /(precio|cuanto cuesta|cotiz|disponible|catalogo|combo|quiero|pedir|comprar|talla|envio)/.test(
      customerTexts,
    )
  ) {
    return "interested";
  }

  if (
    visibleMessages.length >= 2 &&
    visibleMessages.some(
      (msg) => msg.author === "bot" || msg.author === "agent",
    )
  ) {
    return "in_conversation";
  }

  return "new";
}

export function matchesDateFilter(
  iso: string,
  filter: DateFilter,
  now: Date = new Date(),
): boolean {
  if (filter === "all") return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  switch (filter) {
    case "today":
      return date.getTime() >= startOfToday.getTime();
    case "yesterday":
      return (
        date.getTime() >= startOfYesterday.getTime() &&
        date.getTime() < startOfToday.getTime()
      );
    case "7d":
      return date.getTime() >= now.getTime() - 7 * 86_400_000;
    case "30d":
      return date.getTime() >= now.getTime() - 30 * 86_400_000;
    case "month":
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    default:
      return true;
  }
}

export function formatOrderNotificationMessage(
  eventType: OrderNotificationEventType,
  order: Order,
  businessName: string,
  profile?: OrdersProfileId,
): string {
  const firstName = order.customerName.trim().split(/\s+/)[0] || "cliente";
  const brand = businessName.trim() || "nuestra tienda";
  const profileStageLabels = profile ? getProfilePreset(profile).stageLabels : undefined;
  const profileStageLabel =
    order.stage === "preparing"
      ? profileStageLabels?.preparing
      : order.stage === "ready"
        ? profileStageLabels?.ready
        : order.stage === "in_transit"
          ? profileStageLabels?.in_transit
          : undefined;
  const stageLabel = profileStageLabel ?? STAGE_LABELS[order.stage] ?? order.stage;

  switch (eventType) {
    case "confirmed":
      return `Hola ${firstName}, en ${brand} confirmamos tu pedido ${order.code} por ${formatCOP(order.total)}. Te avisaremos apenas pase a preparación.`;
    case "preparing":
      if (profile === "food") {
        return `Hola ${firstName}, tu pedido ${order.code} ya entró en cocina en ${brand}. Muy pronto saldrá recién preparado.`;
      }
      if (profile === "fashion") {
        return `Hola ${firstName}, ya estamos empacando tu pedido ${order.code} en ${brand}. Te avisaremos apenas quede listo para despacho.`;
      }
      if (profile === "services") {
        return `Hola ${firstName}, tu solicitud ${order.code} ya está en atención con nuestro equipo en ${brand}.`;
      }
      return `Hola ${firstName}, ya estamos preparando tu pedido ${order.code} en ${brand}. Muy pronto estará listo.`;
    case "ready":
      if (profile === "services") {
        return `Hola ${firstName}, tu servicio ${order.code} en ${brand} ya está por finalizar.`;
      }
      if (profile === "food" && order.modality !== "pickup") {
        return `Hola ${firstName}, tu pedido ${order.code} ya salió de cocina en ${brand} y está listo para salir a domicilio.`;
      }
      return order.modality === "pickup"
        ? `¡Buenas noticias, ${firstName}! Tu pedido ${order.code} ya está listo para recoger en ${brand}.`
        : `Hola ${firstName}, tu pedido ${order.code} ya está empacado y listo para despacho desde ${brand}.`;
    case "in_transit":
      if (profile === "services") {
        return `Hola ${firstName}, tu servicio ${order.code} con ${brand} ya se encuentra en curso.`;
      }
      if (profile === "fashion" && order.carrier && order.trackingNumber) {
        return `¡Tu pedido ${order.code} fue despachado! Salió con ${order.carrier} bajo la guía ${order.trackingNumber}.`;
      }
      return order.carrier && order.trackingNumber
        ? `¡Tu pedido ${order.code} va en camino! Salió con ${order.carrier} bajo la guía ${order.trackingNumber}.`
        : `¡Tu pedido ${order.code} va en camino! Nuestro repartidor se dirige hacia tu dirección.`;
    case "delivered":
      return `¡Pedido ${order.code} entregado! Gracias por confiar en ${brand}, ${firstName}. Si necesitas algo más, escríbenos por este chat.`;
    case "cancelled":
      return `Hola ${firstName}, te informamos que tu pedido ${order.code} en ${brand} fue cancelado${order.cancellationReason ? ` (${order.cancellationReason})` : ""}. Si deseas reprogramarlo, respóndenos aquí.`;
    case "paid":
      return `¡Pago confirmado, ${firstName}! Registramos el abono de ${formatCOP(order.total)} para tu pedido ${order.code} en ${brand}.`;
    case "delivery_incident":
      return `Hola ${firstName}, se presentó una novedad en la entrega de tu pedido ${order.code}${order.carrier ? ` con ${order.carrier}` : ""}. Un asesor de ${brand} te ayudará a coordinar el reintento cuanto antes.`;
    case "advanced":
    default:
      return `Hola ${firstName}, actualizamos tu pedido ${order.code} en ${brand} al estado: ${stageLabel}.`;
  }
}

export function generateLocalBotReply(
  customerText: string,
  conv: Conversation,
  linkedOrders: Order[],
  catalogProducts: CatalogProduct[],
  config: ChannelConfigState,
): BotReplyResult {
  const normalized = normalizeText(customerText);
  const firstName = conv.contact.name.trim().split(/\s+/)[0] || "hola";
  const sortedOrders = [...linkedOrders].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const latestOrder = sortedOrders[0];

  const tonePrefix =
    config.personality === "professional"
      ? `Estimado/a ${firstName}, `
      : config.personality === "concise"
        ? ""
        : `¡Hola ${firstName}! `;

  // 1. Human escalation or claim
  if (
    /(asesor|humano|persona|agente|reclamo|queja|problema|danado|equivocado|cancelar|reembolso|devolucion|mal estado|no ha llegado|no llego)/.test(
      normalized,
    )
  ) {
    return {
      text: `${tonePrefix}entiendo la situación y quiero que la resolvamos rápido. Ya escalé esta conversación a un asesor humano para que revise tu caso personalmente en los próximos minutos.`,
      requestHuman: true,
      traceability: {
        flow: "Escalamiento a asesor",
        moduleTag: "Soporte",
        suggestedAction: "Tomar conversación y validar caso del cliente",
        confidence: 0.96,
        ...(latestOrder ? { orderId: latestOrder.id } : {}),
      },
    };
  }

  // 2. Order tracking
  if (
    /(pedido|guia|rastreo|tracking|donde va|estado|cuando llega|envio|camino|transportadora)/.test(
      normalized,
    )
  ) {
    if (latestOrder) {
      const stageLabel = STAGE_LABELS[latestOrder.stage] ?? latestOrder.stage;
      const trackingSnippet =
        latestOrder.carrier && latestOrder.trackingNumber
          ? ` Va con ${latestOrder.carrier} y tu número de guía es ${latestOrder.trackingNumber}.`
          : "";
      const paymentSnippet = latestOrder.paid
        ? " El pago ya está confirmado."
        : ` Tiene saldo pendiente de ${formatCOP(latestOrder.total)}.`;
      return {
        text: `${tonePrefix}tu pedido ${latestOrder.code} (${formatCOP(latestOrder.total)}) se encuentra en estado "${stageLabel}".${trackingSnippet}${paymentSnippet}`,
        traceability: {
          flow: "Seguimiento de pedido",
          moduleTag: "Pedidos",
          suggestedAction: "Compartir actualización logística",
          confidence: 0.95,
          orderId: latestOrder.id,
        },
      };
    }

    const trackingTpl = config.templates.find((tpl) => tpl.key === "tracking");
    return {
      text:
        trackingTpl?.text ??
        `${tonePrefix}compárteme tu código de pedido (ej. P-010) o el teléfono con el que compraste para revisar el seguimiento de inmediato.`,
      traceability: {
        flow: "Consulta de seguimiento",
        moduleTag: "Pedidos",
        suggestedAction: "Solicitar código de pedido",
        confidence: 0.88,
      },
    };
  }

  // 3. Payment & verification
  if (
    /(pago|pagar|nequi|daviplata|transferencia|bancolombia|tarjeta|contra entrega|efectivo|comprobante|cuenta|pse)/.test(
      normalized,
    )
  ) {
    const paymentTpl = config.templates.find((tpl) => tpl.key === "payment");
    const unpaidOrder = sortedOrders.find(
      (order) => !order.paid && order.stage !== "cancelled",
    );
    const extra = unpaidOrder
      ? ` Veo pendiente tu pedido ${unpaidOrder.code} por ${formatCOP(unpaidOrder.total)}; apenas envíes el comprobante lo marcamos como pagado.`
      : "";
    return {
      text: `${paymentTpl?.text ?? "Aceptamos transferencia Bancolombia, Nequi, Daviplata, tarjeta y contra entrega."}${extra}`,
      traceability: {
        flow: "Validación de pago",
        moduleTag: "Pagos",
        suggestedAction: unpaidOrder
          ? `Verificar pago de ${unpaidOrder.code}`
          : "Confirmar medio de pago",
        confidence: 0.93,
        ...(unpaidOrder ? { orderId: unpaidOrder.id } : {}),
      },
    };
  }

  // 4. Hours & location
  if (
    /(ubicacion|direccion|horario|donde estan|tienda|recoger|abierto|hora)/.test(
      normalized,
    )
  ) {
    const days =
      config.workDays.length > 0 ? config.workDays.join(", ") : "Lunes a Sábado";
    return {
      text: `${tonePrefix}atendemos ${days} de ${config.openTime} a ${config.closeTime}. Hacemos domicilios en la ciudad, retiros en tienda y envíos nacionales.`,
      traceability: {
        flow: "Información de tienda",
        moduleTag: "Atención",
        suggestedAction: "Confirmar modalidad de entrega",
        confidence: 0.91,
      },
    };
  }

  // 5. Catalog / product match
  const availableProducts = catalogProducts.filter((product) => product.available);
  const matchedProducts = availableProducts.filter((product) => {
    const nameTokens = normalizeText(product.name)
      .split(/\s+/)
      .filter((token) => token.length >= 4);
    return nameTokens.some((token) => normalized.includes(token));
  });

  if (
    matchedProducts.length > 0 ||
    /(catalogo|menu|precio|precios|cuanto cuesta|productos|disponible|opciones|combos|oferta)/.test(
      normalized,
    )
  ) {
    const featured =
      matchedProducts.length > 0
        ? matchedProducts.slice(0, 3)
        : availableProducts.slice(0, 4);
    if (featured.length > 0) {
      const list = featured
        .map((item) => `• ${item.name} — ${formatCOP(item.price)}`)
        .join("\n");
      return {
        text: `${tonePrefix}estas son las opciones disponibles ahora mismo:\n${list}\n\nSi deseas pedir alguna, indícame cantidad y dirección de entrega.`,
        traceability: {
          flow: "Consulta de catálogo",
          moduleTag: "Catálogo",
          suggestedAction: "Recomendar producto y cerrar pedido",
          confidence: 0.92,
        },
      };
    }

    const menuTpl = config.templates.find((tpl) => tpl.key === "menu");
    return {
      text:
        menuTpl?.text ??
        `${tonePrefix}cuéntame qué producto estás buscando y te comparto disponibilidad y precio de inmediato.`,
      traceability: {
        flow: "Consulta de catálogo",
        moduleTag: "Catálogo",
        suggestedAction: "Enviar catálogo actualizado",
        confidence: 0.87,
      },
    };
  }

  // 6. Purchase intent
  if (
    /(quiero|pedir|comprar|llevo|ordenar|domicilio|encargar|cotizar)/.test(
      normalized,
    )
  ) {
    return {
      text: `${tonePrefix}con mucho gusto te ayudo a registrar tu pedido. Confírmame por favor: 1) productos y cantidades, 2) dirección o si recoges en tienda, y 3) medio de pago preferido.`,
      traceability: {
        flow: "Captura de pedido",
        moduleTag: "Ventas",
        suggestedAction: "Crear pedido desde conversación",
        confidence: 0.9,
      },
    };
  }

  // 7. General fallback
  return {
    text: `${tonePrefix}recibí tu mensaje. Puedo ayudarte con nuestro catálogo y precios, tomar un pedido nuevo, revisar el seguimiento de una entrega o validar un pago. ¿Qué necesitas hoy?`,
    traceability: {
      flow: "Asistente general",
      moduleTag: "Bot IA",
      suggestedAction: "Clasificar necesidad del cliente",
      confidence: 0.82,
    },
  };
}

export function generateAgentSuggestion(
  conv: Conversation,
  linkedOrders: Order[],
): string {
  const firstName = conv.contact.name.trim().split(/\s+/)[0] || "cliente";
  const intention = classifyIntention(conv, linkedOrders);
  const sortedOrders = [...linkedOrders].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const latestOrder = sortedOrders[0];

  if (intention === "claim") {
    if (latestOrder) {
      return `Hola ${firstName}, ya reviso personalmente tu pedido ${latestOrder.code}. Permíteme un minuto para validar el estado con logística y darte una solución concreta hoy mismo.`;
    }
    return `Hola ${firstName}, lamento el inconveniente. Ya estoy revisando tu caso directamente para darte una respuesta clara y resolverlo cuanto antes.`;
  }

  if (intention === "track_order" && latestOrder) {
    if (latestOrder.carrier && latestOrder.trackingNumber) {
      return `Hola ${firstName}, acabo de verificar tu pedido ${latestOrder.code}: va en camino con ${latestOrder.carrier} bajo la guía ${latestOrder.trackingNumber}. Avísame si necesitas ayuda con la entrega.`;
    }
    const label = STAGE_LABELS[latestOrder.stage] ?? latestOrder.stage;
    return `Hola ${firstName}, tu pedido ${latestOrder.code} está actualmente en estado "${label}". Apenas tenga el siguiente avance te escribo de una vez.`;
  }

  const unpaid = sortedOrders.find(
    (order) => !order.paid && order.stage !== "cancelled",
  );
  if (unpaid) {
    return `Hola ${firstName}, ya tengo listo tu pedido ${unpaid.code} por ${formatCOP(unpaid.total)}. Si ya realizaste la transferencia, compárteme el comprobante para confirmar el pago.`;
  }

  if (intention === "buy") {
    return `Hola ${firstName}, ¡qué gusto saludarte! Cuéntame qué referencias y cantidades deseas confirmar junto con tu dirección para dejar listo tu pedido.`;
  }

  return `Hola ${firstName}, gracias por escribirnos. ¿En qué producto o pedido te puedo ayudar hoy?`;
}

function classifySentiment(
  conv: Conversation,
  linkedOrders: Order[],
): "positive" | "neutral" | "negative" {
  const customerText = conv.messages
    .filter((msg) => msg.author === "customer" && !msg.isInternalNote)
    .map((msg) => normalizeText(msg.text))
    .join(" ");

  if (
    /(reclamo|queja|problema|danado|demora|retraso|cancelar|mal|molesto|nunca llego|no llego|equivocado|error|cancelado)/.test(
      customerText,
    ) ||
    (conv.needsAttention &&
      linkedOrders.some((order) => order.stage === "cancelled"))
  ) {
    return "negative";
  }

  if (
    /(gracias|excelente|perfecto|genial|super|encanto|buenisimo|listo|mil gracias|chevere|delicioso|recomiendo)/.test(
      customerText,
    ) ||
    linkedOrders.some((order) => order.stage === "delivered")
  ) {
    return "positive";
  }

  return "neutral";
}

export function computeConversationAnalytics(
  conversations: Conversation[],
  orders: Order[],
  period: AnalyticsPeriod,
  now: Date = new Date(),
): ConversationAnalyticsSummary {
  const dateFilter: DateFilter =
    period === "today" ? "today" : period === "week" ? "7d" : "30d";

  const scoped = conversations.filter((conv) =>
    matchesDateFilter(conv.lastActivityAt, dateFilter, now),
  );

  const total = scoped.length;
  let botResolvedCount = 0;
  let orderConversionCount = 0;
  let totalResponseMinutes = 0;
  let responseSamples = 0;

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const intents: Record<ConversationIntention, number> = {
    inquire: 0,
    buy: 0,
    track_order: 0,
    claim: 0,
  };

  for (const conv of scoped) {
    const linked = orders.filter(
      (order) =>
        phonesMatch(order.customerPhone, conv.contact.phone) ||
        conv.messages.some((msg) => msg.orderId === order.id),
    );

    const visibleMessages = conv.messages.filter((msg) => !msg.isInternalNote);
    const hasBotReply = visibleMessages.some((msg) => msg.author === "bot");
    const hasAgentReply = visibleMessages.some((msg) => msg.author === "agent");

    if (
      hasBotReply &&
      !hasAgentReply &&
      !conv.needsAttention &&
      conv.attentionMode === "bot"
    ) {
      botResolvedCount += 1;
    }

    if (linked.some((order) => order.stage !== "cancelled")) {
      orderConversionCount += 1;
    }

    for (let i = 0; i < visibleMessages.length - 1; i += 1) {
      const current = visibleMessages[i];
      const next = visibleMessages[i + 1];
      if (
        current.author === "customer" &&
        (next.author === "bot" || next.author === "agent")
      ) {
        const diffMs =
          new Date(next.createdAt).getTime() -
          new Date(current.createdAt).getTime();
        if (Number.isFinite(diffMs) && diffMs >= 0) {
          totalResponseMinutes += diffMs / 60_000;
          responseSamples += 1;
        }
      }
    }

    const intent = classifyIntention(conv, linked);
    intents[intent] += 1;

    const mood = classifySentiment(conv, linked);
    sentiment[mood] += 1;
  }

  return {
    period,
    total,
    botResolvedCount,
    botResolutionRate:
      total > 0 ? Math.round((botResolvedCount / total) * 100) : 0,
    avgResponseMinutes:
      responseSamples > 0
        ? Math.round((totalResponseMinutes / responseSamples) * 10) / 10
        : 0,
    orderConversionCount,
    orderConversionRate:
      total > 0 ? Math.round((orderConversionCount / total) * 100) : 0,
    sentiment,
    intents,
  };
}

// ---------------------------------------------------------------------------
// Realistic Colombian demo seed conversations (18 threads, 12 linked P-001..P-012)
// ---------------------------------------------------------------------------

function offsetIso(now: Date, minutesDelta: number): string {
  return new Date(now.getTime() + minutesDelta * 60_000).toISOString();
}

function formatAddressSummary(address?: OrderAddress): string | undefined {
  if (!address?.street) return undefined;
  return [address.street, address.neighborhood, address.city]
    .filter(Boolean)
    .join(", ");
}

function avatarColorFor(index: number): string {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
}

export function createSeedConversations(
  orders: Order[],
  now: Date = new Date(),
): Conversation[] {
  const sourceOrders = orders.length > 0 ? orders : createSeedOrders(now);
  const byCode = new Map<string, Order>();
  for (const order of sourceOrders) {
    byCode.set(order.code.toUpperCase(), order);
  }

  // Fallback map in case custom orders omitted any P-001..P-012 code
  const fallbackOrders = createSeedOrders(now);
  const getOrder = (code: string): Order =>
    byCode.get(code.toUpperCase()) ??
    fallbackOrders.find((o) => o.code.toUpperCase() === code.toUpperCase()) ??
    fallbackOrders[0];

  const D = 1440;
  const H = 60;

  const p010 = getOrder("P-010");
  const p005 = getOrder("P-005");
  const p009 = getOrder("P-009");
  const p008 = getOrder("P-008");
  const p007 = getOrder("P-007");
  const p006 = getOrder("P-006");
  const p012 = getOrder("P-012");
  const p011 = getOrder("P-011");
  const p004 = getOrder("P-004");
  const p003 = getOrder("P-003");
  const p002 = getOrder("P-002");
  const p001 = getOrder("P-001");

  const conversations: Conversation[] = [
    // 1. P-010 — Alejandro Vélez (WhatsApp, waiting, unpaid transfer, unread, starred, internal note)
    {
      id: "conv-seed-001",
      channel: "whatsapp",
      contact: {
        name: p010.customerName,
        phone: p010.customerPhone,
        lid: "573023334455@s.whatsapp.net",
        avatarColor: avatarColorFor(0),
        address: formatAddressSummary(p010.address),
        notes: "Cliente corporativo frecuente en Chapinero. Llamar 10 min antes de entregar.",
      },
      status: "waiting",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: true,
      aiActive: false,
      unreadCount: 2,
      starred: true,
      createdAt: offsetIso(now, -5 * H),
      lastActivityAt: offsetIso(now, -6),
      messages: [
        {
          id: "msg-001-1",
          conversationId: "conv-seed-001",
          author: "customer",
          authorName: p010.customerName,
          text: "Hola, ya hice el pedido de los Audífonos Inalámbricos Pro y el estuche. ¿Me confirman la guía de Envía?",
          createdAt: offsetIso(now, -2 * H),
          wamid: "wamid.HBgMNTczMDIzMzM0NDU1FQIAERgS001",
          read: true,
        },
        {
          id: "msg-001-2",
          conversationId: "conv-seed-001",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Hola Alejandro! Tu pedido ${p010.code} por ${formatCOP(p010.total)} ya va en camino con ${p010.carrier ?? "Envía"} bajo la guía ${p010.trackingNumber ?? "50000112926"}.`,
          createdAt: offsetIso(now, -2 * H + 1),
          read: true,
          orderId: p010.id,
          traceability: {
            flow: "Seguimiento de pedido",
            moduleTag: "Pedidos",
            suggestedAction: "Validar transferencia pendiente",
            confidence: 0.96,
            orderId: p010.id,
          },
        },
        {
          id: "msg-001-3",
          conversationId: "conv-seed-001",
          author: "agent",
          authorName: "Mateo Vargas",
          text: "Nota interna: falta confirmar ingreso de transferencia Bancolombia antes de cerrar recaudo.",
          createdAt: offsetIso(now, -45),
          isInternalNote: true,
          read: true,
        },
        {
          id: "msg-001-4",
          conversationId: "conv-seed-001",
          author: "customer",
          authorName: p010.customerName,
          text: "Ya transferí por Bancolombia el comprobante #849201, ¿me pueden validar el pago y hablar con un asesor por favor?",
          createdAt: offsetIso(now, -8),
          wamid: "wamid.HBgMNTczMDIzMzM0NDU1FQIAERgS002",
          read: false,
        },
        {
          id: "msg-001-5",
          conversationId: "conv-seed-001",
          author: "customer",
          authorName: p010.customerName,
          text: "También necesito que le avisen al mensajero que llame al llegar a portería.",
          createdAt: offsetIso(now, -6),
          wamid: "wamid.HBgMNTczMDIzMzM0NDU1FQIAERgS003",
          read: false,
        },
      ],
      events: [
        {
          id: "ev-001-1",
          conversationId: "conv-seed-001",
          kind: "order_linked",
          text: `Pedido ${p010.code} vinculado automáticamente al chat.`,
          createdAt: offsetIso(now, -2 * H + 1),
        },
        {
          id: "ev-001-2",
          conversationId: "conv-seed-001",
          kind: "handoff_requested",
          text: "El cliente solicitó validación de comprobante con un asesor humano.",
          createdAt: offsetIso(now, -6),
        },
      ],
    },

    // 2. P-005 — Andrés Gil (WhatsApp, waiting, delivery incident, unread, starred, internal note)
    {
      id: "conv-seed-002",
      channel: "whatsapp",
      contact: {
        name: p005.customerName,
        phone: p005.customerPhone,
        lid: "573005556677@s.whatsapp.net",
        avatarColor: avatarColorFor(1),
        address: formatAddressSummary(p005.address),
        notes: "Novedad previa en Bucaramanga: faltaba número de apartamento.",
      },
      status: "waiting",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: true,
      aiActive: false,
      unreadCount: 1,
      starred: true,
      createdAt: offsetIso(now, -36 * H),
      lastActivityAt: offsetIso(now, -14),
      messages: [
        {
          id: "msg-002-1",
          conversationId: "conv-seed-002",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `Hola Andrés, se presentó una novedad en la entrega de tu pedido ${p005.code} con InterRapidísimo (guía ${p005.trackingNumber ?? "50000112877"}). Necesitamos confirmar tu número de apartamento para reprogramar.`,
          createdAt: offsetIso(now, -6 * H),
          read: true,
          orderId: p005.id,
          traceability: {
            flow: "Gestión de novedad logística",
            moduleTag: "Incidencias",
            suggestedAction: "Confirmar dirección y reprogramar envío",
            confidence: 0.98,
            orderId: p005.id,
          },
        },
        {
          id: "msg-002-2",
          conversationId: "conv-seed-002",
          author: "agent",
          authorName: "Laura Giraldo",
          text: "Nota interna: InterRapidísimo retiene paquete en bodega Cabecera hasta mañana 10:00 a. m.",
          createdAt: offsetIso(now, -3 * H),
          isInternalNote: true,
          read: true,
        },
        {
          id: "msg-002-3",
          conversationId: "conv-seed-002",
          author: "customer",
          authorName: p005.customerName,
          text: "Buenas tardes, hubo un problema con la entrega y no ha llegado mi morral. Es Torre 2 Apto 504, ¿me ayudan a reprogramar hoy?",
          createdAt: offsetIso(now, -14),
          wamid: "wamid.HBgMNTczMDA1NTU2Njc3FQIAERgS004",
          read: false,
        },
      ],
      events: [
        {
          id: "ev-002-1",
          conversationId: "conv-seed-002",
          kind: "order_linked",
          text: `Pedido ${p005.code} vinculado con novedad activa.`,
          createdAt: offsetIso(now, -6 * H),
        },
        {
          id: "ev-002-2",
          conversationId: "conv-seed-002",
          kind: "handoff_requested",
          text: "Escalamiento automático por novedad de entrega reportada por el cliente.",
          createdAt: offsetIso(now, -14),
        },
      ],
    },

    // 3. Instagram prospect — Daniela Ospina (Instagram, waiting, needsAttention, unread, offer_sent)
    {
      id: "conv-seed-003",
      channel: "instagram",
      contact: {
        name: "Daniela Ospina",
        phone: "+57 319 448 2210",
        avatarColor: avatarColorFor(2),
        address: "Carrera 43A # 14-50, El Poblado, Medellín",
        notes: "Interesada en pedido corporativo de 12 combos para viernes.",
      },
      status: "waiting",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: true,
      aiActive: false,
      unreadCount: 1,
      starred: true,
      createdAt: offsetIso(now, -95),
      lastActivityAt: offsetIso(now, -22),
      messages: [
        {
          id: "msg-003-1",
          conversationId: "conv-seed-003",
          author: "customer",
          authorName: "Daniela Ospina",
          text: "Hola! Vi sus combos en Instagram, ¿qué precio tienen para un evento de 12 personas en El Poblado?",
          createdAt: offsetIso(now, -95),
          read: true,
        },
        {
          id: "msg-003-2",
          conversationId: "conv-seed-003",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: "¡Hola Daniela! Tenemos el Combo Parrilla Familiar en $ 89.000 (rinde para 4 personas) y Hamburguesa Doble Brioche en $ 28.000. Para 12 personas te recomiendo 3 Combos Parrilla Familiar.",
          createdAt: offsetIso(now, -94),
          read: true,
          traceability: {
            flow: "Consulta de catálogo",
            moduleTag: "Catálogo",
            suggestedAction: "Enviar cotización para evento",
            confidence: 0.93,
          },
        },
        {
          id: "msg-003-3",
          conversationId: "conv-seed-003",
          author: "customer",
          authorName: "Daniela Ospina",
          text: "Perfecto, necesito factura electrónica a nombre de nuestra agencia. ¿Puedo hablar con un asesor para cerrar el pedido?",
          createdAt: offsetIso(now, -22),
          read: false,
        },
      ],
      events: [
        {
          id: "ev-003-1",
          conversationId: "conv-seed-003",
          kind: "handoff_requested",
          text: "Solicitud de asesor por facturación electrónica corporativa.",
          createdAt: offsetIso(now, -22),
        },
      ],
    },

    // 4. P-009 — David Restrepo (WhatsApp, attended by Camila Ortiz, COD unpaid, payment_validation)
    {
      id: "conv-seed-004",
      channel: "whatsapp",
      contact: {
        name: p009.customerName,
        phone: p009.customerPhone,
        lid: "573021112233@s.whatsapp.net",
        avatarColor: avatarColorFor(3),
        address: formatAddressSummary(p009.address),
        notes: "Pago contra entrega en local de diseño, segundo piso.",
      },
      status: "attended",
      attentionMode: "human",
      assignedOperatorId: "op-camila",
      assignedOperatorName: "Camila Ortiz",
      needsAttention: false,
      aiActive: false,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -8 * H),
      lastActivityAt: offsetIso(now, -38),
      messages: [
        {
          id: "msg-004-1",
          conversationId: "conv-seed-004",
          author: "customer",
          authorName: p009.customerName,
          text: "Hola, mi pedido de los Tenis Running Ultralight talla 42 es contra entrega. ¿Puedo pagar por Nequi cuando llegue el mensajero?",
          createdAt: offsetIso(now, -52),
          wamid: "wamid.HBgMNTczMDIxMTEyMjMzFQIAERgS005",
          read: true,
        },
        {
          id: "msg-004-2",
          conversationId: "conv-seed-004",
          author: "agent",
          authorName: "Camila Ortiz",
          text: `Hola David, sí claro. Tu pedido ${p009.code} (${formatCOP(p009.total)}) va con Coordinadora bajo la guía ${p009.trackingNumber ?? "50000113753"}. Puedes pagar en efectivo al mensajero o transferirnos por Nequi antes de la entrega.`,
          createdAt: offsetIso(now, -38),
          read: true,
          orderId: p009.id,
        },
        {
          id: "msg-004-3",
          conversationId: "conv-seed-004",
          author: "agent",
          authorName: "Camila Ortiz",
          text: "Nota interna: cliente prefirió confirmar pago al recibir en Belén.",
          createdAt: offsetIso(now, -36),
          isInternalNote: true,
          read: true,
        },
      ],
      events: [
        {
          id: "ev-004-1",
          conversationId: "conv-seed-004",
          kind: "order_linked",
          text: `Pedido ${p009.code} asociado a la conversación.`,
          createdAt: offsetIso(now, -8 * H),
        },
        {
          id: "ev-004-2",
          conversationId: "conv-seed-004",
          kind: "taken",
          text: "Camila Ortiz tomó la conversación.",
          createdAt: offsetIso(now, -40),
        },
      ],
    },

    // 5. P-008 — Carolina Herrera (WhatsApp, open, bot active, track_order, follow_up)
    {
      id: "conv-seed-005",
      channel: "whatsapp",
      contact: {
        name: p008.customerName,
        phone: p008.customerPhone,
        lid: "573019998877@s.whatsapp.net",
        avatarColor: avatarColorFor(4),
        address: formatAddressSummary(p008.address),
      },
      status: "open",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -12 * H),
      lastActivityAt: offsetIso(now, -65),
      messages: [
        {
          id: "msg-005-1",
          conversationId: "conv-seed-005",
          author: "customer",
          authorName: p008.customerName,
          text: "Hola, ¿dónde va mi pedido del Kit Cuidado Facial? Ya me llegó el cobro a la tarjeta.",
          createdAt: offsetIso(now, -67),
          wamid: "wamid.HBgMNTczMDE5OTk4ODc3FQIAERgS006",
          read: true,
        },
        {
          id: "msg-005-2",
          conversationId: "conv-seed-005",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Hola Carolina! Tu pedido ${p008.code} (${formatCOP(p008.total)}) ya está pago y en camino con Servientrega, guía ${p008.trackingNumber ?? "50000112918"}. Llega a recepción corporativa en Chicó Norte.`,
          createdAt: offsetIso(now, -65),
          read: true,
          orderId: p008.id,
          traceability: {
            flow: "Seguimiento de pedido",
            moduleTag: "Pedidos",
            suggestedAction: "Monitorear entrega Servientrega",
            confidence: 0.97,
            orderId: p008.id,
          },
        },
      ],
      events: [
        {
          id: "ev-005-1",
          conversationId: "conv-seed-005",
          kind: "order_linked",
          text: `Pedido ${p008.code} vinculado automáticamente.`,
          createdAt: offsetIso(now, -12 * H),
        },
      ],
    },

    // 6. Messenger prospect — Juan Pablo Serrano (Messenger, attended by Mateo Vargas, offer_sent)
    {
      id: "conv-seed-006",
      channel: "messenger",
      contact: {
        name: "Juan Pablo Serrano",
        phone: "+57 313 704 1192",
        avatarColor: avatarColorFor(5),
        address: "Calle 127 # 19-40, Usaquén, Bogotá",
      },
      status: "attended",
      attentionMode: "human",
      assignedOperatorId: "op-mateo",
      assignedOperatorName: "Mateo Vargas",
      needsAttention: false,
      aiActive: false,
      unreadCount: 1,
      starred: false,
      createdAt: offsetIso(now, -3 * H),
      lastActivityAt: offsetIso(now, -90),
      messages: [
        {
          id: "msg-006-1",
          conversationId: "conv-seed-006",
          author: "customer",
          authorName: "Juan Pablo Serrano",
          text: "Buenas, ¿tienen disponible la Chaqueta Impermeable Urbana en talla M y cuánto cuesta el envío a Bogotá?",
          createdAt: offsetIso(now, -3 * H),
          read: true,
        },
        {
          id: "msg-006-2",
          conversationId: "conv-seed-006",
          author: "agent",
          authorName: "Mateo Vargas",
          text: "Hola Juan Pablo, sí la tenemos disponible en talla M por $ 145.000. El envío a Bogotá cuesta $ 11.000 y llega en 24 horas.",
          createdAt: offsetIso(now, -2 * H),
          read: true,
        },
        {
          id: "msg-006-3",
          conversationId: "conv-seed-006",
          author: "customer",
          authorName: "Juan Pablo Serrano",
          text: "Súper, hoy en la tarde te confirmo el color negro o azul oscuro.",
          createdAt: offsetIso(now, -90),
          read: false,
        },
      ],
      events: [
        {
          id: "ev-006-1",
          conversationId: "conv-seed-006",
          kind: "taken",
          text: "Mateo Vargas tomó la conversación para asesoría de talla.",
          createdAt: offsetIso(now, -2 * H - 5),
        },
      ],
    },

    // 7. TikTok prospect — Sofía Betancur (TikTok, open, bot active, initial_contact, unread)
    {
      id: "conv-seed-007",
      channel: "tiktok",
      contact: {
        name: "Sofía Betancur",
        phone: "+57 320 612 9084",
        avatarColor: avatarColorFor(6),
      },
      status: "open",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 1,
      starred: false,
      createdAt: offsetIso(now, -4 * H),
      lastActivityAt: offsetIso(now, -135),
      messages: [
        {
          id: "msg-007-1",
          conversationId: "conv-seed-007",
          author: "customer",
          authorName: "Sofía Betancur",
          text: "Hola!! Vi su video en TikTok, ¿hacen envíos a Pereira?",
          createdAt: offsetIso(now, -136),
          read: false,
        },
        {
          id: "msg-007-2",
          conversationId: "conv-seed-007",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: "¡Hola Sofía! Sí, hacemos envíos a Pereira y a toda Colombia con Coordinadora, Servientrega y Envía. ¿Qué producto viste en el video?",
          createdAt: offsetIso(now, -135),
          read: true,
          traceability: {
            flow: "Consulta de cobertura",
            moduleTag: "Atención",
            suggestedAction: "Identificar producto de interés",
            confidence: 0.91,
          },
        },
      ],
      events: [],
    },

    // 8. P-007 — Valentina Ríos (WhatsApp, open, bot active, yesterday, starred, follow_up)
    {
      id: "conv-seed-008",
      channel: "whatsapp",
      contact: {
        name: p007.customerName,
        phone: p007.customerPhone,
        lid: "573018889900@s.whatsapp.net",
        avatarColor: avatarColorFor(7),
        address: formatAddressSummary(p007.address),
      },
      status: "open",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: true,
      createdAt: offsetIso(now, -28 * H),
      lastActivityAt: offsetIso(now, -25 * H),
      messages: [
        {
          id: "msg-008-1",
          conversationId: "conv-seed-008",
          author: "customer",
          authorName: p007.customerName,
          text: "Hola, ¿ya despacharon mi prensa francesa y el café de origen Huila hacia Cali?",
          createdAt: offsetIso(now, -25 * H - 2),
          wamid: "wamid.HBgMNTczMDE4ODg5OTAwFQIAERgS007",
          read: true,
        },
        {
          id: "msg-008-2",
          conversationId: "conv-seed-008",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Hola Valentina! Sí, tu pedido ${p007.code} (${formatCOP(p007.total)}) ya salió con TCC, guía ${p007.trackingNumber ?? "50000112113"}. ¡Gracias por tu compra!`,
          createdAt: offsetIso(now, -25 * H),
          read: true,
          orderId: p007.id,
          traceability: {
            flow: "Seguimiento de pedido",
            moduleTag: "Pedidos",
            suggestedAction: "Confirmar recepción en Cali",
            confidence: 0.96,
            orderId: p007.id,
          },
        },
      ],
      events: [
        {
          id: "ev-008-1",
          conversationId: "conv-seed-008",
          kind: "order_linked",
          text: `Pedido ${p007.code} vinculado al hilo.`,
          createdAt: offsetIso(now, -28 * H),
        },
      ],
    },

    // 9. P-006 — Sofía Díaz (WhatsApp, waiting, cancelled order claim, yesterday)
    {
      id: "conv-seed-009",
      channel: "whatsapp",
      contact: {
        name: p006.customerName,
        phone: p006.customerPhone,
        lid: "573017773344@s.whatsapp.net",
        avatarColor: avatarColorFor(8),
        address: formatAddressSummary(p006.address),
      },
      status: "waiting",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: true,
      aiActive: false,
      unreadCount: 1,
      starred: false,
      createdAt: offsetIso(now, -2 * D),
      lastActivityAt: offsetIso(now, -27 * H),
      messages: [
        {
          id: "msg-009-1",
          conversationId: "conv-seed-009",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `Hola Sofía, tu pedido ${p006.code} (${formatCOP(p006.total)}) fue cancelado porque se reportó desistimiento en la entrega. Si fue un error, escríbenos por aquí.`,
          createdAt: offsetIso(now, -28 * H),
          read: true,
          orderId: p006.id,
          traceability: {
            flow: "Notificación de cancelación",
            moduleTag: "Pedidos",
            suggestedAction: "Recuperar pedido si el cliente lo solicita",
            confidence: 0.94,
            orderId: p006.id,
          },
        },
        {
          id: "msg-009-2",
          conversationId: "conv-seed-009",
          author: "customer",
          authorName: p006.customerName,
          text: "Hola, el mensajero llamó cuando yo estaba en reunión y cancelaron la lámpara por error. ¿Podemos reactivar el pedido?",
          createdAt: offsetIso(now, -27 * H),
          wamid: "wamid.HBgMNTczMDE3NzczMzQ0FQIAERgS008",
          read: false,
        },
      ],
      events: [
        {
          id: "ev-009-1",
          conversationId: "conv-seed-009",
          kind: "handoff_requested",
          text: "Cliente solicita reactivar pedido cancelado P-006.",
          createdAt: offsetIso(now, -27 * H),
        },
      ],
    },

    // 10. Telegram prospect — Esteban Cardona (Telegram, open, bot active, yesterday, initial_contact)
    {
      id: "conv-seed-010",
      channel: "telegram",
      contact: {
        name: "Esteban Cardona",
        phone: "+57 301 520 7788",
        avatarColor: avatarColorFor(9),
      },
      status: "open",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -30 * H),
      lastActivityAt: offsetIso(now, -29 * H),
      messages: [
        {
          id: "msg-010-1",
          conversationId: "conv-seed-010",
          author: "customer",
          authorName: "Esteban Cardona",
          text: "Hola, ¿cuál es el horario de atención en tienda física?",
          createdAt: offsetIso(now, -29 * H - 1),
          read: true,
        },
        {
          id: "msg-010-2",
          conversationId: "conv-seed-010",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: "¡Hola Esteban! Atendemos de lunes a sábado de 8:00 a 20:00. También puedes agendar tu pedido por aquí y pasar a recogerlo sin hacer fila.",
          createdAt: offsetIso(now, -29 * H),
          read: true,
          traceability: {
            flow: "Información de tienda",
            moduleTag: "Atención",
            suggestedAction: "Ofrecer retiro en tienda",
            confidence: 0.95,
          },
        },
      ],
      events: [],
    },

    // 11. WhatsApp prospect — Manuela Ramírez (WhatsApp, attended by Camila Ortiz, 2d ago, payment_validation)
    {
      id: "conv-seed-011",
      channel: "whatsapp",
      contact: {
        name: "Manuela Ramírez",
        phone: "+57 317 890 4512",
        lid: "573178904512@s.whatsapp.net",
        avatarColor: avatarColorFor(0),
        address: "Calle 7 Sur # 42-70, El Poblado, Medellín",
        notes: "Quiere pagar por Daviplata al confirmar stock de postres.",
      },
      status: "attended",
      attentionMode: "human",
      assignedOperatorId: "op-camila",
      assignedOperatorName: "Camila Ortiz",
      needsAttention: false,
      aiActive: false,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -2 * D - 3 * H),
      lastActivityAt: offsetIso(now, -2 * D),
      messages: [
        {
          id: "msg-011-1",
          conversationId: "conv-seed-011",
          author: "customer",
          authorName: "Manuela Ramírez",
          text: "Hola, quiero pedir 4 Brownies Artesanales con Helado y 2 Limonadas de Coco para hoy en la tarde.",
          createdAt: offsetIso(now, -2 * D - 3 * H),
          wamid: "wamid.HBgMNTczMTc4OTA0NTEyFQIAERgS009",
          read: true,
        },
        {
          id: "msg-011-2",
          conversationId: "conv-seed-011",
          author: "agent",
          authorName: "Camila Ortiz",
          text: "¡Hola Manuela! Los 4 brownies ($ 54.000) + 2 limonadas ($ 23.000) + domicilio ($ 6.500) dan $ 83.500. ¿Prefieres transferencia Bancolombia, Nequi o Daviplata?",
          createdAt: offsetIso(now, -2 * D - 2 * H),
          read: true,
        },
        {
          id: "msg-011-3",
          conversationId: "conv-seed-011",
          author: "customer",
          authorName: "Manuela Ramírez",
          text: "Te transfiero por Daviplata en un momento y te mando el comprobante.",
          createdAt: offsetIso(now, -2 * D),
          wamid: "wamid.HBgMNTczMTc4OTA0NTEyFQIAERgS010",
          read: true,
        },
      ],
      events: [
        {
          id: "ev-011-1",
          conversationId: "conv-seed-011",
          kind: "taken",
          text: "Camila Ortiz tomó la conversación.",
          createdAt: offsetIso(now, -2 * D - 2 * H - 5),
        },
      ],
    },

    // 12. P-012 — Juliana Gómez (WhatsApp, closed, delivered 4d ago, starred)
    {
      id: "conv-seed-012",
      channel: "whatsapp",
      contact: {
        name: p012.customerName,
        phone: p012.customerPhone,
        lid: "573104429811@s.whatsapp.net",
        avatarColor: avatarColorFor(1),
        address: formatAddressSummary(p012.address),
      },
      status: "closed",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -4 * D - 2 * H),
      lastActivityAt: offsetIso(now, -4 * D),
      messages: [
        {
          id: "msg-012-1",
          conversationId: "conv-seed-012",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Pedido ${p012.code} entregado! Gracias por tu compra de ${formatCOP(p012.total)}, Juliana.`,
          createdAt: offsetIso(now, -4 * D - 20),
          read: true,
          orderId: p012.id,
          traceability: {
            flow: "Cierre post-entrega",
            moduleTag: "Pedidos",
            suggestedAction: "Solicitar calificación",
            confidence: 0.98,
            orderId: p012.id,
          },
        },
        {
          id: "msg-012-2",
          conversationId: "conv-seed-012",
          author: "customer",
          authorName: p012.customerName,
          text: "Mil gracias, todo llegó súper caliente y delicioso. ¡Excelente servicio!",
          createdAt: offsetIso(now, -4 * D),
          wamid: "wamid.HBgMNTczMTA0NDI5ODExFQIAERgS011",
          read: true,
        },
      ],
      events: [
        {
          id: "ev-012-1",
          conversationId: "conv-seed-012",
          kind: "order_linked",
          text: `Pedido ${p012.code} completado y entregado.`,
          createdAt: offsetIso(now, -4 * D - 20),
        },
        {
          id: "ev-012-2",
          conversationId: "conv-seed-012",
          kind: "closed",
          text: "Conversación cerrada tras confirmación de entrega.",
          createdAt: offsetIso(now, -4 * D + 5),
        },
      ],
    },

    // 13. Instagram prospect — Nicolás Herrera (Instagram, open, bot active, 5d ago, offer_sent)
    {
      id: "conv-seed-013",
      channel: "instagram",
      contact: {
        name: "Nicolás Herrera",
        phone: "+57 300 718 3390",
        avatarColor: avatarColorFor(2),
      },
      status: "open",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -5 * D - 40),
      lastActivityAt: offsetIso(now, -5 * D),
      messages: [
        {
          id: "msg-013-1",
          conversationId: "conv-seed-013",
          author: "customer",
          authorName: "Nicolás Herrera",
          text: "Hola, ¿me pasas el catálogo con precios de los combos?",
          createdAt: offsetIso(now, -5 * D - 10),
          read: true,
        },
        {
          id: "msg-013-2",
          conversationId: "conv-seed-013",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: "¡Hola Nicolás! Aquí tienes nuestros favoritos:\n• Combo Parrilla Familiar — $ 89.000\n• Hamburguesa Doble Brioche — $ 28.000\n• Limonada de Coco 500ml — $ 11.500\n¿Te gustaría agendar un pedido?",
          createdAt: offsetIso(now, -5 * D),
          read: true,
          traceability: {
            flow: "Consulta de catálogo",
            moduleTag: "Catálogo",
            suggestedAction: "Hacer seguimiento comercial",
            confidence: 0.94,
          },
        },
      ],
      events: [],
    },

    // 14. P-011 — Mateo Quintero (WhatsApp, closed, delivered 6d ago)
    {
      id: "conv-seed-014",
      channel: "whatsapp",
      contact: {
        name: p011.customerName,
        phone: p011.customerPhone,
        lid: "573123157740@s.whatsapp.net",
        avatarColor: avatarColorFor(3),
      },
      status: "closed",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -7 * D),
      lastActivityAt: offsetIso(now, -6 * D - 20 * H),
      messages: [
        {
          id: "msg-014-1",
          conversationId: "conv-seed-014",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `Hola Mateo, tu pedido ${p011.code} (3 Camisetas Básicas Algodón Pima por ${formatCOP(p011.total)}) ya está listo para retirar en tienda.`,
          createdAt: offsetIso(now, -7 * D + 15),
          read: true,
          orderId: p011.id,
          traceability: {
            flow: "Aviso de retiro en tienda",
            moduleTag: "Pedidos",
            suggestedAction: "Entregar en mostrador",
            confidence: 0.97,
            orderId: p011.id,
          },
        },
        {
          id: "msg-014-2",
          conversationId: "conv-seed-014",
          author: "customer",
          authorName: p011.customerName,
          text: "Listo, ya las recogí. Excelente calidad, gracias.",
          createdAt: offsetIso(now, -6 * D - 20 * H),
          wamid: "wamid.HBgMNTczMTIzMTU3NzQwFQIAERgS012",
          read: true,
        },
      ],
      events: [
        {
          id: "ev-014-1",
          conversationId: "conv-seed-014",
          kind: "closed",
          text: "Conversación cerrada por Camila Ortiz.",
          createdAt: offsetIso(now, -6 * D - 19 * H),
        },
      ],
    },

    // 15. P-004 — Lucía Torres (WhatsApp, closed, delivered 10d ago)
    {
      id: "conv-seed-015",
      channel: "whatsapp",
      contact: {
        name: p004.customerName,
        phone: p004.customerPhone,
        lid: "573004445566@s.whatsapp.net",
        avatarColor: avatarColorFor(4),
        address: formatAddressSummary(p004.address),
      },
      status: "closed",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -12 * D),
      lastActivityAt: offsetIso(now, -10 * D),
      messages: [
        {
          id: "msg-015-1",
          conversationId: "conv-seed-015",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Hola Lucía! Confirmamos la entrega de tu pedido ${p004.code} (${formatCOP(p004.total)}) con Coordinadora.`,
          createdAt: offsetIso(now, -10 * D - 15),
          read: true,
          orderId: p004.id,
          traceability: {
            flow: "Confirmación de entrega",
            moduleTag: "Pedidos",
            suggestedAction: "Fidelizar cliente",
            confidence: 0.99,
            orderId: p004.id,
          },
        },
        {
          id: "msg-015-2",
          conversationId: "conv-seed-015",
          author: "customer",
          authorName: p004.customerName,
          text: "Recibido todo en perfecto estado en portería. ¡Muchas gracias!",
          createdAt: offsetIso(now, -10 * D),
          wamid: "wamid.HBgMNTczMDA0NDQ1NTY2FQIAERgS013",
          read: true,
        },
      ],
      events: [
        {
          id: "ev-015-1",
          conversationId: "conv-seed-015",
          kind: "closed",
          text: "Conversación cerrada automáticamente.",
          createdAt: offsetIso(now, -10 * D + 10),
        },
      ],
    },

    // 16. P-003 — Pedro Ramírez (WhatsApp, attended by Laura Giraldo, reopened for repeat purchase 13d ago)
    {
      id: "conv-seed-016",
      channel: "whatsapp",
      contact: {
        name: p003.customerName,
        phone: p003.customerPhone,
        lid: "573003334455@s.whatsapp.net",
        avatarColor: avatarColorFor(5),
        address: formatAddressSummary(p003.address),
        notes: "Interesado en 2 sillas ergonómicas adicionales para oficina.",
      },
      status: "attended",
      attentionMode: "human",
      assignedOperatorId: "op-laura",
      assignedOperatorName: "Laura Giraldo",
      needsAttention: false,
      aiActive: false,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -16 * D),
      lastActivityAt: offsetIso(now, -13 * D),
      messages: [
        {
          id: "msg-016-1",
          conversationId: "conv-seed-016",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `Hola Pedro, tu pedido ${p003.code} por ${formatCOP(p003.total)} fue entregado en Chapinero.`,
          createdAt: offsetIso(now, -14 * D),
          read: true,
          orderId: p003.id,
          traceability: {
            flow: "Confirmación de entrega",
            moduleTag: "Pedidos",
            suggestedAction: "Ofrecer recompra corporativa",
            confidence: 0.96,
            orderId: p003.id,
          },
        },
        {
          id: "msg-016-2",
          conversationId: "conv-seed-016",
          author: "customer",
          authorName: p003.customerName,
          text: "Hola, la silla salió muy buena. ¿Me pueden cotizar 2 unidades más para la oficina?",
          createdAt: offsetIso(now, -13 * D - 30),
          wamid: "wamid.HBgMNTczMDAzMzM0NDU1FQIAERgS014",
          read: true,
        },
        {
          id: "msg-016-3",
          conversationId: "conv-seed-016",
          author: "agent",
          authorName: "Laura Giraldo",
          text: "¡Hola Pedro! Con gusto. Por 2 sillas ergonómicas te dejamos envío preferencial y factura empresarial. Te envío la cotización en unos minutos.",
          createdAt: offsetIso(now, -13 * D),
          read: true,
        },
      ],
      events: [
        {
          id: "ev-016-1",
          conversationId: "conv-seed-016",
          kind: "reopened",
          text: "Conversación reabierta por nueva cotización del cliente.",
          createdAt: offsetIso(now, -13 * D - 30),
        },
        {
          id: "ev-016-2",
          conversationId: "conv-seed-016",
          kind: "taken",
          text: "Laura Giraldo tomó la conversación.",
          createdAt: offsetIso(now, -13 * D - 5),
        },
      ],
    },

    // 17. P-002 — Mariana Salazar (WhatsApp, closed, delivered 19d ago)
    {
      id: "conv-seed-017",
      channel: "whatsapp",
      contact: {
        name: p002.customerName,
        phone: p002.customerPhone,
        lid: "573162091144@s.whatsapp.net",
        avatarColor: avatarColorFor(6),
      },
      status: "closed",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -19 * D - 60),
      lastActivityAt: offsetIso(now, -19 * D),
      messages: [
        {
          id: "msg-017-1",
          conversationId: "conv-seed-017",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Gracias por visitarnos, Mariana! Registramos tu cuenta de ${p002.code} (${formatCOP(p002.total)}) en Mesa 4.`,
          createdAt: offsetIso(now, -19 * D - 10),
          read: true,
          orderId: p002.id,
          traceability: {
            flow: "Recibo digital",
            moduleTag: "Pedidos",
            suggestedAction: "Cerrar atención",
            confidence: 0.95,
            orderId: p002.id,
          },
        },
        {
          id: "msg-017-2",
          conversationId: "conv-seed-017",
          author: "customer",
          authorName: p002.customerName,
          text: "Genial, el tiramisú estuvo espectacular. ¡Volveremos pronto!",
          createdAt: offsetIso(now, -19 * D),
          wamid: "wamid.HBgMNTczMTYyMDkxMTQ0FQIAERgS015",
          read: true,
        },
      ],
      events: [
        {
          id: "ev-017-1",
          conversationId: "conv-seed-017",
          kind: "returned_to_bot",
          text: "Conversación devuelta al Bot Inteligente.",
          createdAt: offsetIso(now, -19 * D - 15),
        },
        {
          id: "ev-017-2",
          conversationId: "conv-seed-017",
          kind: "closed",
          text: "Conversación cerrada.",
          createdAt: offsetIso(now, -19 * D + 5),
        },
      ],
    },

    // 18. P-001 — Carlos Andrés Peña (WhatsApp, closed, delivered 24d ago)
    {
      id: "conv-seed-018",
      channel: "whatsapp",
      contact: {
        name: p001.customerName,
        phone: p001.customerPhone,
        lid: "573009124401@s.whatsapp.net",
        avatarColor: avatarColorFor(7),
      },
      status: "closed",
      attentionMode: "bot",
      assignedOperatorId: null,
      assignedOperatorName: null,
      needsAttention: false,
      aiActive: true,
      unreadCount: 0,
      starred: false,
      createdAt: offsetIso(now, -24 * D - 30),
      lastActivityAt: offsetIso(now, -24 * D),
      messages: [
        {
          id: "msg-018-1",
          conversationId: "conv-seed-018",
          author: "customer",
          authorName: p001.customerName,
          text: "Hola, quiero pedir 3 Combos Ejecutivos Especiales y 3 Jugos de Mango para recoger en 25 minutos.",
          createdAt: offsetIso(now, -24 * D - 30),
          wamid: "wamid.HBgMNTczMDA5MTI0NDAxFQIAERgS016",
          read: true,
        },
        {
          id: "msg-018-2",
          conversationId: "conv-seed-018",
          author: "bot",
          authorName: DEFAULT_CHANNEL_CONFIG.assistantName,
          text: `¡Listo Carlos! Confirmamos tu pedido ${p001.code} por ${formatCOP(p001.total)} para retiro en tienda. Te avisaremos cuando esté listo.`,
          createdAt: offsetIso(now, -24 * D - 28),
          read: true,
          orderId: p001.id,
          traceability: {
            flow: "Captura de pedido",
            moduleTag: "Ventas",
            suggestedAction: "Enviar a cocina",
            confidence: 0.97,
            orderId: p001.id,
          },
        },
        {
          id: "msg-018-3",
          conversationId: "conv-seed-018",
          author: "customer",
          authorName: p001.customerName,
          text: "Perfecto, ya pasé por ellos. Muchas gracias.",
          createdAt: offsetIso(now, -24 * D),
          wamid: "wamid.HBgMNTczMDA5MTI0NDAxFQIAERgS017",
          read: true,
        },
      ],
      events: [
        {
          id: "ev-018-1",
          conversationId: "conv-seed-018",
          kind: "order_linked",
          text: `Pedido ${p001.code} creado y entregado.`,
          createdAt: offsetIso(now, -24 * D - 28),
        },
        {
          id: "ev-018-2",
          conversationId: "conv-seed-018",
          kind: "closed",
          text: "Conversación cerrada.",
          createdAt: offsetIso(now, -24 * D + 5),
        },
      ],
    },
  ];

  return conversations;
}
