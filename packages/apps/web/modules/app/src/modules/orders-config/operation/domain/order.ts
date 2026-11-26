import type { OrderOperatorStage } from "../../types";

// ---------------------------------------------------------------------------
// Core order domain types
// ---------------------------------------------------------------------------

export type DefaultOrderStage =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type OrderStage = DefaultOrderStage | (string & {});

export type OrderModality = "delivery" | "pickup" | "onsite";

export type OrderPaymentMethod = "cash" | "transfer" | "card" | "cod";

export type OrderChannel = "whatsapp" | "operator";

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  image?: string;
}

export interface OrderExtraCharge {
  id: string;
  label: string;
  amount: number;
}

export interface OrderAddress {
  street: string;
  neighborhood?: string;
  reference?: string;
  department?: string;
  city?: string;
  notes?: string;
}

export interface OrderStatusEvent {
  id: string;
  stage: OrderStage;
  label: string;
  at: string;
  operator: string;
  note?: string;
}

export interface OrderAutomationMessage {
  id: string;
  channel: "whatsapp";
  event: string;
  message: string;
  sentAt: string;
  status: "sent" | "delivered" | "read";
}

export interface OrderOperatorAudit {
  id: string;
  operator: string;
  action: string;
  at: string;
}

export interface OrderColumn {
  id: string;
  label: string;
  color: string;
  isDefault: boolean;
}

export interface SavedCustomerAddress {
  id: string;
  phone: string;
  customerName: string;
  address: OrderAddress;
  updatedAt: string;
}

export interface Order {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  extraCharges: OrderExtraCharge[];
  shippingFee: number;
  subtotal: number;
  total: number;
  modality: OrderModality;
  table?: string;
  address?: OrderAddress;
  carrier?: string;
  courierName?: string;
  trackingNumber?: string;
  paymentMethod: OrderPaymentMethod;
  paid: boolean;
  paidWith?: number;
  channel: OrderChannel;
  stage: OrderStage;
  scheduledFor?: string | null;
  notes?: string;
  cancellationReason?: string;
  urgent?: boolean;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  statusHistory: OrderStatusEvent[];
  automations: OrderAutomationMessage[];
  operatorTrail: OrderOperatorAudit[];
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  items: Array<Omit<OrderItem, "id"> & { id?: string }>;
  extraCharges?: Array<Omit<OrderExtraCharge, "id"> & { id?: string }>;
  shippingFee?: number;
  modality: OrderModality;
  table?: string;
  address?: OrderAddress;
  carrier?: string;
  courierName?: string;
  trackingNumber?: string;
  paymentMethod: OrderPaymentMethod;
  paid?: boolean;
  paidWith?: number;
  channel?: OrderChannel;
  notes?: string;
  confirmOnCreate?: boolean;
  saveAddressToCrm?: boolean;
  scheduledFor?: string | null;
  urgent?: boolean;
}

// ---------------------------------------------------------------------------
// Constants & lookup tables
// ---------------------------------------------------------------------------

export const DEFAULT_ACTIVE_COLUMNS: OrderColumn[] = [
  { id: "new", label: "Nuevo", color: "#F59E0B", isDefault: true },
  { id: "confirmed", label: "Confirmado", color: "#3B82F6", isDefault: true },
  { id: "preparing", label: "En preparación", color: "#8B5CF6", isDefault: true },
  { id: "ready", label: "Listo", color: "#10B981", isDefault: true },
  { id: "in_transit", label: "En camino", color: "#FF3F1A", isDefault: true },
];

export const STAGE_LABELS: Record<string, string> = {
  new: "Nuevo",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  in_transit: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const STAGE_COLORS: Record<string, string> = {
  new: "#F59E0B",
  confirmed: "#3B82F6",
  preparing: "#8B5CF6",
  ready: "#10B981",
  in_transit: "#FF3F1A",
  delivered: "#059669",
  cancelled: "#EF4444",
};

export const STAGE_PROGRESS: Record<string, number> = {
  new: 20,
  confirmed: 40,
  preparing: 60,
  ready: 80,
  in_transit: 90,
  delivered: 100,
  cancelled: 0,
};

export const MODALITY_LABELS: Record<OrderModality, string> = {
  delivery: "Domicilio",
  pickup: "Retiro en tienda",
  onsite: "En sitio",
};

export const PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  cod: "Contra entrega",
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  whatsapp: "WhatsApp",
  operator: "Operador",
};

