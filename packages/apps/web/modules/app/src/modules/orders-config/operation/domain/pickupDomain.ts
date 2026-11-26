export type PickupType = "occasional" | "recurring";

export type PickupStatus = "scheduled" | "assigned" | "incident";

export interface Pickup {
  id: string;

  code: string;
  kind: PickupType;
  carrier: string;
  warehouse: string;

  date: string;

  timeSlot: string;
  packages: number;

  dispatcher: string;
  status: PickupStatus;
  createdAt: string;
}

export interface PickupInput {
  kind: PickupType;
  carrier: string;
  warehouse: string;
  date: string;
  timeSlot: string;
  packages: number | string;
  dispatcher: string;
}

export const PICKUP_STATUS_LABELS: Record<PickupStatus, string> = {
  scheduled: "Programada",
  assigned: "Asignada",
  incident: "Con novedad",
};

export const PICKUP_STATUSES: readonly PickupStatus[] = [
  "scheduled",
  "assigned",
  "incident",
];

export function validatePickup(data: PickupInput): string[] {
  const errors: string[] = [];
  if (!data.carrier?.trim()) errors.push("Elige la transportadora.");
  if (!data.warehouse?.trim()) errors.push("Escribe la bodega de donde se recoge.");
  if (!data.date?.trim()) errors.push("Indica la fecha programada.");
  if (!data.timeSlot?.trim()) errors.push("Indica el horario de recolección.");
  const packages = Number(data.packages);
  if (!Number.isFinite(packages) || packages <= 0) {
    errors.push("El número de paquetes tiene que ser mayor que cero.");
  }
  if (!data.dispatcher?.trim()) errors.push("Escribe quién despacha.");
  return errors;
}

