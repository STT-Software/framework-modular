export type IncidentStatus =
  | "pending"
  | "open"
  | "waiting"
  | "rejected"
  | "resolved";

export const INCIDENT_STATUSES: IncidentStatus[] = [
  "pending",
  "open",
  "waiting",
  "rejected",
  "resolved",
];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: "Pendiente",
  open: "Por gestionar",
  waiting: "En espera de respuesta",
  rejected: "Rechazada",
  resolved: "Solucionada",
};

export const STATUS_TONES: Record<
  IncidentStatus,
  "gray" | "yellow" | "blue" | "red" | "green"
> = {
  pending: "yellow",
  open: "blue",
  waiting: "gray",
  rejected: "red",
  resolved: "green",
};

export const TONE_CLASSES: Record<string, string> = {
  gray: "bg-gray-100 text-ink-body dark:bg-gray-500/15 dark:text-gray-300",
  yellow: "bg-amber-100 text-ink-body dark:bg-amber-500/15 dark:text-amber-300",
  blue: "bg-sky-100 text-ink-body dark:bg-sky-500/15 dark:text-sky-300",
  red: "bg-red-100 text-ink-body dark:bg-red-500/15 dark:text-red-300",
  green: "bg-emerald-100 text-ink-body dark:bg-emerald-500/15 dark:text-emerald-300",
};

export function incidentStatusClass(status: IncidentStatus): string {
  return TONE_CLASSES[STATUS_TONES[status]];
}

export type Resolution =
  | "tomorrow"
  | "date"
  | "same_address"
  | "new_address"
  | "change_city";

export type ExtraField = "date" | "address" | "city" | null;

export interface ResolutionOption {
  id: Resolution;
  label: string;

  hint: string;
  requires: ExtraField;

  fieldLabel?: string;
  fieldHint?: string;
}

export const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    id: "tomorrow",
    label: "Reintentar entrega mañana",
    hint: "El cliente confirmó que mañana puede recibir en la dirección de la guía.",
    requires: null,
  },
  {
    id: "date",
    label: "Reintentar entrega en una fecha asignada",
    hint: "El cliente confirmó una fecha concreta, en la dirección de la guía.",
    requires: "date",
    fieldLabel: "Fecha de reintento",
    fieldHint: "El día en que el cliente dice que sí va a estar.",
  },
  {
    id: "same_address",
    label: "Reintentar la entrega en la misma dirección de la guía",
    hint: "El cliente puede recibir en cualquier momento, en la dirección original.",
    requires: null,
  },
  {
    id: "new_address",
    label: "Entregar en nueva dirección",
    hint: "Otra dirección dentro de la misma ciudad de destino.",
    requires: "address",
    fieldLabel: "Dirección nueva",
    fieldHint: "Con barrio y punto de referencia: la transportadora no llama para preguntar.",
  },
  {
    id: "change_city",
    label: "Cambiar dirección de destino",
    hint: "Otra ciudad del mismo área metropolitana. Fuera de ella, se cancela y se crea un pedido nuevo.",
    requires: "city",
    fieldLabel: "Ciudad y dirección nuevas",
    fieldHint: "Ciudad de destino y dirección completa, en el mismo campo.",
  },
];

export function resolutionById(id: Resolution): ResolutionOption | undefined {
  return RESOLUTION_OPTIONS.find((s) => s.id === id);
}

export function resolutionLabel(id: Resolution | undefined): string {
  if (!id) return "—";
  return resolutionById(id)?.label ?? "—";
}

export const INCIDENT_REASONS = [
  "Destinatario no contesta",
  "Reprogramado",
  "Dirección incorrecta",
  "Destinatario indica que ya no desea el producto",
  "Mercancía no entregada al destinatario - información incompleta",
  "Zona no cubierta por la transportadora",
] as const;

export interface Incident {
  id: string;

  trackingNumber: string;
  carrier: string;

  orderNumber: string;
  customer: string;
  phone: string;
  address: string;
  city: string;

  reason: string;
  status: IncidentStatus;
  createdAt: string;

  resolution?: Resolution;

  notes?: string;

  recipientName?: string;
  recipientPhone?: string;
  retryDate?: string;
  newAddress?: string;
  newCity?: string;
  resolvedAt?: string;
}

export interface ResolutionInput {
  resolution: Resolution | "";
  notes: string;
  retryDate?: string;
  newAddress?: string;
  newCity?: string;

  recipientName?: string;

  recipientPhone?: string;
}

export const MIN_NOTE_LENGTH = 10;
export const MAX_NOTE_LENGTH = 50;

export const MIN_RECIPIENT_LENGTH = 3;

