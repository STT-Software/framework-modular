import type { TicketStatus } from './catalog';
import type { Ticket, TicketActor, TicketEvent } from './ticket';
export interface TicketFilter {
  /** The queues the caller may see; `null` is every queue (the administrator). An empty list is none. */
  queueIds: readonly string[] | null;
  queueId?: string;
  statuses?: readonly TicketStatus[];
  /** Part of the code, the name, the phone or the email. */
  search?: string;
  /** Created from this instant (included) to this one (excluded). */
  from?: Date;
  to?: Date;
  /** Called by this operator. */
  attendedBy?: string;
}
/** `arrival`: oldest first (the order they are called); `newest`: latest created first. */
export type TicketOrder = 'arrival' | 'newest';
export interface TicketPage {
  items: Ticket[];
  total: number;
}
export interface OpenCount {
  waiting: number;
  attending: number;
  /** When the one that has waited longest arrived. */
  oldestWaitingAt: Date | null;
}
export type InsertResult =
  | { kind: 'inserted'; ticket: Ticket }
  /** Another turn already has that code on that day: the numbering must take the next number. */
  | { kind: 'duplicate-code' }
  /** The same `clientRequestId` was already used: this is the turn it created. */
  | { kind: 'duplicate-request'; ticket: Ticket };
export type CallResult =
  | { kind: 'called'; ticket: Ticket }
  /** It was not waiting any more (called, ended, or never in the allowed queues). */
  | { kind: 'not-waiting' }
  /** The operator already has a turn in attention. */
  | { kind: 'operator-busy' }
  /** `callNext` only: nobody is waiting. */
  | { kind: 'empty' };
export type FinishKind = 'completed' | 'cancelled' | 'no-show';
export interface ActivityEntry {
  type: TicketEvent['type'];
  at: Date;
  by: TicketActor;
  automatic: boolean;
  ticketId: string;
  code: string;
  queueId: string;
  queueName: string;
}
/**
 * What Turnos needs to persist and change its turns. Every change of state is ONE conditional write that only succeeds if the turn is
 * still in the state the change expects, so two operators, two tabs or a repeated request can never call or complete the same turn twice.
 * The numbering is a counter that is increased atomically, so concurrent requests never get the same number.
 */
export abstract class TicketRepository {
  /**
   * The next number for a prefix inside a scope (a day, or "all" when numbering does not restart), and the next position of arrival in
   * that scope. Both come from one atomic increase.
   */
  abstract nextNumber(businessId: string, scope: string, prefix: string): Promise<{ number: number; seq: number }>;
  abstract insert(ticket: Ticket): Promise<InsertResult>;
  abstract findById(businessId: string, ticketId: string): Promise<Ticket | null>;
  abstract findByRequestId(businessId: string, clientRequestId: string): Promise<Ticket | null>;
  abstract list(businessId: string, filter: TicketFilter, order: TicketOrder, page: { page: number; pageSize: number }): Promise<TicketPage>;
  /** Oldest first, at most `limit` rows. */
  abstract findForReport(businessId: string, filter: TicketFilter, limit: number): Promise<Ticket[]>;
  /** The oldest waiting turn of a queue, or null. */
  abstract head(businessId: string, queueId: string): Promise<Ticket | null>;
  /** Calls this turn if it is still waiting in one of the queues allowed (`null` is any). */
  abstract call(businessId: string, ticketId: string, operator: TicketActor, queueIds: readonly string[] | null, at: Date, automatic: boolean): Promise<CallResult>;
  /** Calls the oldest waiting turn of the queue. */
  abstract callNext(businessId: string, queueId: string, operator: TicketActor, at: Date, automatic: boolean): Promise<CallResult>;
  /**
   * Ends a turn: `completed` and `no-show` need the turn to be in attention BY this operator; `cancelled` also accepts a turn that is still
   * waiting. Returns the turn changed, or null when it was not in a state that allows it (the caller then reads it to answer).
   */
  abstract finish(
    businessId: string,
    ticketId: string,
    kind: FinishKind,
    by: TicketActor,
    queueIds: readonly string[] | null,
    at: Date,
    reason: string | null,
  ): Promise<Ticket | null>;
  /** Puts the turn this operator is attending back in the line, in its original place. Null when they were attending nothing. */
  abstract releaseOf(businessId: string, operatorId: string, at: Date): Promise<Ticket | null>;
  /** How many turns of this queue are still open (waiting or in attention). */
  abstract countOpen(businessId: string, queueId: string): Promise<number>;
  /** Waiting and in-attention counts of every queue that has turns open. */
  abstract openCounts(businessId: string, queueIds: readonly string[] | null): Promise<Map<string, OpenCount>>;
  /** When each waiting turn arrived and in which queue (nothing else), to count how many are urgent. */
  abstract waitingArrivals(businessId: string, queueIds: readonly string[] | null): Promise<Array<{ queueId: string; createdAt: Date }>>;
  /** The turns being attended right now by anybody. */
  abstract attendingNow(businessId: string, queueIds: readonly string[] | null): Promise<Ticket[]>;
  /** The turn this operator is attending now, if any. */
  abstract attendingOf(businessId: string, operatorId: string): Promise<Ticket | null>;
  /** Turns of the business created in a range, oldest first, at most `limit`. */
  abstract inRange(businessId: string, queueIds: readonly string[] | null, from: Date, to: Date, limit: number): Promise<Ticket[]>;
  /** The latest things that happened to turns, newest first. */
  abstract recentActivity(businessId: string, queueIds: readonly string[] | null, limit: number): Promise<ActivityEntry[]>;
  /** The turns called most recently, newest call first. */
  abstract lastCalled(businessId: string, queueIds: readonly string[] | null, limit: number): Promise<Ticket[]>;
}
