import { LIMITS, type TicketStatus } from './catalog';
import type { Answer } from './queue-fields';
import { normalizeContactEmail, normalizePhone } from './contact';
import { TurnosInvalidError } from './errors';
import type { Issues } from './issues';
/** Who did something to a turn. The operator is kept by id and by the name they had at that moment. */
export interface TicketActor {
  operatorId: string;
  name: string;
}
/** `released`: the operator who was attending it lost the access, so the turn went back to the line in its place. */
export type TicketEventType = 'created' | 'called' | 'completed' | 'cancelled' | 'no-show' | 'released';
export interface TicketEvent {
  type: TicketEventType;
  at: Date;
  by: TicketActor;
  /** A call made by the automatic advance of the queue, not by a person's action. */
  automatic?: boolean;
}
export interface TicketCustomer {
  name: string | null;
  phone: string | null;
  email: string | null;
}
/**
 * A turn: one person in one queue, from the moment it is created to its ending. The queue name and the labels of the answers are kept as
 * they were, so the history keeps reading right when the queue is renamed or changed.
 */
export interface Ticket {
  id: string;
  businessId: string;
  queueId: string;
  queueName: string;
  /** The day of the business (in its time zone) the turn was created. */
  dayKey: string;
  /** The prefix the queue had when the turn was created ("" for none) and the number it got. `code` is both together. */
  prefix: string;
  number: number;
  code: string;
  /** Position of arrival inside its numbering scope; with the creation time it fixes the order turns are called in. */
  seq: number;
  status: TicketStatus;
  customer: TicketCustomer;
  answers: Answer[];
  note: string | null;
  createdAt: Date;
  createdBy: TicketActor;
  /** The operator who called it, and when. Kept after the turn ends. */
  attendedBy: TicketActor | null;
  calledAt: Date | null;
  /** When it ended (completed, cancelled or absent). */
  finishedAt: Date | null;
  cancelReason: string | null;
  events: TicketEvent[];
  /** Sent by the page to make a repeated "create" harmless: the same id answers with the turn that already exists. */
  clientRequestId: string | null;
}
/** "C-001", or "001" without prefix. The number has at least three digits. */
export function ticketCode(prefix: string, number: number): string {
  return `${prefix ? `${prefix}-` : ''}${String(number).padStart(3, '0')}`;
}
export const isOpen = (ticket: Pick<Ticket, 'status'>): boolean => ticket.status === 'waiting' || ticket.status === 'attending';
export interface CreateTicketInput {
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  note?: string | null;
  clientRequestId?: string | null;
  answers?: unknown;
}
export interface ParsedCustomer {
  customer: TicketCustomer;
  note: string | null;
  clientRequestId: string | null;
}
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
/**
 * Validates who the turn is for: all of it is optional (a person at the counter may give no data), but what is given must be well formed.
 * The answers to the extra fields of the queue are checked separately (`validateAnswers`) and their problems joined to these.
 */
export function parseCustomer(input: CreateTicketInput, issues: Issues): ParsedCustomer {
  const text = (raw: unknown, name: string, min: number, max: number): string | null => {
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return null;
    if (typeof raw !== 'string') {
      issues.add(name, `${name} must be text`);
      return null;
    }
    const value = raw.trim();
    if (value.length < min || value.length > max) {
      issues.add(name, `${name} must be ${min} to ${max} characters long`);
      return null;
    }
    return value;
  };
  const name = text(input.customerName, 'customerName', LIMITS.customerName.min, LIMITS.customerName.max);
  const note = text(input.note, 'note', 1, LIMITS.note);
  let phone: string | null = null;
  const rawPhone = text(input.customerPhone, 'customerPhone', 1, 40);
  if (rawPhone) {
    phone = normalizePhone(rawPhone);
    if (!phone) issues.add('customerPhone', `customerPhone must have ${LIMITS.phoneDigits.min} to ${LIMITS.phoneDigits.max} digits, with an optional leading +`);
  }
  let email: string | null = null;
  const rawEmail = text(input.customerEmail, 'customerEmail', 3, LIMITS.operatorEmail.max);
  if (rawEmail) {
    email = normalizeContactEmail(rawEmail);
    if (!email) issues.add('customerEmail', 'customerEmail must be an email address');
  }
  let clientRequestId: string | null = null;
  if (input.clientRequestId !== undefined && input.clientRequestId !== null) {
    if (typeof input.clientRequestId !== 'string' || !REQUEST_ID.test(input.clientRequestId)) {
      issues.add('clientRequestId', 'clientRequestId must be 8 to 64 letters, digits, "-" or "_"');
    } else {
      clientRequestId = input.clientRequestId;
    }
  }
  return { customer: { name, phone, email }, note, clientRequestId };
}
/** Throws the `invalid-ticket` error with the problems found, if any. */
export function assertNoIssues(issues: Issues): void {
  if (issues.any) throw new TurnosInvalidError('invalid-ticket', issues.fields);
}
