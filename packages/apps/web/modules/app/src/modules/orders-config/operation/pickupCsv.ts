import {
    PICKUP_STATUS_LABELS,
    SLOT_LABELS,
    SLOT_TIMES,
    formatFrequency,
    type RecurringPickup,
    type Pickup,
} from "./domain/pickupDomain";
import { buildCsv, ymdLocal } from "./csv";

export const PICKUP_HEADERS = [
  "Id de recolección",
  "Carrier",
  "Bodega",
  "Fecha programada",
  "Horario",
  "Estado",
  "N.º de paquetes",
  "Persona que despacha",
];

export function appointmentRows(pickups: Pickup[]): (string | number)[][] {
  return pickups.map((r) => [
    r.code,
    r.carrier,
    r.warehouse,
    r.date,
    r.timeSlot,
    PICKUP_STATUS_LABELS[r.status],
    r.packages,
    r.dispatcher,
  ]);
}

export const RECURRING_HEADERS = [
  "Carrier",
  "Días de la semana",
  "Rango",
  "Horario",
  "Bodega",
  "Dirección",
  "Persona que despacha",
  "N.º de paquetes",
  "Información adicional",
  "Activa",
];

export function recurringRows(schedules: RecurringPickup[]): (string | number)[][] {
  return schedules.map((c) => [
    c.carrier,
    formatFrequency(c.days),
    SLOT_LABELS[c.slot],
    SLOT_TIMES[c.slot],
    c.warehouse,
    c.address,
    `${c.dispatcherFirstName} ${c.dispatcherLastName}`.trim(),
    c.packages,
    c.notes,
    c.enabled ? "Sí" : "No",
  ]);
}

export function appointmentsCsv(pickups: Pickup[]): string {
  return buildCsv(PICKUP_HEADERS, appointmentRows(pickups));
}

export function recurringCsv(schedules: RecurringPickup[]): string {
  return buildCsv(RECURRING_HEADERS, recurringRows(schedules));
}

export function pickupFilename(
  kind: "occasional" | "recurring",
  ref: Date = new Date(),
): string {
  return `recolecciones-${kind === "recurring" ? "fijas" : "eventuales"}-${ymdLocal(ref)}.csv`;
}
