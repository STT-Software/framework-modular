import { Body, Controller, Get, HttpCode, MessageEvent, Param, Post, Query, Req, Res, Sse, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { OperatesModule, type AdminRequest } from '../../business-access/public';
import type { TurnosScope } from '../application/turnos-access.service';
import { TurnosInsightsService } from '../application/turnos-insights.service';
import { TurnosStreamService } from '../application/turnos-stream.service';
import { TurnosSurveyService } from '../application/turnos-survey.service';
import { TurnosTicketService } from '../application/turnos-ticket.service';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { ActivityQueryDto, CancelTicketDto, CreateTicketDto, RangeQueryDto, SurveyQueryDto, TicketListQueryDto } from './dto/operation.dto';
import {
  queueSummary,
  toActivityResponse,
  toAnalyticsResponse,
  toBoardResponse,
  toOutcomeResponse,
  toOverviewResponse,
  toSurveyResponses,
  toTicketPage,
  toTicketResponse,
} from './turnos-operation.response';
import { toEventItem } from './turnos-stream.mapper';
import { RequiresView, Scope, UsesOperatorScope } from './turnos-scope.guards';
const rangeOf = (query: RangeQueryDto) => ({ preset: query.range, from: query.from, to: query.to });
/**
 * The workspace of an OPERATOR of Turnos: the routes behind the views Inicio, Mis turnos, Crear turno, Filas and Encuestas.
 *
 * Every request passes two checks on the server, whatever the page sends: `@OperatesModule` (the person is an operator of THAT business,
 * the business is active and has Turnos) and the scope guard (their assignment is active, and they hold the view the route declares with
 * `@RequiresView`). What they may reach is then limited to THEIR queues: a turn, a queue or a response of another queue answers 404.
 * The administrator watches from `insights`; the actions here (create, call, complete...) belong to operators only.
 */
@Controller('turnos/businesses/:businessId/operation')
@UsesOperatorScope()
@OperatesModule(TURNOS_MODULE_ID)
@UseInterceptors(NoStoreInterceptor)
export class TurnosOperationController {
  constructor(
    private readonly tickets: TurnosTicketService,
    private readonly insights: TurnosInsightsService,
    private readonly surveys: TurnosSurveyService,
    private readonly stream: TurnosStreamService,
  ) {}
  /** "Inicio": the numbers of their queues, what they did, the state of each queue, and the turn they have in attention. */
  @Get('home')
  @RequiresView('home')
  async home(@Scope() scope: TurnosScope, @Query() query: RangeQueryDto) {
    const [overview, current, activity] = await Promise.all([
      this.insights.overview(scope, rangeOf(query)),
      this.tickets.current(scope),
      this.insights.activity(scope, 10),
    ]);
    return { ...toOverviewResponse(overview), current: current ? toTicketResponse(current) : null, activity: toActivityResponse(activity) };
  }
  @Get('activity')
  @RequiresView('home')
  async activity(@Scope() scope: TurnosScope, @Query() query: ActivityQueryDto) {
    return { items: toActivityResponse(await this.insights.activity(scope, query.limit)) };
  }
  /** "Filas": the state of each of their queues. */
  @Get('queues')
  @RequiresView('queues')
  async queues(@Scope() scope: TurnosScope) {
    return { queues: toBoardResponse(await this.tickets.board(scope)) };
  }
  /** Pauses a queue: it takes no new turns and keeps the ones it has. Repeating it changes nothing. */
  @Post('queues/:queueId/pause')
  @HttpCode(200)
  @RequiresView('queues')
  async pause(@Scope() scope: TurnosScope, @Param('queueId') queueId: string) {
    return { queue: queueSummary(await this.tickets.setQueueStatus(scope, queueId, 'paused')) };
  }
  @Post('queues/:queueId/resume')
  @HttpCode(200)
  @RequiresView('queues')
  async resume(@Scope() scope: TurnosScope, @Param('queueId') queueId: string) {
    return { queue: queueSummary(await this.tickets.setQueueStatus(scope, queueId, 'active')) };
  }
  /** "Crear turno": 201 with the new turn; 200 with the same turn when the same `clientRequestId` was already used. */
  @Post('queues/:queueId/tickets')
  @RequiresView('create-turn')
  async create(@Scope() scope: TurnosScope, @Param('queueId') queueId: string, @Body() dto: CreateTicketDto, @Res({ passthrough: true }) response: Response) {
    const { ticket, created } = await this.tickets.create(scope, queueId, dto);
    response.status(created ? 201 : 200);
    return { created, ticket: toTicketResponse(ticket) };
  }
  /** Calls the next turn of the queue (the one that arrived first). 409 `operator-busy` while they still have one in attention. */
  @Post('queues/:queueId/call-next')
  @HttpCode(200)
  @RequiresView('my-turns')
  async callNext(@Scope() scope: TurnosScope, @Param('queueId') queueId: string) {
    return toOutcomeResponse(await this.tickets.callNext(scope, queueId));
  }
  /** "Mis turnos": search and filters over the turns of their queues. */
  @Get('tickets')
  @RequiresView('my-turns')
  async list(@Scope() scope: TurnosScope, @Query() query: TicketListQueryDto) {
    return toTicketPage(await this.tickets.list(scope, { ...rangeOf(query), queueId: query.queueId, statuses: query.status, search: query.search, mine: query.mine, order: query.order, page: query.page, pageSize: query.pageSize }));
  }
  /** The turn they have in attention right now (`ticket: null` when none). */
  @Get('tickets/current')
  @RequiresView('my-turns', 'home')
  async current(@Scope() scope: TurnosScope) {
    const ticket = await this.tickets.current(scope);
    return { ticket: ticket ? toTicketResponse(ticket, { detail: true }) : null };
  }
  @Get('tickets/:ticketId')
  @RequiresView('my-turns')
  async get(@Scope() scope: TurnosScope, @Param('ticketId') ticketId: string) {
    return { ticket: toTicketResponse(await this.tickets.get(scope, ticketId), { detail: true }) };
  }
  /** Calls a waiting turn. A repeated call by the same operator answers `applied: false`; another operator's turn is 409. */
  @Post('tickets/:ticketId/call')
  @HttpCode(200)
  @RequiresView('my-turns')
  async call(@Scope() scope: TurnosScope, @Param('ticketId') ticketId: string) {
    return toOutcomeResponse(await this.tickets.call(scope, ticketId));
  }
  /** Completes the turn in attention. In an automatic queue the answer also carries the next turn, already called. */
  @Post('tickets/:ticketId/complete')
  @HttpCode(200)
  @RequiresView('my-turns')
  async complete(@Scope() scope: TurnosScope, @Param('ticketId') ticketId: string) {
    return toOutcomeResponse(await this.tickets.complete(scope, ticketId));
  }
  @Post('tickets/:ticketId/cancel')
  @HttpCode(200)
  @RequiresView('my-turns')
  async cancel(@Scope() scope: TurnosScope, @Param('ticketId') ticketId: string, @Body() dto: CancelTicketDto) {
    return toOutcomeResponse(await this.tickets.cancel(scope, ticketId, dto.reason ?? null));
  }
  /** The person called did not show up. */
  @Post('tickets/:ticketId/no-show')
  @HttpCode(200)
  @RequiresView('my-turns')
  async noShow(@Scope() scope: TurnosScope, @Param('ticketId') ticketId: string) {
    return toOutcomeResponse(await this.tickets.noShow(scope, ticketId));
  }
  /** "Encuestas": satisfaction of their queues (and their own row). */
  @Get('surveys/summary')
  @RequiresView('surveys')
  async surveySummary(@Scope() scope: TurnosScope, @Query() query: SurveyQueryDto) {
    return toAnalyticsResponse(await this.surveys.analytics(scope, { ...rangeOf(query), queueId: query.queueId }));
  }
  @Get('surveys/responses')
  @RequiresView('surveys')
  async surveyResponses(@Scope() scope: TurnosScope, @Query() query: SurveyQueryDto) {
    return toSurveyResponses(await this.surveys.responses(scope, { ...rangeOf(query), queueId: query.queueId, rating: query.rating, page: query.page, pageSize: query.pageSize }), false);
  }
  /**
   * Live updates (Server-Sent Events) of their queues, with the same permission checks as every other route and again while it stays open.
   * Open it with `fetch` and the `Authorization` header (EventSource cannot send it). Events: `ready`, `ticket.*`, `queue.*`,
   * `survey.answered`, `config.updated`, `access.updated`, `access.revoked` (then it closes) and `ping`.
   */
  @Sse('events')
  @RequiresView('home', 'my-turns', 'create-turn', 'queues', 'surveys')
  events(@Scope() scope: TurnosScope, @Req() request: AdminRequest): Observable<MessageEvent> {
    return this.stream.open({ role: 'operator', businessId: scope.businessId, email: scope.email, sessionId: request.adminSession!.id }).pipe(map(toEventItem));
  }
}
