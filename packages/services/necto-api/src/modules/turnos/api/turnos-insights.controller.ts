import { Body, Controller, Get, HttpCode, MessageEvent, Param, Post, Put, Query, Req, Res, Sse, StreamableFile, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { NoStoreInterceptor } from '../../../platform/http/no-store.interceptor';
import { RequiresBusinessModule, type AdminRequest } from '../../business-access/public';
import type { TurnosScope } from '../application/turnos-access.service';
import { TurnosInsightsService } from '../application/turnos-insights.service';
import { TurnosSettingsService } from '../application/turnos-settings.service';
import { TurnosStreamService } from '../application/turnos-stream.service';
import { TurnosSurveyService } from '../application/turnos-survey.service';
import { TurnosTicketService } from '../application/turnos-ticket.service';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { ActivityQueryDto, RangeQueryDto, RoomScreenDto, SurveyConfigDto, SurveyQueryDto, TicketListQueryDto } from './dto/operation.dto';
import {
  queueSummary,
  toActivityResponse,
  toAnalyticsResponse,
  toBoardResponse,
  toOverviewResponse,
  toRoomScreenResponse,
  toSurveyConfigResponse,
  toSurveyResponses,
  toTeamResponse,
  toTicketPage,
  toTicketResponse,
} from './turnos-operation.response';
import { Scope, UsesAdminScope } from './turnos-scope.guards';
import { toEventItem } from './turnos-stream.mapper';
const rangeOf = (query: RangeQueryDto) => ({ preset: query.range, from: query.from, to: query.to });
/**
 * What the ADMINISTRATOR of a business sees of Turnos running: the dashboard numbers, the team, the recent activity, every turn (with
 * search and filters), the CSV report, the room screen and the surveys. Guarded by `@RequiresBusinessModule('turnos')`: on every request
 * the person must be the current boss of that active business with Turnos enabled; an operator is never let in. Everything is real data
 * counted from the turns: an empty range answers zeros and `null`, never invented values. The administrator watches and configures; the
 * operators are the ones who create, call and complete turns.
 */
@Controller('turnos/businesses/:businessId/insights')
@UsesAdminScope()
@RequiresBusinessModule(TURNOS_MODULE_ID)
@UseInterceptors(NoStoreInterceptor)
export class TurnosInsightsController {
  constructor(
    private readonly insights: TurnosInsightsService,
    private readonly tickets: TurnosTicketService,
    private readonly surveys: TurnosSurveyService,
    private readonly settings: TurnosSettingsService,
    private readonly stream: TurnosStreamService,
  ) {}
  @Get('overview')
  async overview(@Scope() scope: TurnosScope, @Query() query: RangeQueryDto) {
    return toOverviewResponse(await this.insights.overview(scope, rangeOf(query)));
  }
  /** What each operator did in the range: turns attended, completed, absent, cancelled and average attention time. */
  @Get('team')
  async team(@Scope() scope: TurnosScope, @Query() query: RangeQueryDto) {
    return toTeamResponse(await this.insights.team(scope, rangeOf(query)));
  }
  @Get('activity')
  async activity(@Scope() scope: TurnosScope, @Query() query: ActivityQueryDto) {
    return { items: toActivityResponse(await this.insights.activity(scope, query.limit)) };
  }
  @Get('queues')
  async queues(@Scope() scope: TurnosScope) {
    return { queues: toBoardResponse(await this.tickets.board(scope)) };
  }
  /** Pauses a queue: no new turns, the existing ones stay. */
  @Post('queues/:queueId/pause')
  @HttpCode(200)
  async pause(@Scope() scope: TurnosScope, @Param('queueId') queueId: string) {
    return { queue: queueSummary(await this.tickets.setQueueStatus(scope, queueId, 'paused')) };
  }
  @Post('queues/:queueId/resume')
  @HttpCode(200)
  async resume(@Scope() scope: TurnosScope, @Param('queueId') queueId: string) {
    return { queue: queueSummary(await this.tickets.setQueueStatus(scope, queueId, 'active')) };
  }
  @Get('tickets')
  async list(@Scope() scope: TurnosScope, @Query() query: TicketListQueryDto) {
    return toTicketPage(await this.tickets.list(scope, { ...rangeOf(query), queueId: query.queueId, statuses: query.status, search: query.search, operatorId: query.operatorId, order: query.order, page: query.page, pageSize: query.pageSize }));
  }
  /** The report as a CSV file, with the same filters as the list (and today when no range is given). `X-Report-Truncated: true` when it was cut. */
  @Get('tickets.csv')
  async report(@Scope() scope: TurnosScope, @Query() query: TicketListQueryDto, @Res({ passthrough: true }) response: Response) {
    const report = await this.insights.report(scope, { ...rangeOf(query), queueId: query.queueId, statuses: query.status, search: query.search, operatorId: query.operatorId });
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report.fileName}"`,
      'X-Report-Rows': String(report.rows),
      'X-Report-Truncated': String(report.truncated),
    });
    // The BOM makes spreadsheets read the accents as UTF-8.
    return new StreamableFile(Buffer.from(`\uFEFF${report.csv}`, 'utf8'));
  }
  @Get('tickets/:ticketId')
  async get(@Scope() scope: TurnosScope, @Param('ticketId') ticketId: string) {
    return { ticket: toTicketResponse(await this.tickets.get(scope, ticketId), { detail: true }) };
  }
  /** The settings of the room screen and the calls it would show now. */
  @Get('room-screen')
  async roomScreen(@Scope() scope: TurnosScope) {
    return toRoomScreenResponse(await this.insights.roomScreen(scope));
  }
  @Put('room-screen')
  async saveRoomScreen(@Scope() scope: TurnosScope, @Body() dto: RoomScreenDto) {
    const saved = await this.settings.saveRoomScreen(scope, dto);
    return toRoomScreenResponse(await this.insights.roomScreen(scope, saved));
  }
  @Get('surveys/config')
  surveyConfig(@Scope() scope: TurnosScope) {
    return toSurveyConfigResponse(scope.configuration.survey);
  }
  @Put('surveys/config')
  async saveSurveyConfig(@Scope() scope: TurnosScope, @Body() dto: SurveyConfigDto) {
    return toSurveyConfigResponse(await this.settings.saveSurvey(scope, dto));
  }
  @Get('surveys/summary')
  async surveySummary(@Scope() scope: TurnosScope, @Query() query: SurveyQueryDto) {
    return toAnalyticsResponse(await this.surveys.analytics(scope, { ...rangeOf(query), queueId: query.queueId, operatorId: query.operatorId }));
  }
  @Get('surveys/responses')
  async surveyResponses(@Scope() scope: TurnosScope, @Query() query: SurveyQueryDto) {
    return toSurveyResponses(
      await this.surveys.responses(scope, { ...rangeOf(query), queueId: query.queueId, operatorId: query.operatorId, rating: query.rating, page: query.page, pageSize: query.pageSize }),
      true,
    );
  }
  /** Live updates of the whole business (Server-Sent Events); see the operator route for the events. */
  @Sse('events')
  events(@Scope() scope: TurnosScope, @Req() request: AdminRequest): Observable<MessageEvent> {
    return this.stream.open({ role: 'admin', businessId: scope.businessId, email: scope.email, sessionId: request.adminSession!.id }).pipe(map(toEventItem));
  }
}