export const COLOMBIA_DEPARTMENTS: string[] = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
];

// ---------------------------------------------------------------------------
// Formatting & workflow helpers
// ---------------------------------------------------------------------------

export function formatCOP(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const prefix = safe < 0 ? "-$ " : "$ ";
  return `${prefix}${Math.abs(safe).toLocaleString("es-CO")}`;
}

export function formatElapsedSLA(iso: string, now: Date = new Date()): string {
  const since = new Date(iso).getTime();
  if (Number.isNaN(since)) return "00:00:00";

  const totalSeconds = Math.max(0, Math.floor((now.getTime() - since) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days >= 1) {
    return `${String(days).padStart(2, "0")}:${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

export function stageToOperatorGate(stage: OrderStage): OrderOperatorStage | null {
  switch (stage) {
    case "new":
    case "confirmed":
      return "confirmation";
    case "preparing":
    case "ready":
      return "preparation";
    case "in_transit":
    case "delivered":
      return "dispatch";
    default:
      return null;
  }
}

export function canOperatorMoveTo(
  stage: OrderStage,
  allowedStages: OrderOperatorStage[],
): boolean {
  const gate = stageToOperatorGate(stage);
  if (gate === null) return true;
  return allowedStages.includes(gate);
}

export function nextStageFor(
  stage: OrderStage,
  columns: OrderColumn[],
): OrderStage | null {
  if (stage === "delivered" || stage === "cancelled") return null;
  const index = columns.findIndex((column) => column.id === stage);
  if (index === -1) return columns[0]?.id ?? "delivered";
  if (index < columns.length - 1) return columns[index + 1].id;
  return "delivered";
}

// ---------------------------------------------------------------------------
// Realistic Colombian demo seed orders (P-001..P-018)
// ---------------------------------------------------------------------------

interface SeedOrderSpec {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  extraCharges?: OrderExtraCharge[];
  shippingFee: number;
  modality: OrderModality;
  table?: string;
  address?: OrderAddress;
  carrier?: string;
  courierName?: string;
  trackingNumber?: string;
  paymentMethod: OrderPaymentMethod;
  paid: boolean;
  paidWith?: number;
  channel: OrderChannel;
  stage: DefaultOrderStage;
  createdMinutesAgo: number;
  updatedMinutesAgo: number;
  deliveredMinutesAgo?: number;
  scheduledMinutesFromNow?: number;
  notes?: string;
  cancellationReason?: string;
  urgent?: boolean;
  operator: string;
}

const DEFAULT_PIPELINE: DefaultOrderStage[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "in_transit",
  "delivered",
];

function offsetIso(now: Date, minutesDelta: number): string {
  return new Date(now.getTime() + minutesDelta * 60_000).toISOString();
}

function buildSeedOrder(spec: SeedOrderSpec, now: Date): Order {
  const createdAt = offsetIso(now, -spec.createdMinutesAgo);
  const updatedAt = offsetIso(now, -spec.updatedMinutesAgo);
  const deliveredAt =
    spec.deliveredMinutesAgo !== undefined
      ? offsetIso(now, -spec.deliveredMinutesAgo)
      : undefined;
  const scheduledFor =
    spec.scheduledMinutesFromNow !== undefined
      ? offsetIso(now, spec.scheduledMinutesFromNow)
      : null;

  const extraCharges = spec.extraCharges ?? [];
  const subtotal = spec.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const extrasTotal = extraCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const total = subtotal + spec.shippingFee + extrasTotal;

  const reachedStages: DefaultOrderStage[] =
    spec.stage === "cancelled"
      ? ["new", "confirmed", "cancelled"]
      : DEFAULT_PIPELINE.slice(
          0,
          Math.max(1, DEFAULT_PIPELINE.indexOf(spec.stage) + 1),
        );

  const spanMinutes = Math.max(
    1,
    spec.createdMinutesAgo - spec.updatedMinutesAgo,
  );
  const statusHistory: OrderStatusEvent[] = reachedStages.map((stage, idx) => {
    const ratio =
      reachedStages.length === 1 ? 0 : idx / (reachedStages.length - 1);
    const at = offsetIso(
      now,
      -Math.round(spec.createdMinutesAgo - spanMinutes * ratio),
    );
    return {
      id: `${spec.id}-ev-${idx + 1}`,
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      at,
      operator: idx === 0 && spec.channel === "whatsapp" ? "Bot WhatsApp" : spec.operator,
      ...(stage === "cancelled" && spec.cancellationReason
        ? { note: spec.cancellationReason }
        : {}),
    };
  });

  const automations: OrderAutomationMessage[] = [
    {
      id: `${spec.id}-wa-1`,
      channel: "whatsapp",
      event: "Pedido recibido",
      message: `Hola ${spec.customerName.split(" ")[0]}, recibimos tu pedido ${spec.code} por ${formatCOP(total)}.`,
      sentAt: createdAt,
      status: "read",
    },
  ];

  if (spec.stage === "in_transit" && spec.carrier && spec.trackingNumber) {
    automations.push({
      id: `${spec.id}-wa-2`,
      channel: "whatsapp",
      event: "Despacho en camino",
      message: `Tu pedido ${spec.code} salió con ${spec.carrier}. Guía de seguimiento: ${spec.trackingNumber}.`,
      sentAt: updatedAt,
      status: "delivered",
    });
  } else if (spec.stage === "delivered" && deliveredAt) {
    automations.push({
      id: `${spec.id}-wa-2`,
      channel: "whatsapp",
      event: "Pedido entregado",
      message: `Tu pedido ${spec.code} fue entregado con éxito. ¡Gracias por tu compra!`,
      sentAt: deliveredAt,
      status: "read",
    });
  } else if (spec.stage === "cancelled") {
    automations.push({
      id: `${spec.id}-wa-2`,
      channel: "whatsapp",
      event: "Pedido cancelado",
      message: `Tu pedido ${spec.code} fue cancelado. Si necesitas retomarlo, escríbenos por este chat.`,
      sentAt: updatedAt,
      status: "sent",
    });
  }

  const operatorTrail: OrderOperatorAudit[] = [
    {
      id: `${spec.id}-aud-1`,
      operator: spec.channel === "whatsapp" ? "Bot WhatsApp" : spec.operator,
      action:
        spec.channel === "whatsapp"
          ? "Pedido ingresado desde canal WhatsApp"
          : "Pedido registrado por operador",
      at: createdAt,
    },
  ];

  if (spec.carrier && spec.trackingNumber) {
    operatorTrail.push({
      id: `${spec.id}-aud-2`,
      operator: spec.operator,
      action: `Guía ${spec.trackingNumber} asignada con ${spec.carrier}`,
      at: updatedAt,
    });
  }

  if (spec.paid) {
    operatorTrail.push({
      id: `${spec.id}-aud-3`,
      operator: spec.operator,
      action: `Pago verificado (${PAYMENT_METHOD_LABELS[spec.paymentMethod]})`,
      at: updatedAt,
    });
  }

  return {
    id: spec.id,
    code: spec.code,
    customerName: spec.customerName,
    customerPhone: spec.customerPhone,
    items: spec.items,
    extraCharges,
    shippingFee: spec.shippingFee,
    subtotal,
    total,
    modality: spec.modality,
    table: spec.table,
    address: spec.address,
    carrier: spec.carrier,
    courierName: spec.courierName,
    trackingNumber: spec.trackingNumber,
    paymentMethod: spec.paymentMethod,
    paid: spec.paid,
    paidWith: spec.paidWith,
    channel: spec.channel,
    stage: spec.stage,
    scheduledFor,
    notes: spec.notes,
    cancellationReason: spec.cancellationReason,
    urgent: spec.urgent,
    createdAt,
    updatedAt,
    deliveredAt,
    statusHistory,
    automations,
    operatorTrail,
  };
}

export function createSeedOrders(now: Date = new Date()): Order[] {
  const D = 1440; // minutes in a day
  const H = 60;

  const specs: SeedOrderSpec[] = [
    {
      id: "ord-seed-018",
      code: "P-018",
      customerName: "Sebastián Duarte",
      customerPhone: "+57 315 204 8810",
      items: [
        { id: "it-018-1", name: "Combo Parrilla Familiar", quantity: 1, unitPrice: 89000 },
        { id: "it-018-2", name: "Limonada de Coco 1L", quantity: 2, unitPrice: 14000 },
      ],
      shippingFee: 0,
      modality: "pickup",
      paymentMethod: "transfer",
      paid: true,
      channel: "whatsapp",
      stage: "new",
      createdMinutesAgo: 35,
      updatedMinutesAgo: 30,
      scheduledMinutesFromNow: 26 * H,
      notes: "Recoge mañana al mediodía para reunión de oficina.",
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-017",
      code: "P-017",
      customerName: "Valeria Londoño",
      customerPhone: "+57 311 490 3321",
      items: [
        { id: "it-017-1", name: "Bowl Proteico de Salmón", quantity: 2, unitPrice: 36000 },
        { id: "it-017-2", name: "Brownie Artesanal con Helado", quantity: 2, unitPrice: 13500 },
      ],
      shippingFee: 8500,
      modality: "delivery",
      address: {
        street: "Carrera 34 # 7-45",
        neighborhood: "Provenza",
        reference: "Edificio Álamo, Apto 402",
        department: "Antioquia",
        city: "Medellín",
        notes: "Entregar en portería si no contestan el citófono.",
      },
      carrier: "Envío propio",
      paymentMethod: "card",
      paid: true,
      channel: "whatsapp",
      stage: "new",
      createdMinutesAgo: 50,
      updatedMinutesAgo: 45,
      scheduledMinutesFromNow: 4 * H,
      notes: "Salsa aparte por favor.",
      operator: "Mateo Vargas",
    },
    {
      id: "ord-seed-016",
      code: "P-016",
      customerName: "Felipe Castaño",
      customerPhone: "+57 318 772 1904",
      items: [
        { id: "it-016-1", name: "Hamburguesa Doble Brioche", quantity: 2, unitPrice: 28000 },
        { id: "it-016-2", name: "Papas Trufadas", quantity: 1, unitPrice: 14000 },
        { id: "it-016-3", name: "Gaseosa Artesanal 350ml", quantity: 2, unitPrice: 6500 },
      ],
      extraCharges: [{ id: "ec-016-1", label: "Empaque térmico", amount: 2500 }],
      shippingFee: 7000,
      modality: "delivery",
      address: {
        street: "Calle 85 # 14-28",
        neighborhood: "Zona T",
        reference: "Torre Norte, Oficina 604",
        department: "Bogotá D.C.",
        city: "Bogotá",
      },
      paymentMethod: "cash",
      paid: false,
      paidWith: 100000,
      channel: "whatsapp",
      stage: "new",
      createdMinutesAgo: 18,
      updatedMinutesAgo: 18,
      notes: "Sin cebolla caramelizada en una hamburguesa.",
      urgent: true,
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-015",
      code: "P-015",
      customerName: "Natalia Pardo",
      customerPhone: "+57 314 601 5520",
      items: [
        { id: "it-015-1", name: "Pasta Alfredo con Pollo", quantity: 2, unitPrice: 31000 },
        { id: "it-015-2", name: "Limonada Cerezada", quantity: 2, unitPrice: 9500 },
      ],
      shippingFee: 0,
      modality: "onsite",
      table: "Mesa 7",
      paymentMethod: "transfer",
      paid: true,
      channel: "operator",
      stage: "confirmed",
      createdMinutesAgo: 26,
      updatedMinutesAgo: 20,
      notes: "Servir las bebidas primero.",
      operator: "Mateo Vargas",
    },
    {
      id: "ord-seed-014",
      code: "P-014",
      customerName: "Santiago Morales",
      customerPhone: "+57 305 883 4120",
      items: [
        { id: "it-014-1", name: "Chaqueta Impermeable Urbana", variant: "Talla L", quantity: 1, unitPrice: 145000 },
        { id: "it-014-2", name: "Gorra Clásica Algodón", variant: "Negro", quantity: 1, unitPrice: 42000 },
      ],
      shippingFee: 9000,
      modality: "delivery",
      address: {
        street: "Circular 4 # 71-18",
        neighborhood: "Laureles",
        reference: "Casa reja blanca frente al parque",
        department: "Antioquia",
        city: "Medellín",
      },
      carrier: "Envío propio",
      paymentMethod: "cash",
      paid: false,
      paidWith: 200000,
      channel: "whatsapp",
      stage: "preparing",
      createdMinutesAgo: 46,
      updatedMinutesAgo: 19,
      notes: "Confirmar talla antes de sellar el paquete.",
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-010",
      code: "P-010",
      customerName: "Alejandro Vélez",
      customerPhone: "+57 302 333 4455",
      items: [
        { id: "it-010-1", name: "Audífonos Inalámbricos Pro", quantity: 1, unitPrice: 185000 },
        { id: "it-010-2", name: "Estuche Silicona Protector", quantity: 1, unitPrice: 28000 },
      ],
      shippingFee: 14500,
      modality: "delivery",
      address: {
        street: "Calle 45 # 12-30, Apto 502",
        neighborhood: "Chapinero",
        reference: "Edificio Mirador, portería 24h",
        department: "Bogotá D.C.",
        city: "Bogotá",
      },
      carrier: "Envía",
      trackingNumber: "50000112926",
      paymentMethod: "transfer",
      paid: false,
      channel: "whatsapp",
      stage: "in_transit",
      createdMinutesAgo: 5 * H,
      updatedMinutesAgo: 90,
      notes: "Llamar 10 minutos antes de llegar.",
      urgent: true,
      operator: "Mateo Vargas",
    },
    {
      id: "ord-seed-009",
      code: "P-009",
      customerName: "David Restrepo",
      customerPhone: "+57 302 111 2233",
      items: [
        { id: "it-009-1", name: "Tenis Running Ultralight", variant: "42", quantity: 1, unitPrice: 229000 },
      ],
      shippingFee: 12000,
      modality: "delivery",
      address: {
        street: "Carrera 68 # 24-15",
        neighborhood: "Belén",
        reference: "Local de diseño segundo piso",
        department: "Antioquia",
        city: "Medellín",
      },
      carrier: "Coordinadora",
      trackingNumber: "50000113753",
      paymentMethod: "cod",
      paid: false,
      channel: "operator",
      stage: "in_transit",
      createdMinutesAgo: 8 * H,
      updatedMinutesAgo: 3 * H,
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-008",
      code: "P-008",
      customerName: "Carolina Herrera",
      customerPhone: "+57 301 999 8877",
      items: [
        { id: "it-008-1", name: "Kit Cuidado Facial Vitamina C", quantity: 1, unitPrice: 118000 },
        { id: "it-008-2", name: "Protector Solar Mineral SPF 50", quantity: 1, unitPrice: 64000 },
      ],
      shippingFee: 11000,
      modality: "delivery",
      address: {
        street: "Calle 100 # 15-20, Torre B",
        neighborhood: "Chicó Norte",
        reference: "Recepción corporativa",
        department: "Bogotá D.C.",
        city: "Bogotá",
      },
      carrier: "Servientrega",
      trackingNumber: "50000112918",
      paymentMethod: "card",
      paid: true,
      channel: "whatsapp",
      stage: "in_transit",
      createdMinutesAgo: 12 * H,
      updatedMinutesAgo: 4 * H,
      operator: "Mateo Vargas",
    },
    {
      id: "ord-seed-007",
      code: "P-007",
      customerName: "Valentina Ríos",
      customerPhone: "+57 301 888 9900",
      items: [
        { id: "it-007-1", name: "Cafetera Prensa Francesa 1L", quantity: 1, unitPrice: 92000 },
        { id: "it-007-2", name: "Café de Origen Huila 500g", quantity: 2, unitPrice: 34000 },
      ],
      shippingFee: 15000,
      modality: "delivery",
      address: {
        street: "Avenida 6N # 23-45",
        neighborhood: "Granada",
        reference: "Edificio Granada Plaza",
        department: "Valle del Cauca",
        city: "Cali",
      },
      carrier: "TCC",
      trackingNumber: "50000112113",
      paymentMethod: "transfer",
      paid: true,
      channel: "whatsapp",
      stage: "in_transit",
      createdMinutesAgo: 20 * H,
      updatedMinutesAgo: 10 * H,
      operator: "Laura Giraldo",
    },
    {
      id: "ord-seed-005",
      code: "P-005",
      customerName: "Andrés Gil",
      customerPhone: "+57 300 555 6677",
      items: [
        { id: "it-005-1", name: "Morral Antirrobo 16 Pulgadas", quantity: 1, unitPrice: 138000 },
      ],
      shippingFee: 13500,
      modality: "delivery",
      address: {
        street: "Transversal 29 # 48-12",
        neighborhood: "Cabecera",
        reference: "Confirmar número de apartamento",
        department: "Santander",
        city: "Bucaramanga",
      },
      carrier: "InterRapidísimo",
      trackingNumber: "50000112877",
      paymentMethod: "cod",
      paid: false,
      channel: "operator",
      stage: "ready",
      createdMinutesAgo: 38 * H,
      updatedMinutesAgo: 6 * H,
      notes: "Retornado a Listo pendiente de confirmar apartamento para reintento.",
      urgent: true,
      operator: "Laura Giraldo",
    },
    {
      id: "ord-seed-006",
      code: "P-006",
      customerName: "Sofía Díaz",
      customerPhone: "+57 301 777 3344",
      items: [
        { id: "it-006-1", name: "Lámpara de Escritorio LED", quantity: 1, unitPrice: 76000 },
      ],
      shippingFee: 11000,
      modality: "delivery",
      address: {
        street: "Calle 19 # 4-60",
        neighborhood: "Centro",
        department: "Bogotá D.C.",
        city: "Bogotá",
      },
      carrier: "Envía",
      trackingNumber: "50000112924",
      paymentMethod: "cod",
      paid: false,
      channel: "whatsapp",
      stage: "cancelled",
      createdMinutesAgo: 2 * D,
      updatedMinutesAgo: 28 * H,
      cancellationReason: "Destinatario indicó que ya no desea el producto en entrega.",
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-012",
      code: "P-012",
      customerName: "Juliana Gómez",
      customerPhone: "+57 310 442 9811",
      items: [
        { id: "it-012-1", name: "Combo Clásico Doble", quantity: 2, unitPrice: 29000 },
        { id: "it-012-2", name: "Cheesecake de Maracuyá", quantity: 2, unitPrice: 12500 },
      ],
      shippingFee: 6500,
      modality: "delivery",
      address: {
        street: "Calle 10 # 43A-22",
        neighborhood: "El Poblado",
        department: "Antioquia",
        city: "Medellín",
      },
      carrier: "Envío propio",
      paymentMethod: "transfer",
      paid: true,
      channel: "whatsapp",
      stage: "delivered",
      createdMinutesAgo: 4 * D,
      updatedMinutesAgo: 4 * D - 42,
      deliveredMinutesAgo: 4 * D - 42,
      operator: "Mateo Vargas",
    },
    {
      id: "ord-seed-011",
      code: "P-011",
      customerName: "Mateo Quintero",
      customerPhone: "+57 312 315 7740",
      items: [
        { id: "it-011-1", name: "Camiseta Básica Algodón Pima", variant: "M", quantity: 3, unitPrice: 49000 },
      ],
      shippingFee: 0,
      modality: "pickup",
      paymentMethod: "cash",
      paid: true,
      paidWith: 150000,
      channel: "operator",
      stage: "delivered",
      createdMinutesAgo: 7 * D,
      updatedMinutesAgo: 7 * D - 35,
      deliveredMinutesAgo: 7 * D - 35,
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-013",
      code: "P-013",
      customerName: "Ricardo Mendoza",
      customerPhone: "+57 304 510 6622",
      items: [
        { id: "it-013-1", name: "Teclado Mecánico Compacto", quantity: 1, unitPrice: 215000 },
      ],
      shippingFee: 16000,
      modality: "delivery",
      address: {
        street: "Carrera 53 # 76-90",
        neighborhood: "Alto Prado",
        department: "Atlántico",
        city: "Barranquilla",
      },
      paymentMethod: "transfer",
      paid: false,
      channel: "whatsapp",
      stage: "cancelled",
      createdMinutesAgo: 9 * D,
      updatedMinutesAgo: 9 * D - 90,
      cancellationReason: "Cliente reprogramó la compra para fin de mes.",
      operator: "Laura Giraldo",
    },
    {
      id: "ord-seed-004",
      code: "P-004",
      customerName: "Lucía Torres",
      customerPhone: "+57 300 444 5566",
      items: [
        { id: "it-004-1", name: "Set Organizador de Cocina x4", quantity: 1, unitPrice: 84000 },
        { id: "it-004-2", name: "Termo Acero Inoxidable 750ml", quantity: 2, unitPrice: 48000 },
      ],
      shippingFee: 11500,
      modality: "delivery",
      address: {
        street: "Carrera 76 # 33-10",
        neighborhood: "Laureles",
        reference: "Portería, preguntar por Lucía",
        department: "Antioquia",
        city: "Medellín",
      },
      carrier: "Coordinadora",
      trackingNumber: "50000112640",
      paymentMethod: "card",
      paid: true,
      channel: "whatsapp",
      stage: "delivered",
      createdMinutesAgo: 12 * D,
      updatedMinutesAgo: 10 * D,
      deliveredMinutesAgo: 10 * D,
      operator: "Mateo Vargas",
    },
    {
      id: "ord-seed-003",
      code: "P-003",
      customerName: "Pedro Ramírez",
      customerPhone: "+57 300 333 4455",
      items: [
        { id: "it-003-1", name: "Silla Ergonómica Soporte Lumbar", quantity: 1, unitPrice: 320000 },
      ],
      extraCharges: [{ id: "ec-003-1", label: "Seguro de carga", amount: 8000 }],
      shippingFee: 22000,
      modality: "delivery",
      address: {
        street: "Calle 72 # 10-34",
        neighborhood: "Chapinero",
        reference: "Oficina 301",
        department: "Bogotá D.C.",
        city: "Bogotá",
      },
      carrier: "Servientrega",
      trackingNumber: "50000112455",
      paymentMethod: "transfer",
      paid: true,
      channel: "operator",
      stage: "delivered",
      createdMinutesAgo: 16 * D,
      updatedMinutesAgo: 14 * D,
      deliveredMinutesAgo: 14 * D,
      operator: "Laura Giraldo",
    },
    {
      id: "ord-seed-002",
      code: "P-002",
      customerName: "Mariana Salazar",
      customerPhone: "+57 316 209 1144",
      items: [
        { id: "it-002-1", name: "Pizza Artesanal Margarita", quantity: 2, unitPrice: 38000 },
        { id: "it-002-2", name: "Tiramisú de la Casa", quantity: 2, unitPrice: 15000 },
      ],
      shippingFee: 0,
      modality: "onsite",
      table: "Mesa 4",
      paymentMethod: "cash",
      paid: true,
      paidWith: 120000,
      channel: "operator",
      stage: "delivered",
      createdMinutesAgo: 19 * D,
      updatedMinutesAgo: 19 * D - 48,
      deliveredMinutesAgo: 19 * D - 48,
      operator: "Camila Ortiz",
    },
    {
      id: "ord-seed-001",
      code: "P-001",
      customerName: "Carlos Andrés Peña",
      customerPhone: "+57 300 912 4401",
      items: [
        { id: "it-001-1", name: "Combo Ejecutivo Especial", quantity: 3, unitPrice: 32000 },
        { id: "it-001-2", name: "Jugo Natural de Mango", quantity: 3, unitPrice: 8000 },
      ],
      shippingFee: 0,
      modality: "pickup",
      paymentMethod: "card",
      paid: true,
      channel: "whatsapp",
      stage: "delivered",
      createdMinutesAgo: 24 * D,
      updatedMinutesAgo: 24 * D - 29,
      deliveredMinutesAgo: 24 * D - 29,
      operator: "Mateo Vargas",
    },
  ];

  return specs.map((spec) => buildSeedOrder(spec, now));
}
