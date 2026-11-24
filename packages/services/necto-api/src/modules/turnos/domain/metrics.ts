import { localDayKey, localHour } from './local-day';
import type { Operator, Queue, TurnosRules } from './configuration';
import { daysOf, type DayRange } from './range';
import { effectiveOf } from './rules';
import type { Ticket } from './ticket';
import type { OpenCount } from './ticket.repository';
const minutesBetween = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / 60_000);
/** Rounded to one decimal; null when there was nothing to average (never an invented zero). */
function average(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}
export const waitMinutes = (ticket: Ticket): number | null => (ticket.calledAt ? minutesBetween(ticket.createdAt, ticket.calledAt) : null);
export const serviceMinutes = (ticket: Ticket): number | null => (ticket.status === 'completed' && ticket.calledAt && ticket.finishedAt ? minutesBetween(ticket.calledAt, ticket.finishedAt) : null);
export type QueueState = 'paused' | 'empty' | 'normal' | 'busy' | 'full';
/** How loaded a queue is, from the people waiting and its own or inherited limits. A paused queue is paused whatever it holds. */
export function queueState(queue: Queue, rules: TurnosRules, waiting: number): QueueState {
  if (queue.status === 'paused') return 'paused';
  const { busyLimit, fullLimit } = effectiveOf(queue, rules);
  if (waiting >= fullLimit) return 'full';
  if (waiting >= busyLimit) return 'busy';
  return waiting === 0 ? 'empty' : 'normal';
}
export interface QueueBoardEntry {
  queue: Queue;
  waiting: number;
  attending: number;
  /** Minutes the one who has waited longest has been waiting. */
  longestWaitMinutes: number | null;
  /** People waiting for longer than the urgent time of the queue. */
  urgent: number;
  state: QueueState;
}
export interface WaitingArrival {
  queueId: string;
  createdAt: Date;
}
/** The state of each queue right now, from what is open. */
export function buildQueueBoard(queues: readonly Queue[], rules: TurnosRules, counts: Map<string, OpenCount>, arrivals: readonly WaitingArrival[], now: Date): QueueBoardEntry[] {
  return queues.map((queue) => {
    const count = counts.get(queue.id) ?? { waiting: 0, attending: 0, oldestWaitingAt: null };
    const { urgentMinutes } = effectiveOf(queue, rules);
    const urgent = arrivals.filter((arrival) => arrival.queueId === queue.id && minutesBetween(arrival.createdAt, now) > urgentMinutes).length;
    return {
      queue,
      waiting: count.waiting,
      attending: count.attending,
      longestWaitMinutes: count.oldestWaitingAt ? Math.round(minutesBetween(count.oldestWaitingAt, now) * 10) / 10 : null,
      urgent,
      state: queueState(queue, rules, count.waiting),
    };
  });
}
export interface Totals {
  created: number;
  completed: number;
  cancelled: number;
  noShow: number;
  /** Turns that were called (and so waited a measurable time). */
  called: number;
  averageWaitMinutes: number | null;
  averageServiceMinutes: number | null;
  /** Share of the turns created that ended completed, 0 to 100; null with no turns. */
  completionRate: number | null;
  /** Share of the turns that were called whose person did not show up, 0 to 100; null when none was called. */
  noShowRate: number | null;
}
export function totalsOf(tickets: readonly Ticket[]): Totals {
  const completed = tickets.filter((ticket) => ticket.status === 'completed');
  const noShow = tickets.filter((ticket) => ticket.status === 'no-show');
  const called = tickets.filter((ticket) => ticket.calledAt !== null);
  const rate = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);
  return {
    created: tickets.length,
    completed: completed.length,
    cancelled: tickets.filter((ticket) => ticket.status === 'cancelled').length,
    noShow: noShow.length,
    called: called.length,
    averageWaitMinutes: average(called.map((ticket) => waitMinutes(ticket)!)),
    averageServiceMinutes: average(completed.map((ticket) => serviceMinutes(ticket)).filter((value): value is number => value !== null)),
    completionRate: rate(completed.length, tickets.length),
    noShowRate: rate(noShow.length, called.length),
  };
}
export interface QueueMetrics extends Totals {
  queueId: string;
}
export function metricsByQueue(tickets: readonly Ticket[], queues: readonly Queue[]): QueueMetrics[] {
  return queues.map((queue) => ({ queueId: queue.id, ...totalsOf(tickets.filter((ticket) => ticket.queueId === queue.id)) }));
}
export interface DayPoint {
  day: string;
  created: number;
  completed: number;
  cancelled: number;
  noShow: number;
}
/** One point per day of the range, including the days with nothing (a chart needs them to be continuous). */
export function dailySeries(tickets: readonly Ticket[], range: DayRange, timeZone: string): DayPoint[] {
  const points = new Map<string, DayPoint>(daysOf(range).map((day) => [day, { day, created: 0, completed: 0, cancelled: 0, noShow: 0 }]));
  for (const ticket of tickets) {
    const point = points.get(localDayKey(ticket.createdAt, timeZone));
    if (!point) continue;
    point.created += 1;
    if (ticket.status === 'completed') point.completed += 1;
    else if (ticket.status === 'cancelled') point.cancelled += 1;
    else if (ticket.status === 'no-show') point.noShow += 1;
  }
  return [...points.values()];
}
/** Turns created at each hour of the day (0 to 23, local), over the whole range. */
export function hourlySeries(tickets: readonly Ticket[], timeZone: string): Array<{ hour: number; created: number }> {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, created: 0 }));
  for (const ticket of tickets) hours[localHour(ticket.createdAt, timeZone)].created += 1;
  return hours;
}
export interface TeamMember {
  operatorId: string;
  name: string;
  status: Operator['status'];
  queueIds: string[];
  /** Turns they called in the range. */
  attended: number;
  completed: number;
  noShow: number;
  cancelled: number;
  averageServiceMinutes: number | null;
  /** The turn they have in attention right now. */
  current: { ticketId: string; code: string; since: Date } | null;
}
/**
 * What each operator did in the range, counted from the turns they called. Operators without activity appear with zeros. A person
 * who was removed but did work keeps appearing (with the name they had), so the history still adds up.
 */