export function nextCode(pickups: Pickup[]): string {
  const highest = pickups.reduce((acc, r) => {
    const n = Number(String(r.code).replace(/\D/g, ""));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `REC-${String(highest + 1).padStart(4, "0")}`;
}

export interface PickupFilter {
  kind: PickupType;
  statuses: PickupStatus[];

  carrier?: string | null;
}

export function filterPickups(
  pickups: Pickup[],
  filter: PickupFilter,
): Pickup[] {
  return pickups
    .filter((r) => r.kind === filter.kind)
    .filter((r) => !filter.carrier || r.carrier === filter.carrier)
    .filter((r) => filter.statuses.length === 0 || filter.statuses.includes(r.status))
    .sort((a, b) => `${a.date} ${a.timeSlot}`.localeCompare(`${b.date} ${b.timeSlot}`));
}

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKDAYS: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABELS: Record<Weekday, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

export const DAY_INITIAL: Record<Weekday, string> = {
  monday: "L",
  tuesday: "M",
  wednesday: "X",
  thursday: "J",
  friday: "V",
  saturday: "S",
  sunday: "D",
};

export type PickupSlot = "morning" | "afternoon";

export const SLOT_LABELS: Record<PickupSlot, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
};

export const SLOT_TIMES: Record<PickupSlot, string> = {
  morning: "8:00 AM - 12:00 PM",
  afternoon: "12:00 PM - 5:00 PM",
};

export const PICKUP_SLOTS: readonly PickupSlot[] = ["morning", "afternoon"];

export interface RecurringPickup {
  id: string;
  carrier: string;

  enabled: boolean;
  days: Weekday[];
  warehouse: string;
  address: string;
  dispatcherFirstName: string;
  dispatcherLastName: string;
  slot: PickupSlot;
  packages: number;
  notes: string;
  updatedAt: string;
}

export interface RecurringPickupInput {
  carrier: string;
  days: Weekday[];
  warehouse: string;
  address: string;
  dispatcherFirstName: string;
  dispatcherLastName: string;
  slot: PickupSlot;
  packages: number | string;
  notes: string;
}

export function validateSchedule(data: RecurringPickupInput): string[] {
  const errors: string[] = [];
  if (!data.carrier?.trim()) errors.push("Elige la transportadora.");
  if (!data.days || data.days.length === 0) {
    errors.push("Elige al menos un día de la semana.");
  }
  if (!data.warehouse?.trim()) errors.push("Escribe la bodega de donde se recoge.");
  if (!data.address?.trim()) errors.push("Escribe la dirección de la bodega.");
  if (!data.dispatcherFirstName?.trim()) errors.push("Escribe el nombre de quien despacha.");
  if (!data.dispatcherLastName?.trim()) errors.push("Escribe los apellidos de quien despacha.");
  const packages = Number(data.packages);
  if (!Number.isFinite(packages) || packages <= 0) {
    errors.push("El número de paquetes tiene que ser mayor que cero.");
  }
  return errors;
}

export function sortDays(days: Weekday[]): Weekday[] {
  return WEEKDAYS.filter((day) => days.includes(day));
}

export function formatFrequency(days: Weekday[]): string {
  const order = sortDays(days);
  if (order.length === 0) return "Sin días";
  if (order.length === 7) return "Todos los días";
  if (order.length === 5 && !order.includes("saturday") && !order.includes("sunday")) {
    return "Entre semana";
  }
  if (order.length === 2 && order.includes("saturday") && order.includes("sunday")) {
    return "Fines de semana";
  }

  const names = order.map((day) => DAY_LABELS[day].toLocaleLowerCase("es"));
  const phrase =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  return phrase.charAt(0).toLocaleUpperCase("es") + phrase.slice(1);
}

// ---------------------------------------------------------------------------
// Realistic Colombian demo seed pickups & recurring schedules
// ---------------------------------------------------------------------------

function ymdOffset(base: Date, daysOffset: number): string {
  const date = new Date(base.getTime());
  date.setDate(date.getDate() + daysOffset);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createSeedPickups(now: Date = new Date()): Pickup[] {
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 3600_000).toISOString();

  return [
    {
      id: "rec-seed-1",
      code: "REC-0001",
      kind: "occasional",
      carrier: "Envía",
      warehouse: "Bodega Principal El Poblado",
      date: ymdOffset(now, 0),
      timeSlot: "14:00 - 16:00",
      packages: 28,
      dispatcher: "Carlos Mario Restrepo",
      status: "assigned",
      createdAt: hoursAgo(22),
    },
    {
      id: "rec-seed-2",
      code: "REC-0002",
      kind: "occasional",
      carrier: "Coordinadora",
      warehouse: "Centro Logístico Itagüí",
      date: ymdOffset(now, 0),
      timeSlot: "15:00 - 17:30",
      packages: 42,
      dispatcher: "Laura Sofía Giraldo",
      status: "assigned",
      createdAt: hoursAgo(20),
    },
    {
      id: "rec-seed-3",
      code: "REC-0003",
      kind: "occasional",
      carrier: "Servientrega",
      warehouse: "Sede Laureles",
      date: ymdOffset(now, 0),
      timeSlot: "16:00 - 18:00",
      packages: 19,
      dispatcher: "Andrés Felipe Zapata",
      status: "scheduled",
      createdAt: hoursAgo(6),
    },
    {
      id: "rec-seed-4",
      code: "REC-0004",
      kind: "occasional",
      carrier: "InterRapidísimo",
      warehouse: "Bodega Norte Bello",
      date: ymdOffset(now, 0),
      timeSlot: "10:00 - 12:00",
      packages: 15,
      dispatcher: "Julián Esteban Osorio",
      status: "incident",
      createdAt: hoursAgo(26),
    },
    {
      id: "rec-seed-5",
      code: "REC-0005",
      kind: "occasional",
      carrier: "TCC",
      warehouse: "Centro Logístico Itagüí",
      date: ymdOffset(now, 1),
      timeSlot: "09:00 - 11:30",
      packages: 35,
      dispatcher: "Laura Sofía Giraldo",
      status: "assigned",
      createdAt: hoursAgo(5),
    },
    {
      id: "rec-seed-6",
      code: "REC-0006",
      kind: "occasional",
      carrier: "Envía",
      warehouse: "Sede Laureles",
      date: ymdOffset(now, 1),
      timeSlot: "14:00 - 16:30",
      packages: 22,
      dispatcher: "Andrés Felipe Zapata",
      status: "scheduled",
      createdAt: hoursAgo(4),
    },
    {
      id: "rec-seed-7",
      code: "REC-0007",
      kind: "occasional",
      carrier: "Envío propio",
      warehouse: "Bodega Principal El Poblado",
      date: ymdOffset(now, 1),
      timeSlot: "11:00 - 13:00",
      packages: 14,
      dispatcher: "Carlos Mario Restrepo",
      status: "assigned",
      createdAt: hoursAgo(3.5),
    },
    {
      id: "rec-seed-8",
      code: "REC-0008",
      kind: "occasional",
      carrier: "Servientrega",
      warehouse: "Bodega Principal El Poblado",
      date: ymdOffset(now, 2),
      timeSlot: "08:30 - 11:00",
      packages: 31,
      dispatcher: "Carlos Mario Restrepo",
      status: "scheduled",
      createdAt: hoursAgo(3),
    },
    {
      id: "rec-seed-9",
      code: "REC-0009",
      kind: "occasional",
      carrier: "Coordinadora",
      warehouse: "Bodega Norte Bello",
      date: ymdOffset(now, 2),
      timeSlot: "13:30 - 16:00",
      packages: 26,
      dispatcher: "Julián Esteban Osorio",
      status: "scheduled",
      createdAt: hoursAgo(2),
    },
    {
      id: "rec-seed-10",
      code: "REC-0010",
      kind: "occasional",
      carrier: "TCC",
      warehouse: "Bodega Principal El Poblado",
      date: ymdOffset(now, -1),
      timeSlot: "15:00 - 17:00",
      packages: 18,
      dispatcher: "Carlos Mario Restrepo",
      status: "incident",
      createdAt: hoursAgo(44),
    },
  ];
}

export function createSeedRecurringPickups(
  now: Date = new Date(),
): RecurringPickup[] {
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 86_400_000).toISOString();

  return [
    {
      id: "cfg-seed-1",
      carrier: "Coordinadora",
      enabled: true,
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      warehouse: "Centro Logístico Itagüí",
      address: "Cra. 42 #75-83 Bodega 14, Autopista Sur, Itagüí",
      dispatcherFirstName: "Laura Sofía",
      dispatcherLastName: "Giraldo Montoya",
      slot: "afternoon",
      packages: 40,
      notes: "Ingresar por muelle de carga #3 y anunciar placa en portería.",
      updatedAt: daysAgo(2),
    },
    {
      id: "cfg-seed-2",
      carrier: "Envía",
      enabled: true,
      days: ["monday", "wednesday", "friday"],
      warehouse: "Bodega Principal El Poblado",
      address: "Calle 10 #43A-30 Local 104, El Poblado, Medellín",
      dispatcherFirstName: "Carlos Mario",
      dispatcherLastName: "Restrepo Vélez",
      slot: "afternoon",
      packages: 28,
      notes: "Timbrar en recepción de despachos; paquetes sellados desde las 12:00 PM.",
      updatedAt: daysAgo(1),
    },
    {
      id: "cfg-seed-3",
      carrier: "Servientrega",
      enabled: true,
      days: ["tuesday", "thursday", "saturday"],
      warehouse: "Sede Laureles",
      address: "Circular 4 #73-22, Laureles, Medellín",
      dispatcherFirstName: "Andrés Felipe",
      dispatcherLastName: "Zapata Henao",
      slot: "morning",
      packages: 20,
      notes: "Parqueo habilitado en bahía lateral sobre la Circular 4.",
      updatedAt: daysAgo(3),
    },
    {
      id: "cfg-seed-4",
      carrier: "TCC",
      enabled: true,
      days: ["tuesday", "thursday"],
      warehouse: "Centro Logístico Itagüí",
      address: "Cra. 42 #75-83 Bodega 14, Autopista Sur, Itagüí",
      dispatcherFirstName: "Laura Sofía",
      dispatcherLastName: "Giraldo Montoya",
      slot: "morning",
      packages: 35,
      notes: "Despacho de cajas master y pedidos corporativos regionales.",
      updatedAt: daysAgo(4),
    },
    {
      id: "cfg-seed-5",
      carrier: "InterRapidísimo",
      enabled: false,
      days: ["monday", "wednesday", "friday"],
      warehouse: "Bodega Norte Bello",
      address: "Av. Regional #52-110 Bodega 6, Bello, Antioquia",
      dispatcherFirstName: "Julián Esteban",
      dispatcherLastName: "Osorio Cano",
      slot: "afternoon",
      packages: 18,
      notes: "Regla pausada temporalmente por mantenimiento de muelle norte.",
      updatedAt: daysAgo(5),
    },
  ];
}