export function validateResolution(data: ResolutionInput, now: Date = new Date()): string[] {
  const errors: string[] = [];
  const option = data.resolution ? resolutionById(data.resolution) : undefined;

  if (!data.resolution || !option) {
    errors.push("Elige cómo se reintenta la entrega.");
    return errors;
  }

  if (option.requires === "date") {
    const date = data.retryDate?.trim();
    if (!date) {
      errors.push("Indica la fecha en que el cliente puede recibir.");
    } else if (date < todayISO(now)) {

      errors.push("La fecha de reintento no puede estar en el pasado.");
    }
  }

  if (option.requires === "address" && !data.newAddress?.trim()) {
    errors.push("Escribe la dirección nueva.");
  }

  if (option.requires === "city" && !data.newCity?.trim()) {
    errors.push("Escribe la ciudad y la dirección nuevas.");
  }

  const name = data.recipientName?.trim() ?? "";
  if (name.length < MIN_RECIPIENT_LENGTH) {
    errors.push("Escribe a nombre de quién va el segundo intento.");
  }

  const phone = (data.recipientPhone ?? "").replace(/\D/g, "");
  if (phone.length > 0 && phone.length < 7) {
    errors.push("El teléfono de quien recibe no tiene suficientes dígitos.");
  }

  const note = data.notes.trim();
  if (note.length < MIN_NOTE_LENGTH) {
    errors.push(
      `Describe qué necesita la transportadora (mínimo ${MIN_NOTE_LENGTH} caracteres).`,
    );
  }
  if (note.length > MAX_NOTE_LENGTH) {
    errors.push(`La observación no puede pasar de ${MAX_NOTE_LENGTH} caracteres.`);
  }

  return errors;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function daysOpen(createdAt: string, now: Date = new Date()): string {
  const since = new Date(createdAt).getTime();
  if (Number.isNaN(since)) return "—";

  const totalMinutes = Math.max(0, Math.floor((now.getTime() - since) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  return `${days} d · ${hours} h`;
}

export function describeIncident(n: Incident, now: Date = new Date()): string[] {
  const reason = n.reason.trim();
  const phrase = reason.charAt(0).toLowerCase() + reason.slice(1);
  return [
    `El paquete no se pudo entregar: ${phrase}.`,
    `La reportó ${n.carrier} el ${shortDate(n.createdAt)} y lleva ${daysOpen(n.createdAt, now)} abierta.`,
    `El pedido ${n.orderNumber} iba a ${n.address}, ${n.city}.`,
  ];
}

export interface IncidentFilter {
  statuses: IncidentStatus[];

  search: string;
}

const withoutAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function filterIncidents(incidents: Incident[], filter: IncidentFilter): Incident[] {
  const q = withoutAccents(filter.search);
  return incidents.filter((n) => {
    if (filter.statuses.length > 0 && !filter.statuses.includes(n.status)) return false;
    if (!q) return true;
    return (
      withoutAccents(n.orderNumber).includes(q) ||
      withoutAccents(n.trackingNumber).includes(q) ||
      withoutAccents(n.customer).includes(q)
    );
  });
}

export function canResolve(n: Incident): boolean {
  return n.status === "pending" || n.status === "open" || n.status === "rejected";
}

// ---------------------------------------------------------------------------
// Delivery failure reporting (from order detail / dispatch workflow)
// ---------------------------------------------------------------------------

export type DeliveryFailureMotiveId =
  | "no_answer"
  | "wrong_address"
  | "rejected"
  | "incomplete_info"
  | "other";

export type DeliveryFailureOutcome = "retry" | "cancel";

export const DELIVERY_FAILURE_MOTIVES: ReadonlyArray<{
  id: DeliveryFailureMotiveId;
  label: string;
  hint: string;
}> = [
  {
    id: "no_answer",
    label: "Destinatario no contesta / no estaba",
    hint: "Se intentó entregar en la dirección pero nadie recibió el pedido.",
  },
  {
    id: "wrong_address",
    label: "Dirección incorrecta o inaccesible",
    hint: "La nomenclatura tiene errores o la zona no permitió el ingreso.",
  },
  {
    id: "rejected",
    label: "Cliente rechazó el pedido o el pago",
    hint: "El destinatario canceló en puerta o rechazó el pago contra entrega.",
  },
  {
    id: "incomplete_info",
    label: "Información de entrega incompleta",
    hint: "Faltan datos clave como torre, apartamento, barrio o referencia.",
  },
  {
    id: "other",
    label: "Otro motivo",
    hint: "Describe con claridad lo ocurrido durante el intento de entrega.",
  },
];

export function formatDeliveryIncidentNote(
  motiveLabel: string,
  detail: string,
  outcome: DeliveryFailureOutcome,
  now: Date = new Date(),
): string {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const cleanMotive = motiveLabel.trim() || "Novedad logística";
  const cleanDetail = detail.trim();
  const actionLabel =
    outcome === "retry"
      ? "Reintentar entrega (devuelto a Listo)"
      : "Cancelar pedido";

  const motivePart = cleanDetail ? `${cleanMotive} — ${cleanDetail}` : cleanMotive;
  return `[Novedad Logística ${hh}:${mm}] Motivo: ${motivePart} | Acción: ${actionLabel}`;
}

export function createSeedIncidents(now: Date = new Date()): Incident[] {
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 3600_000).toISOString();

  return [
    {
      id: "15050058",
      trackingNumber: "50000112926",
      carrier: "Envía",
      orderNumber: "P-010",
      customer: "Alejandro Vélez",
      phone: "+57 302 333 4455",
      address: "Calle 45 #12-30, Apto 502",
      city: "Bogotá",
      reason: INCIDENT_REASONS[0],
      status: "pending",
      createdAt: hoursAgo(0.5),
    },
    {
      id: "15048102",
      trackingNumber: "50000112926",
      carrier: "Envía",
      orderNumber: "P-010",
      customer: "Alejandro Vélez",
      phone: "+57 302 333 4455",
      address: "Calle 45 #12-30, Apto 502",
      city: "Bogotá",
      reason: INCIDENT_REASONS[1],
      status: "resolved",
      createdAt: hoursAgo(18),
      resolution: "same_address",
      notes: "Cliente confirmó entrega después de las 2 p.m. en portería.",
      recipientName: "Alejandro Vélez",
      recipientPhone: "+57 302 333 4455",
      resolvedAt: hoursAgo(16.5),
    },
    {
      id: "14990137",
      trackingNumber: "50000113753",
      carrier: "Coordinadora",
      orderNumber: "P-009",
      customer: "David Restrepo",
      phone: "+57 302 111 2233",
      address: "Carrera 68 #24-15",
      city: "Medellín",
      reason: INCIDENT_REASONS[1],
      status: "open",
      createdAt: hoursAgo(1.5),
    },
    {
      id: "15050061",
      trackingNumber: "50000112918",
      carrier: "Servientrega",
      orderNumber: "P-008",
      customer: "Carolina Herrera",
      phone: "+57 301 999 8877",
      address: "Calle 100 #15-20, Torre B",
      city: "Bogotá",
      reason: INCIDENT_REASONS[2],
      status: "pending",
      createdAt: hoursAgo(2.4),
    },
    {
      id: "14988240",
      trackingNumber: "50000112113",
      carrier: "TCC",
      orderNumber: "P-007",
      customer: "Valentina Ríos",
      phone: "+57 301 888 9900",
      address: "Avenida 6N #23-45",
      city: "Cali",
      reason: INCIDENT_REASONS[0],
      status: "waiting",
      createdAt: hoursAgo(9),
    },
    {
      id: "15034412",
      trackingNumber: "50000112924",
      carrier: "Envía",
      orderNumber: "P-006",
      customer: "Sofía Díaz",
      phone: "+57 301 777 3344",
      address: "Calle 19 #4-60",
      city: "Bogotá",
      reason: INCIDENT_REASONS[3],
      status: "rejected",
      createdAt: hoursAgo(28),
    },
    {
      id: "14977503",
      trackingNumber: "50000112877",
      carrier: "InterRapidísimo",
      orderNumber: "P-005",
      customer: "Andrés Gil",
      phone: "+57 300 555 6677",
      address: "Transversal 29 #48-12",
      city: "Bucaramanga",
      reason: INCIDENT_REASONS[4],
      status: "pending",
      createdAt: hoursAgo(31),
    },
    {
      id: "14950881",
      trackingNumber: "50000112640",
      carrier: "Coordinadora",
      orderNumber: "P-004",
      customer: "Lucía Torres",
      phone: "+57 300 444 5566",
      address: "Carrera 43A #18-95",
      city: "Medellín",
      reason: INCIDENT_REASONS[1],
      status: "resolved",
      createdAt: hoursAgo(52),
      resolution: "new_address",
      notes: "Entregar en Carrera 76 #33-10, portería, preguntar por Lucía.",
      recipientName: "Lucía Torres",
      recipientPhone: "+57 300 444 5566",
      newAddress: "Carrera 76 #33-10, barrio Laureles",
      resolvedAt: hoursAgo(50),
    },
    {
      id: "14899012",
      trackingNumber: "50000112455",
      carrier: "Servientrega",
      orderNumber: "P-003",
      customer: "Pedro Ramírez",
      phone: "+57 300 333 4455",
      address: "Calle 72 #10-34",
      city: "Bogotá",
      reason: INCIDENT_REASONS[5],
      status: "resolved",
      createdAt: hoursAgo(75),
      resolution: "tomorrow",
      notes: "Reintentar mañana en oficina antes de las 6 p.m.",
      recipientName: "Pedro Ramírez",
      recipientPhone: "+57 300 333 4455",
      resolvedAt: hoursAgo(73),
    },
  ];
}
