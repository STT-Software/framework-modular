import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Clock } from '../../../platform/time/clock';
import { localDayKey } from '../domain/local-day';
import { LIMITS, TICKET_STATUSES, type OperatorViewId, type QueueStatus, type TicketStatus } from '../domain/catalog';
import type { Queue } from '../domain/configuration';
import {
  InvalidTicketStateError,
  NotNextInLineError,
  OperatorBusyError,
  QueueEmptyError,
  QueueNotFoundError,
  QueuePausedError,
  TicketAlreadyTakenError,
  TicketNotFoundError,
  TicketNumberingError,
  TurnosInvalidError,
  ViewNotAllowedError,
} from '../domain/errors';
import { Issues } from '../domain/issues';
import { buildQueueBoard, type QueueBoardEntry } from '../domain/metrics';
import { setQueueStatus } from '../domain/operations';
import { validateAnswers } from '../domain/queue-fields';
import { resolveRange, type RangeQuery } from '../domain/range';
import { effectiveOf } from '../domain/rules';
import { assertNoIssues, parseCustomer, ticketCode, type CreateTicketInput, type Ticket, type TicketActor } from '../domain/ticket';
import { TicketRepository, type CallResult, type FinishKind, type TicketFilter, type TicketOrder } from '../domain/ticket.repository';
import { reaches, canUse, type TurnosScope } from './turnos-access.service';
import { TurnosConfigurationStore } from './turnos-configuration.store';
import { TurnosRealtimeHub, type TurnosEventType } from './turnos-realtime.hub';
import { TurnosSurveyService } from './turnos-survey.service';
const NUMBERING_ATTEMPTS = 6;
/** What an action on a turn answers: the turn as it is, and whether THIS request changed it (a repeated request answers `applied: false`). */
export interface TicketOutcome {
  ticket: Ticket;
  applied: boolean;
  /** Completing a turn of an automatic queue calls the next one in order of arrival: it is answered here. */
  next: Ticket | null;
}
export interface TicketQuery extends RangeQuery {
  queueId?: string;
  statuses?: string[];
  search?: string;
  /** Only the turns this operator called (an operator's own turns; for an administrator, the operator named). */
  mine?: boolean;
  operatorId?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}
const VIEWS_FOR_TURNS: OperatorViewId[] = ['my-turns'];
/**
 * The life of a turn: created at a counter, waiting, called by an operator, and completed, cancelled or marked absent. Who may do each
 * thing comes from the scope (the queues and views the person has), never from the request; every change of state is a single conditional
 * write in the repository, so a repeated or simultaneous request cannot call or complete a turn twice.
 */
