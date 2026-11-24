import { OPEN_TICKET_STATUSES } from './domain/catalog';
import type { Ticket, TicketActor } from './domain/ticket';
import {
  TicketRepository,
  type ActivityEntry,
  type CallResult,
  type FinishKind,
  type InsertResult,
  type OpenCount,
  type TicketFilter,
  type TicketOrder,
  type TicketPage,
} from './domain/ticket.repository';
import type { DeliveryState, SurveyInvitation, SurveyResponse } from './domain/survey';
import { SurveyRepository, type AnswerResult, type SurveyFilter } from './domain/survey.repository';

const clone = <T>(value: T): T => structuredClone(value);
const byArrival = (a: Ticket, b: Ticket) => a.createdAt.getTime() - b.createdAt.getTime() || a.seq - b.seq;
const inScope = (ticket: { queueId: string }, queueIds: readonly string[] | null) => queueIds === null || queueIds.includes(ticket.queueId);

/**
 * In-memory turns with the same rules as the MongoDB repository: a code is never repeated on a day of a business, an operator never has two
 * turns in attention, a `clientRequestId` finds the turn it already made, and every change of state is conditional. JavaScript runs one
 * step at a time, so each method here is atomic like its MongoDB counterpart.
 */
export class InMemoryTicketRepository extends TicketRepository {
  readonly items = new Map<string, Ticket>();
  private readonly counters = new Map<string, { seq: number; n: Map<string, number> }>();
  /** How many numbers were handed out, to check that concurrent creations got different ones. */
  numbersGiven = 0;
  async nextNumber(businessId: string, scope: string, prefix: string) {
    const key = `${businessId}:${scope}`;
    const counter = this.counters.get(key) ?? { seq: 0, n: new Map<string, number>() };
    counter.seq += 1;
    counter.n.set(prefix, (counter.n.get(prefix) ?? 0) + 1);
    this.counters.set(key, counter);
    this.numbersGiven += 1;
    // Awaiting here lets concurrent callers interleave exactly where a real database round trip would.
    await Promise.resolve();
    return { number: counter.n.get(prefix)!, seq: counter.seq };
  }
  async insert(ticket: Ticket): Promise<InsertResult> {
    const all = [...this.items.values()].filter((item) => item.businessId === ticket.businessId);
    if (ticket.clientRequestId) {
      const same = all.find((item) => item.clientRequestId === ticket.clientRequestId);
      if (same) return { kind: 'duplicate-request', ticket: clone(same) };
    }
    if (all.some((item) => item.dayKey === ticket.dayKey && item.code === ticket.code)) return { kind: 'duplicate-code' };
    this.items.set(ticket.id, clone(ticket));
    return { kind: 'inserted', ticket: clone(ticket) };
  }
  async findById(businessId: string, ticketId: string) {
    const ticket = this.items.get(ticketId);
    return ticket && ticket.businessId === businessId ? clone(ticket) : null;
  }
  async findByRequestId(businessId: string, clientRequestId: string) {
    const ticket = [...this.items.values()].find((item) => item.businessId === businessId && item.clientRequestId === clientRequestId);
    return ticket ? clone(ticket) : null;
  }
  private matching(businessId: string, filter: TicketFilter): Ticket[] {
    const search = filter.search?.trim().toLowerCase();
    return [...this.items.values()].filter((ticket) => {
      if (ticket.businessId !== businessId || !inScope(ticket, filter.queueIds)) return false;
      if (filter.queueId && ticket.queueId !== filter.queueId) return false;
      if (filter.statuses?.length && !filter.statuses.includes(ticket.status)) return false;
      if (filter.from && ticket.createdAt < filter.from) return false;
      if (filter.to && ticket.createdAt >= filter.to) return false;
      if (filter.attendedBy && ticket.attendedBy?.operatorId !== filter.attendedBy) return false;
      if (search) {
        const haystack = [ticket.code, ticket.customer.name, ticket.customer.phone, ticket.customer.email].filter(Boolean).join('\n').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }
  async list(businessId: string, filter: TicketFilter, order: TicketOrder, page: { page: number; pageSize: number }): Promise<TicketPage> {
    const all = this.matching(businessId, filter).sort(order === 'arrival' ? byArrival : (a, b) => byArrival(b, a));
    const start = (page.page - 1) * page.pageSize;
    return { items: all.slice(start, start + page.pageSize).map(clone), total: all.length };
  }
  async findForReport(businessId: string, filter: TicketFilter, limit: number) {
    return this.matching(businessId, filter).sort(byArrival).slice(0, limit).map(clone);
  }
  async head(businessId: string, queueId: string) {
    const [first] = [...this.items.values()].filter((ticket) => ticket.businessId === businessId && ticket.queueId === queueId && ticket.status === 'waiting').sort(byArrival);
    return first ? clone(first) : null;
  }
  private take(ticket: Ticket, operator: TicketActor, at: Date, automatic: boolean): CallResult {
    const busy = [...this.items.values()].some((item) => item.businessId === ticket.businessId && item.status === 'attending' && item.attendedBy?.operatorId === operator.operatorId);
    if (busy) return { kind: 'operator-busy' };
    ticket.status = 'attending';
    ticket.attendedBy = { ...operator };
    ticket.calledAt = at;
    ticket.events.push({ type: 'called', at, by: { ...operator }, ...(automatic ? { automatic: true } : {}) });
    return { kind: 'called', ticket: clone(ticket) };
  }
  async call(businessId: string, ticketId: string, operator: TicketActor, queueIds: readonly string[] | null, at: Date, automatic: boolean): Promise<CallResult> {
    const ticket = this.items.get(ticketId);
    if (!ticket || ticket.businessId !== businessId || ticket.status !== 'waiting' || !inScope(ticket, queueIds)) return { kind: 'not-waiting' };
    return this.take(ticket, operator, at, automatic);
  }
  async callNext(businessId: string, queueId: string, operator: TicketActor, at: Date, automatic: boolean): Promise<CallResult> {
    const [first] = [...this.items.values()].filter((ticket) => ticket.businessId === businessId && ticket.queueId === queueId && ticket.status === 'waiting').sort(byArrival);
    return first ? this.take(first, operator, at, automatic) : { kind: 'empty' };
  }
  async finish(businessId: string, ticketId: string, kind: FinishKind, by: TicketActor, queueIds: readonly string[] | null, at: Date, reason: string | null) {
    const ticket = this.items.get(ticketId);
    if (!ticket || ticket.businessId !== businessId || !inScope(ticket, queueIds)) return null;
    const mine = ticket.status === 'attending' && ticket.attendedBy?.operatorId === by.operatorId;
    if (!(mine || (kind === 'cancelled' && ticket.status === 'waiting'))) return null;
    ticket.status = kind;
    ticket.finishedAt = at;
    if (kind === 'cancelled') ticket.cancelReason = reason;
    ticket.events.push({ type: kind, at, by: { ...by } });
    return clone(ticket);
  }
  async releaseOf(businessId: string, operatorId: string, at: Date) {
    const ticket = [...this.items.values()].find((item) => item.businessId === businessId && item.status === 'attending' && item.attendedBy?.operatorId === operatorId);
    if (!ticket) return null;
    ticket.status = 'waiting';
    ticket.attendedBy = null;
    ticket.calledAt = null;
    ticket.events.push({ type: 'released', at, by: { operatorId, name: '' }, automatic: true });
    return clone(ticket);
  }
  async countOpen(businessId: string, queueId: string) {
    return [...this.items.values()].filter((ticket) => ticket.businessId === businessId && ticket.queueId === queueId && (OPEN_TICKET_STATUSES as readonly string[]).includes(ticket.status)).length;
  }
  async openCounts(businessId: string, queueIds: readonly string[] | null) {
    const counts = new Map<string, OpenCount>();
    for (const ticket of this.items.values()) {
      if (ticket.businessId !== businessId || !inScope(ticket, queueIds)) continue;
      if (ticket.status !== 'waiting' && ticket.status !== 'attending') continue;
      const entry = counts.get(ticket.queueId) ?? { waiting: 0, attending: 0, oldestWaitingAt: null };
      if (ticket.status === 'waiting') {
        entry.waiting += 1;
        if (!entry.oldestWaitingAt || ticket.createdAt < entry.oldestWaitingAt) entry.oldestWaitingAt = ticket.createdAt;
      } else {
        entry.attending += 1;
      }
      counts.set(ticket.queueId, entry);
    }
    return counts;
  }
  async waitingArrivals(businessId: string, queueIds: readonly string[] | null) {
    return [...this.items.values()].filter((ticket) => ticket.businessId === businessId && ticket.status === 'waiting' && inScope(ticket, queueIds)).map((ticket) => ({ queueId: ticket.queueId, createdAt: ticket.createdAt }));
  }
  async attendingNow(businessId: string, queueIds: readonly string[] | null) {
    return [...this.items.values()].filter((ticket) => ticket.businessId === businessId && ticket.status === 'attending' && inScope(ticket, queueIds)).map(clone);
  }
  async attendingOf(businessId: string, operatorId: string) {
    const ticket = [...this.items.values()].find((item) => item.businessId === businessId && item.status === 'attending' && item.attendedBy?.operatorId === operatorId);
    return ticket ? clone(ticket) : null;
  }
  async inRange(businessId: string, queueIds: readonly string[] | null, from: Date, to: Date, limit: number) {
    return [...this.items.values()]
      .filter((ticket) => ticket.businessId === businessId && inScope(ticket, queueIds) && ticket.createdAt >= from && ticket.createdAt < to)
      .sort(byArrival)
      .slice(0, limit)
      .map(clone);
  }
  async recentActivity(businessId: string, queueIds: readonly string[] | null, limit: number): Promise<ActivityEntry[]> {
    return [...this.items.values()]
      .filter((ticket) => ticket.businessId === businessId && inScope(ticket, queueIds))
      .flatMap((ticket) =>
        ticket.events.map((event) => ({ type: event.type, at: event.at, by: event.by, automatic: event.automatic === true, ticketId: ticket.id, code: ticket.code, queueId: ticket.queueId, queueName: ticket.queueName })),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }
  async lastCalled(businessId: string, queueIds: readonly string[] | null, limit: number) {
    return [...this.items.values()]
      .filter((ticket) => ticket.businessId === businessId && inScope(ticket, queueIds) && ticket.calledAt)
      .sort((a, b) => b.calledAt!.getTime() - a.calledAt!.getTime())
      .slice(0, limit)
      .map(clone);
  }
}

/** In-memory surveys: one invitation per turn, one answer per invitation, an answer only before the link expires. */
export class InMemorySurveyRepository extends SurveyRepository {
  readonly items = new Map<string, SurveyInvitation>();
  async insertOnce(invitation: SurveyInvitation) {
    const existing = [...this.items.values()].find((item) => item.businessId === invitation.businessId && item.ticketId === invitation.ticketId);
    if (existing) return { created: false, invitation: clone(existing) };
    this.items.set(invitation.id, clone(invitation));
    return { created: true, invitation: clone(invitation) };
  }
  async recordDelivery(id: string, delivery: { email?: DeliveryState; whatsapp?: DeliveryState }) {
    const item = this.items.get(id);
    if (!item) return;
    if (delivery.email) item.delivery.email = clone(delivery.email);
    if (delivery.whatsapp) item.delivery.whatsapp = clone(delivery.whatsapp);
  }
  async findByTokenHash(hash: string) {
    const item = [...this.items.values()].find((candidate) => candidate.tokenHash === hash);
    return item ? clone(item) : null;
  }
  async answer(hash: string, response: SurveyResponse, now: Date): Promise<AnswerResult> {
    const item = [...this.items.values()].find((candidate) => candidate.tokenHash === hash);
    if (!item) return { kind: 'unavailable', invitation: null };
    if (item.response || item.expiresAt.getTime() <= now.getTime()) return { kind: 'unavailable', invitation: clone(item) };
    item.response = clone(response);
    return { kind: 'answered', invitation: clone(item) };
  }
  private matching(businessId: string, filter: SurveyFilter) {
    return [...this.items.values()].filter(
      (item) =>
        item.businessId === businessId &&
        (filter.queueIds === null || filter.queueIds.includes(item.queueId)) &&
        (!filter.queueId || item.queueId === filter.queueId) &&
        (!filter.operatorId || item.operatorId === filter.operatorId) &&
        (!filter.rating || item.response?.rating === filter.rating),
    );
  }
  async inRange(businessId: string, filter: SurveyFilter, from: Date, to: Date, limit: number) {
    return this.matching(businessId, filter)
      .filter((item) => item.createdAt >= from && item.createdAt < to)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map(clone);
  }
  async listResponses(businessId: string, filter: SurveyFilter, page: { page: number; pageSize: number }) {
    const answered = this.matching(businessId, filter)
      .filter((item) => item.response && (!filter.from || item.response.answeredAt >= filter.from) && (!filter.to || item.response.answeredAt < filter.to))
      .sort((a, b) => b.response!.answeredAt.getTime() - a.response!.answeredAt.getTime());
    const start = (page.page - 1) * page.pageSize;
    return { items: answered.slice(start, start + page.pageSize).map(clone), total: answered.length };
  }
}