export function teamPerformance(tickets: readonly Ticket[], operators: readonly Operator[], attendingNow: readonly Ticket[]): TeamMember[] {
  const byId = new Map<string, TeamMember>();
  const blank = (operatorId: string, name: string, status: Operator['status'] | 'removed', queueIds: string[]): TeamMember => ({
    operatorId,
    name,
    status: status === 'removed' ? (operatorId.startsWith('admin:') ? 'active' : 'inactive') : status,
    queueIds,
    attended: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
    averageServiceMinutes: null,
    current: null,
  });
  for (const operator of operators) byId.set(operator.id, blank(operator.id, operator.name, operator.status, operator.queueIds));
  const services = new Map<string, number[]>();
  for (const ticket of tickets) {
    if (!ticket.attendedBy) continue;
    const member = byId.get(ticket.attendedBy.operatorId) ?? blank(ticket.attendedBy.operatorId, ticket.attendedBy.name, 'removed', []);
    byId.set(member.operatorId, member);
    member.attended += 1;
    if (ticket.status === 'completed') {
      member.completed += 1;
      const minutes = serviceMinutes(ticket);
      if (minutes !== null) services.set(member.operatorId, [...(services.get(member.operatorId) ?? []), minutes]);
    } else if (ticket.status === 'no-show') member.noShow += 1;
    else if (ticket.status === 'cancelled') member.cancelled += 1;
  }
  for (const ticket of attendingNow) {
    const member = ticket.attendedBy ? byId.get(ticket.attendedBy.operatorId) : undefined;
    if (member && ticket.calledAt) member.current = { ticketId: ticket.id, code: ticket.code, since: ticket.calledAt };
  }
  for (const [operatorId, minutes] of services) byId.get(operatorId)!.averageServiceMinutes = average(minutes);
  return [...byId.values()].sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name));
}
