import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { LIMITS, type OperatorViewId, type RoomNameDisplay } from '../domain/catalog';
import type { RoomScreenConfig } from '../domain/configuration';
import { AdministratorRequiredError, TurnosInvalidError, ViewNotAllowedError } from '../domain/errors';
import {
  dailySeries,
  hourlySeries,
  metricsByQueue,
  teamPerformance,
  totalsOf,
  type DayPoint,
  type QueueBoardEntry,
  type QueueMetrics,
  type TeamMember,
  type Totals,
} from '../domain/metrics';
import { resolveRange, type DayRange, type RangeQuery } from '../domain/range';
import { buildCsv } from '../domain/report';
import type { Ticket } from '../domain/ticket';
import { TicketRepository, type ActivityEntry } from '../domain/ticket.repository';
import { canUse, type TurnosScope } from './turnos-access.service';
import { TurnosTicketService, type TicketQuery } from './turnos-ticket.service';
/** The most turns read to compute a range; with more, the answer says it is partial instead of pretending to be complete. */
const MAX_ROWS = LIMITS.reportRows;
export interface Overview {
  range: DayRange;
  totals: Totals;
  /** What the person themselves did in the range (the administrator too, when they attend). */
  mine: Totals;
  board: Array<QueueBoardEntry & { metrics: QueueMetrics }>;
  daily: DayPoint[];
  hourly: Array<{ hour: number; created: number }>;
  /** True when the range holds more turns than are read, so the numbers cover only the first ones. */
  truncated: boolean;
  generatedAt: Date;
}
export interface RoomCall {
  ticketId: string;
  code: string;
  queueId: string;
  queueName: string;
  /** What the room screen may show of the person, following the setting: the full name, the first name, or nothing. */
  customer: string | null;
  calledAt: Date;
  status: Ticket['status'];
}
const displayName = (name: string | null, mode: RoomNameDisplay): string | null => (name === null || mode === 'hidden' ? null : mode === 'first-name' ? (name.split(/\s+/)[0] ?? null) : name);
/**
 * What the dashboards show, computed from the real turns: never a number that was not counted. An administrator sees the whole business; an
 * operator sees only their queues. A range with nothing in it answers zeros and nulls ("no data"), not invented values.
 */
@Injectable()
export class TurnosInsightsService {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly ticketService: TurnosTicketService,
    private readonly clock: Clock,
  ) {}
  /** The main dashboard: totals, the state of each queue, turns per day and per hour. For an operator it is the "Inicio" view. */
  async overview(scope: TurnosScope, query: RangeQuery): Promise<Overview> {
    this.requireView(scope, 'home');
    const range = resolveRange(query, this.clock.now(), scope.timezone);
    const rows = await this.tickets.inRange(scope.businessId, scope.queueIds, range.from, range.to, MAX_ROWS + 1);
    const inRange = rows.slice(0, MAX_ROWS);
    const queues = scope.configuration.queues.filter((queue) => scope.queueIds === null || scope.queueIds.includes(queue.id));
    const metrics = metricsByQueue(inRange, queues);
    const board = (await this.ticketService.board(scope)).map((entry) => ({ ...entry, metrics: metrics.find((item) => item.queueId === entry.queue.id)! }));
    return {
      range,
      totals: totalsOf(inRange),
      mine: totalsOf(inRange.filter((ticket) => ticket.attendedBy?.operatorId === scope.actor.operatorId)),
      board,
      daily: dailySeries(inRange, range, scope.timezone),
      hourly: hourlySeries(inRange, scope.timezone),
      truncated: rows.length > MAX_ROWS,
      generatedAt: this.clock.now(),
    };
  }
  /** What each operator did in the range (administrator only: it compares people). */
  async team(scope: TurnosScope, query: RangeQuery): Promise<{ range: DayRange; members: TeamMember[]; truncated: boolean }> {
    this.requireAdmin(scope);
    const range = resolveRange(query, this.clock.now(), scope.timezone);
    const [rows, attending] = await Promise.all([
      this.tickets.inRange(scope.businessId, null, range.from, range.to, MAX_ROWS + 1),
      this.tickets.attendingNow(scope.businessId, null),
    ]);
    return { range, members: teamPerformance(rows.slice(0, MAX_ROWS), scope.configuration.operators, attending), truncated: rows.length > MAX_ROWS };
  }
  /** The latest things that happened to turns, newest first. */
  async activity(scope: TurnosScope, limit: number | undefined): Promise<ActivityEntry[]> {
    this.requireView(scope, 'home');
    const size = limit ?? 20;
    if (!Number.isInteger(size) || size < 1 || size > 100) throw new TurnosInvalidError('invalid-filter', { limit: ['limit must be a whole number from 1 to 100'] });
    return this.tickets.recentActivity(scope.businessId, scope.queueIds, size);
  }
  /** The report as CSV text, with the same filters as the list of turns. Administrator only. */
  async report(scope: TurnosScope, query: TicketQuery): Promise<{ csv: string; rows: number; truncated: boolean; fileName: string }> {
    this.requireAdmin(scope);
    const { items, truncated } = await this.ticketService.forReport(scope, query);
    const range = resolveRange(query.from || query.to || query.preset ? query : { preset: 'today' }, this.clock.now(), scope.timezone);
    return { csv: buildCsv(items), rows: items.length, truncated, fileName: `turnos-${range.fromDay}_${range.toDay}.csv` };
  }
  /** The calls the room screen would show, following its settings (the queues chosen and how the names appear). Administrator only. */
  async roomScreen(scope: TurnosScope, settings: RoomScreenConfig = scope.configuration.roomScreen): Promise<{ settings: RoomScreenConfig; calls: RoomCall[] }> {
    this.requireAdmin(scope);
    const queueIds = settings.queueIds ?? null;
    const called = await this.tickets.lastCalled(scope.businessId, queueIds, settings.recentCalls);
    return {
      settings,
      calls: called.map((ticket) => ({
        ticketId: ticket.id,
        code: ticket.code,
        queueId: ticket.queueId,
        queueName: ticket.queueName,
        customer: displayName(ticket.customer.name, settings.customerName),
        calledAt: ticket.calledAt!,
        status: ticket.status,
      })),
    };
  }
  private requireAdmin(scope: TurnosScope): void {
    if (scope.role !== 'admin') throw new AdministratorRequiredError();
  }
  private requireView(scope: TurnosScope, view: OperatorViewId): void {
    if (scope.role === 'operator' && !canUse(scope, view)) throw new ViewNotAllowedError();
  }
}