@Injectable()
export class TurnosTicketService {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly store: TurnosConfigurationStore,
    private readonly clock: Clock,
    private readonly hub: TurnosRealtimeHub,
    private readonly surveys: TurnosSurveyService,
  ) {}
  /** Creates a turn in a queue. The queue must be one of the operator's, active (not paused), and the answers must fit its extra fields. */
  async create(scope: TurnosScope, queueId: string, input: CreateTicketInput): Promise<{ ticket: Ticket; created: boolean }> {
    const operator = this.requireOperator(scope, ['create-turn']);
    const queue = this.requireQueue(scope, queueId);
    if (queue.status === 'paused') throw new QueuePausedError();
    const issues = new Issues();
    const parsed = parseCustomer(input, issues);
    const answers = validateAnswers(queue.fields, input.answers, issues);
    assertNoIssues(issues);
    if (parsed.clientRequestId) {
      const existing = await this.tickets.findByRequestId(scope.businessId, parsed.clientRequestId);
      if (existing) return { ticket: this.sameRequest(existing, queue, operator.operatorId), created: false };
    }
    const rules = scope.configuration.rules;
    const prefix = effectiveOf(queue, rules).prefix;
    for (let attempt = 0; attempt < NUMBERING_ATTEMPTS; attempt++) {
      const now = this.clock.now();
      const dayKey = localDayKey(now, scope.timezone);
      const { number, seq } = await this.tickets.nextNumber(scope.businessId, rules.dailyReset ? dayKey : 'all', prefix);
      // The creation time is read after the number is taken, so the order of arrival follows the order of the numbers.
      const createdAt = this.clock.now();
      const code = ticketCode(prefix, number);
      const ticket: Ticket = {
        id: randomUUID(),
        businessId: scope.businessId,
        queueId: queue.id,
        queueName: queue.name,
        dayKey,
        prefix,
        number,
        code,
        seq,
        status: 'waiting',
        customer: parsed.customer,
        answers,
        note: parsed.note,
        createdAt,
        createdBy: operator,
        attendedBy: null,
        calledAt: null,
        finishedAt: null,
        cancelReason: null,
        events: [{ type: 'created', at: createdAt, by: operator }],
        clientRequestId: parsed.clientRequestId,
      };
      const result = await this.tickets.insert(ticket);
      if (result.kind === 'inserted') {
        this.emit('ticket.created', result.ticket);
        return { ticket: result.ticket, created: true };
      }
      if (result.kind === 'duplicate-request') return { ticket: this.sameRequest(result.ticket, queue, operator.operatorId), created: false };
      // That code already exists for the day (the numbering changed mode, for example): take the next number.
    }
    throw new TicketNumberingError();
  }
  async get(scope: TurnosScope, ticketId: string): Promise<Ticket> {
    this.requireTurnsView(scope);
    return this.requireTicket(scope, ticketId);
  }
  async list(scope: TurnosScope, query: TicketQuery): Promise<{ items: Ticket[]; total: number; page: number; pageSize: number }> {
    this.requireTurnsView(scope);
    const filter = this.filterOf(scope, query);
    const order: TicketOrder = query.order === 'arrival' ? 'arrival' : 'newest';
    if (query.order !== undefined && query.order !== 'arrival' && query.order !== 'newest') {
      throw new TurnosInvalidError('invalid-filter', { order: ['order must be arrival or newest'] });
    }
    const pageSize = this.pageSize(query.pageSize);
    const page = this.pageNumber(query.page);
    const { items, total } = await this.tickets.list(scope.businessId, filter, order, { page, pageSize });
    return { items, total, page, pageSize };
  }
  /** Every turn matching a filter, for a report (an administrator, or an operator with the turns view, only of their queues). */
  async forReport(scope: TurnosScope, query: TicketQuery): Promise<{ items: Ticket[]; truncated: boolean }> {
    const filter = this.filterOf(scope, { ...query, ...(query.from || query.to || query.preset ? {} : { preset: 'today' }) });
    const items = await this.tickets.findForReport(scope.businessId, filter, LIMITS.reportRows + 1);
    return { items: items.slice(0, LIMITS.reportRows), truncated: items.length > LIMITS.reportRows };
  }
  /** Calls a waiting turn. In a manual queue any waiting turn may be called; in an automatic one only the next in order of arrival. */
  async call(scope: TurnosScope, ticketId: string): Promise<TicketOutcome> {
    const operator = this.requireOperator(scope, VIEWS_FOR_TURNS);
    const ticket = await this.requireTicket(scope, ticketId);
    const queue = this.requireQueue(scope, ticket.queueId);
    const known = this.knownState(ticket, operator, 'attending');
    if (known) return known;
    if (ticket.status !== 'waiting') throw new InvalidTicketStateError(ticket.status);
    if (queue.mode === 'auto') {
      const head = await this.tickets.head(scope.businessId, queue.id);
      if (!head || head.id !== ticketId) throw new NotNextInLineError();
    }
    const result = await this.tickets.call(scope.businessId, ticketId, operator, scope.queueIds, this.clock.now(), false);
    return this.afterCall(scope, result, ticketId, operator);
  }
  /** Calls the next turn of a queue (the one that arrived first). It is the same in both modes. */
  async callNext(scope: TurnosScope, queueId: string): Promise<TicketOutcome> {
    const operator = this.requireOperator(scope, VIEWS_FOR_TURNS);
    this.requireQueue(scope, queueId);
    const result = await this.tickets.callNext(scope.businessId, queueId, operator, this.clock.now(), false);
    return this.afterCall(scope, result, null, operator);
  }
  async complete(scope: TurnosScope, ticketId: string): Promise<TicketOutcome> {
    return this.finish(scope, ticketId, 'completed', null);
  }
  async cancel(scope: TurnosScope, ticketId: string, reason: string | null): Promise<TicketOutcome> {
    if (reason !== null && (typeof reason !== 'string' || reason.trim().length > LIMITS.answerText)) {
      throw new TurnosInvalidError('invalid-ticket', { reason: [`reason must be text of at most ${LIMITS.answerText} characters`] });
    }
    return this.finish(scope, ticketId, 'cancelled', reason?.trim() || null);
  }
  async noShow(scope: TurnosScope, ticketId: string): Promise<TicketOutcome> {
    return this.finish(scope, ticketId, 'no-show', null);
  }
  /** The turn this operator is attending right now, if any. */
  async current(scope: TurnosScope): Promise<Ticket | null> {
    const operator = this.requireOperator(scope, VIEWS_FOR_TURNS.concat(['home']));
    return this.tickets.attendingOf(scope.businessId, operator.operatorId);
  }
  /** The state of each queue the person may see, right now. */
  async board(scope: TurnosScope): Promise<QueueBoardEntry[]> {
    const queues = scope.configuration.queues.filter((queue) => reaches(scope, queue.id));
    const [counts, arrivals] = await Promise.all([this.tickets.openCounts(scope.businessId, scope.queueIds), this.tickets.waitingArrivals(scope.businessId, scope.queueIds)]);
    return buildQueueBoard(queues, scope.configuration.rules, counts, arrivals, this.clock.now());
  }
  /** Pauses or resumes a queue. Repeating it changes nothing. An administrator may do it with any queue; an operator, with the queues view, with theirs. */
  async setQueueStatus(scope: TurnosScope, queueId: string, status: QueueStatus): Promise<Queue> {
    if (scope.role === 'operator' && !canUse(scope, 'queues')) throw new ViewNotAllowedError();
    this.requireQueue(scope, queueId);
    let changed = false;
    const config = await this.store.update(scope.businessId, (current, now) => {
      const next = setQueueStatus(current, queueId, status, now);
      changed = next !== current;
      return next;
    });
    const queue = config.queues.find((candidate) => candidate.id === queueId);
    if (!queue) throw new QueueNotFoundError();
    if (changed) this.hub.publish({ type: status === 'paused' ? 'queue.paused' : 'queue.resumed', businessId: scope.businessId, at: this.clock.now(), queueId });
    return queue;
  }
  /**
   * An operator who lost the access (removed, switched off, no turns view, or no longer assigned to the queue of the turn they were attending)
   * must not keep a turn in their hands: it goes back to the line, in its place, for another operator to call.
   */
  async releaseIfUnauthorized(businessId: string, operatorId: string): Promise<Ticket | null> {
    const attending = await this.tickets.attendingOf(businessId, operatorId);
    if (!attending) return null;
    const config = await this.store.find(businessId);
    const operator = config?.operators.find((candidate) => candidate.id === operatorId);
    const stillAllowed =
      operator !== undefined &&
      operator.status === 'active' &&
      operator.views.includes('my-turns') &&
      operator.queueIds.includes(attending.queueId) &&
      config!.queues.some((queue) => queue.id === attending.queueId);
    if (stillAllowed) return null;
    const released = await this.tickets.releaseOf(businessId, operatorId, this.clock.now());
    if (released) this.emit('ticket.released', released);
    return released;
  }
  /** How many turns are still open in a queue (the administrator cannot delete a queue that has some). */
  countOpen(businessId: string, queueId: string): Promise<number> {
    return this.tickets.countOpen(businessId, queueId);
  }
  private async finish(scope: TurnosScope, ticketId: string, kind: FinishKind, reason: string | null): Promise<TicketOutcome> {
    const operator = this.requireOperator(scope, VIEWS_FOR_TURNS);
    const existing = await this.requireTicket(scope, ticketId);
    const queue = this.requireQueue(scope, existing.queueId);
    const changed = await this.tickets.finish(scope.businessId, ticketId, kind, operator, scope.queueIds, this.clock.now(), reason);
    if (!changed) {
      const now = await this.requireTicket(scope, ticketId);
      if (now.status === kind) return { ticket: now, applied: false, next: null };
      if (now.status === 'attending' && now.attendedBy?.operatorId !== operator.operatorId) throw new TicketAlreadyTakenError();
      throw new InvalidTicketStateError(now.status);
    }
    this.emit(kind === 'completed' ? 'ticket.completed' : kind === 'cancelled' ? 'ticket.cancelled' : 'ticket.no-show', changed);
    let next: Ticket | null = null;
    if (kind === 'completed') {
      void this.surveys.invite(changed, scope.configuration).catch(() => undefined);
      if (queue.mode === 'auto') {
        // The next in order of arrival is taken by the same operator, with one atomic write: two completions can never take the same one.
        const result = await this.tickets.callNext(scope.businessId, queue.id, operator, this.clock.now(), true);
        if (result.kind === 'called') {
          next = result.ticket;
          this.emit('ticket.called', next);
        }
      }
    }
    return { ticket: changed, applied: true, next };
  }
  private async afterCall(scope: TurnosScope, result: CallResult, ticketId: string | null, operator: TicketActor): Promise<TicketOutcome> {
    if (result.kind === 'called') {
      this.emit('ticket.called', result.ticket);
      return { ticket: result.ticket, applied: true, next: null };
    }
    if (result.kind === 'operator-busy') throw new OperatorBusyError();
    if (result.kind === 'empty') throw new QueueEmptyError();
    // Not waiting any more: somebody else (or this very operator, in a repeated request) was first.
    const now = ticketId ? await this.tickets.findById(scope.businessId, ticketId) : null;
    if (now && reaches(scope, now.queueId)) {
      const known = this.knownState(now, operator, 'attending');
      if (known) return known;
      throw new InvalidTicketStateError(now.status);
    }
    throw new TicketNotFoundError();
  }
  /** A repeated request finds the turn already in the state it asked for: answer it as done before. Another operator's turn is a conflict. */
  private knownState(ticket: Ticket, operator: TicketActor, wanted: TicketStatus): TicketOutcome | null {
    if (ticket.status !== wanted) return null;
    if (ticket.attendedBy?.operatorId === operator.operatorId) return { ticket, applied: false, next: null };
    throw new TicketAlreadyTakenError();
  }
  private sameRequest(existing: Ticket, queue: Queue, operatorId: string): Ticket {
    if (existing.queueId !== queue.id || existing.createdBy.operatorId !== operatorId) {
      throw new TurnosInvalidError('invalid-ticket', { clientRequestId: ['clientRequestId was already used for another turn'] });
    }
    return existing;
  }
  private requireOperator(scope: TurnosScope, views: OperatorViewId[]): TicketActor {
    if (!canUse(scope, ...views)) throw new ViewNotAllowedError();
    return { ...scope.actor };
  }
  private requireTurnsView(scope: TurnosScope): void {
    if (scope.role === 'operator' && !canUse(scope, 'my-turns')) throw new ViewNotAllowedError();
  }
  private requireQueue(scope: TurnosScope, queueId: string): Queue {
    const queue = scope.configuration.queues.find((candidate) => candidate.id === queueId);
    if (!queue || !reaches(scope, queueId)) throw new QueueNotFoundError();
    return queue;
  }
  private async requireTicket(scope: TurnosScope, ticketId: string): Promise<Ticket> {
    const ticket = typeof ticketId === 'string' && ticketId.length <= 64 ? await this.tickets.findById(scope.businessId, ticketId) : null;
    // A turn of a queue the person cannot reach answers exactly like one that does not exist.
    if (!ticket || !reaches(scope, ticket.queueId)) throw new TicketNotFoundError();
    return ticket;
  }
  private filterOf(scope: TurnosScope, query: TicketQuery): TicketFilter {
    const issues = new Issues();
    const statuses = (query.statuses ?? []).filter((status) => status !== '');
    for (const status of statuses) {
      if (!TICKET_STATUSES.some((known) => known === status)) issues.add('status', `status must be one of: ${TICKET_STATUSES.join(', ')}`);
    }
    if (query.search !== undefined && query.search.length > 80) issues.add('search', 'search must be at most 80 characters long');
    if (query.queueId !== undefined && query.queueId !== '' && !reaches(scope, query.queueId)) {
      // A queue outside the scope has no turns for this person.
      issues.add('queueId', 'queueId must be one of your queues');
    }
    if (issues.any) throw new TurnosInvalidError('invalid-filter', issues.fields);
    const filter: TicketFilter = { queueIds: scope.queueIds };
    if (query.queueId) filter.queueId = query.queueId;
    if (statuses.length > 0) filter.statuses = statuses as TicketStatus[];
    if (query.search?.trim()) filter.search = query.search.trim();
    if (query.from !== undefined || query.to !== undefined || query.preset !== undefined) {
      const range = resolveRange(query, this.clock.now(), scope.timezone);
      filter.from = range.from;
      filter.to = range.to;
    }
    if (query.mine) filter.attendedBy = scope.actor.operatorId;
    else if (scope.role === 'admin' && query.operatorId) filter.attendedBy = query.operatorId;
    return filter;
  }
  private pageSize(raw: number | undefined): number {
    if (raw === undefined) return LIMITS.pageSize.default;
    if (!Number.isInteger(raw) || raw < 1 || raw > LIMITS.pageSize.max) throw new TurnosInvalidError('invalid-filter', { pageSize: [`pageSize must be a whole number between 1 and ${LIMITS.pageSize.max}`] });
    return raw;
  }
  private pageNumber(raw: number | undefined): number {
    if (raw === undefined) return 1;
    if (!Number.isInteger(raw) || raw < 1 || raw > 100_000) throw new TurnosInvalidError('invalid-filter', { page: ['page must be a whole number from 1'] });
    return raw;
  }
  private emit(type: TurnosEventType, ticket: Ticket): void {
    this.hub.publish({ type, businessId: ticket.businessId, at: this.clock.now(), queueId: ticket.queueId, ticket });
  }
}
