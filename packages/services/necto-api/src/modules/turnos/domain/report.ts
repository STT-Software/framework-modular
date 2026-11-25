import type { Ticket } from './ticket';
import { serviceMinutes, waitMinutes } from './metrics';
export const REPORT_COLUMNS = [
  'code',
  'queue',
  'status',
  'day',
  'created_at',
  'called_at',
  'finished_at',
  'wait_minutes',
  'service_minutes',
  'operator',
  'customer_name',
  'customer_phone',
  'customer_email',
  'note',
  'cancel_reason',
  'answers',
] as const;
/**
 * One cell of a CSV. Quotes are doubled and the cell is quoted when it needs it. A value that starts with `=`, `+`, `-`, `@` or a control
 * character would be run as a formula by a spreadsheet, so it gets a leading apostrophe: what a customer typed can never become a formula.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const minutes = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
/** The report as CSV text: a header and one row per turn, oldest first. Dates are ISO instants in UTC; `day` is the day of the business. */
export function buildCsv(tickets: readonly Ticket[]): string {
  const rows = tickets.map((ticket) =>
    [
      ticket.code,
      ticket.queueName,
      ticket.status,
      ticket.dayKey,
      ticket.createdAt.toISOString(),
      ticket.calledAt?.toISOString() ?? null,
      ticket.finishedAt?.toISOString() ?? null,
      minutes(waitMinutes(ticket)),
      minutes(serviceMinutes(ticket)),
      ticket.attendedBy?.name ?? null,
      ticket.customer.name,
      ticket.customer.phone,
      ticket.customer.email,
      ticket.note,
      ticket.cancelReason,
      ticket.answers.map((answer) => `${answer.label}: ${answer.value}`).join(' | ') || null,
    ]
      .map(csvCell)
      .join(','),
  );
  return [REPORT_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
