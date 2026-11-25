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
