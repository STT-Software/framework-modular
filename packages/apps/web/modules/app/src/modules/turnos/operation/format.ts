import type { TicketStatus } from "./types";
export const statusText = (status: TicketStatus): string =>
  ({ waiting: "En espera", attending: "En atención", completed: "Completado", cancelled: "Cancelado", "no-show": "No asistió" })[status];
export const statusColor = (status: TicketStatus): "" | "amber" | "purple" | "green" | "red" =>
  ({ waiting: "amber", attending: "purple", completed: "green", cancelled: "red", "no-show": "" } as const)[status];
/** Los minutos que lleva esperando un turno: hasta que lo llamaron, o hasta ahora si sigue esperando. */
export const waitOf = (ticket: { createdAt: string; calledAt: string | null }, now = Date.now()): number =>
  Math.max(0, Math.floor(((ticket.calledAt ? new Date(ticket.calledAt).getTime() : now) - new Date(ticket.createdAt).getTime()) / 60000));
export const minutes = (value: number | null, digits = 0): string => (value === null ? "—" : value.toFixed(digits).replace(/\.0+$/, ""));
/** El nombre que se muestra de un cliente (un turno puede no tener nombre). */
export const customerName = (ticket: { customer: { name: string | null } }): string => ticket.customer.name ?? "Sin nombre";
/** Un identificador para que reenviar el mismo formulario no cree dos turnos. */
export const newRequestId = (): string => `web-${crypto.randomUUID()}`;
