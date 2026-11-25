import type { Overview, RoomCall } from '../application/turnos-insights.service';
import type { TicketOutcome } from '../application/turnos-ticket.service';
import type { TurnosEvent } from '../application/turnos-realtime.hub';
import type { Queue, RoomScreenConfig, SurveyConfig } from '../domain/configuration';
import type { QueueBoardEntry, TeamMember } from '../domain/metrics';
import { serviceMinutes, waitMinutes } from '../domain/metrics';
import { RANGE_PRESETS, type DayRange } from '../domain/range';
import type { SurveyAnalytics, SurveyInvitation } from '../domain/survey';
import type { Ticket } from '../domain/ticket';
import type { ActivityEntry } from '../domain/ticket.repository';
const iso = (date: Date | null) => date?.toISOString() ?? null;
const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
/** A turn as the interface needs it. `events` (the whole history) is only given when one turn is opened. */
export function toTicketResponse(ticket: Ticket, options: { detail?: boolean } = {}) {
  return {
    id: ticket.id,
    code: ticket.code,
    queue: { id: ticket.queueId, name: ticket.queueName },
    status: ticket.status,
    customer: { ...ticket.customer },
    answers: ticket.answers.map((answer) => ({ fieldId: answer.fieldId, label: answer.label, type: answer.type, value: answer.value })),
    note: ticket.note,
    createdAt: ticket.createdAt.toISOString(),
    createdBy: { id: ticket.createdBy.operatorId, name: ticket.createdBy.name },
    calledAt: iso(ticket.calledAt),
    attendedBy: ticket.attendedBy ? { id: ticket.attendedBy.operatorId, name: ticket.attendedBy.name } : null,
    finishedAt: iso(ticket.finishedAt),
    cancelReason: ticket.cancelReason,
    waitMinutes: round(waitMinutes(ticket)),
    serviceMinutes: round(serviceMinutes(ticket)),
    ...(options.detail
      ? { events: ticket.events.map((event) => ({ type: event.type, at: event.at.toISOString(), by: { id: event.by.operatorId, name: event.by.name }, automatic: event.automatic === true })) }
      : {}),
  };
}
export function toOutcomeResponse(outcome: TicketOutcome) {
  return { applied: outcome.applied, ticket: toTicketResponse(outcome.ticket), next: outcome.next ? toTicketResponse(outcome.next) : null };
}
export function toTicketPage(page: { items: Ticket[]; total: number; page: number; pageSize: number }) {
  return { items: page.items.map((ticket) => toTicketResponse(ticket)), total: page.total, page: page.page, pageSize: page.pageSize };
}
export function queueSummary(queue: Queue) {
  return { id: queue.id, name: queue.name, color: queue.color, mode: queue.mode, status: queue.status, averageMinutes: queue.averageMinutes };
}
export function toBoardResponse(board: QueueBoardEntry[]) {
  return board.map((entry) => ({
    queue: queueSummary(entry.queue),
    waiting: entry.waiting,
    attending: entry.attending,
    longestWaitMinutes: entry.longestWaitMinutes,
    urgent: entry.urgent,
    state: entry.state,
  }));
}
const rangeResponse = (range: DayRange) => ({ from: range.fromDay, to: range.toDay, days: range.days });
export function toOverviewResponse(overview: Overview) {
  return {
    range: rangeResponse(overview.range),
    totals: overview.totals,
    mine: overview.mine,
    queues: overview.board.map((entry) => ({
      queue: queueSummary(entry.queue),
      waiting: entry.waiting,
      attending: entry.attending,
      longestWaitMinutes: entry.longestWaitMinutes,
      urgent: entry.urgent,
      state: entry.state,
      metrics: { ...entry.metrics, queueId: undefined },
    })),
    daily: overview.daily,
    hourly: overview.hourly,
    truncated: overview.truncated,
    generatedAt: overview.generatedAt.toISOString(),
  };
}
export function toTeamResponse(result: { range: DayRange; members: TeamMember[]; truncated: boolean }) {
  return {
    range: rangeResponse(result.range),
    truncated: result.truncated,
    members: result.members.map((member) => ({ ...member, current: member.current ? { ticketId: member.current.ticketId, code: member.current.code, since: member.current.since.toISOString() } : null })),
  };
}
export function toActivityResponse(entries: ActivityEntry[]) {
  return entries.map((entry) => ({
    type: entry.type,
    at: entry.at.toISOString(),
    by: { id: entry.by.operatorId, name: entry.by.name },
    automatic: entry.automatic,
    ticket: { id: entry.ticketId, code: entry.code },
    queue: { id: entry.queueId, name: entry.queueName },
  }));
}
export function toRoomScreenResponse(result: { settings: RoomScreenConfig; calls: RoomCall[] }) {
  return { settings: { ...result.settings }, calls: result.calls.map((call) => ({ ...call, calledAt: call.calledAt.toISOString() })) };
}
export const toSurveyConfigResponse = (config: SurveyConfig) => ({ ...config, channels: { ...config.channels } });
export function toAnalyticsResponse(result: { range: { from: string; to: string }; analytics: SurveyAnalytics; truncated: boolean }) {
  return { range: result.range, truncated: result.truncated, ...result.analytics };
}
export function toSurveyResponses(page: { items: SurveyInvitation[]; total: number; page: number; pageSize: number }, includeDelivery: boolean) {
  return {
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    items: page.items.map((invitation) => ({
      id: invitation.id,
      ticketCode: invitation.ticketCode,
      queue: { id: invitation.queueId, name: invitation.queueName },
      operator: invitation.operatorId ? { id: invitation.operatorId, name: invitation.operatorName } : null,
      rating: invitation.response!.rating,
      comment: invitation.response!.comment,
      answeredAt: invitation.response!.answeredAt.toISOString(),
      ...(includeDelivery ? { delivery: deliveryResponse(invitation) } : {}),
    })),
  };
}
/** What happened to sending an invitation. `accepted` is the provider taking it, never proof that the customer got it. */
export function deliveryResponse(invitation: SurveyInvitation) {
  const channel = (state: SurveyInvitation['delivery']['email']) => ({ status: state.status, attemptedAt: iso(state.attemptedAt), failureCode: state.failureCode });
  return { email: channel(invitation.delivery.email), whatsapp: channel(invitation.delivery.whatsapp) };
}
/** The body of a live event. A person who may not see the customer's data gets the code and the queue, nothing else of the turn. */
export function toEventResponse(event: TurnosEvent, withTicket: boolean) {
  return {
    type: event.type,
    at: event.at.toISOString(),
    queueId: event.queueId,
    ...(event.ticket ? { ticket: withTicket ? toTicketResponse(event.ticket) : { id: event.ticket.id, code: event.ticket.code, status: event.ticket.status } } : {}),
  };
}
export const OPERATION_CATALOG = { ranges: RANGE_PRESETS };
