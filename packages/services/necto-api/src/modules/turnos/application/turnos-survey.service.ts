import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { MailSendError, MailTransport } from '../../../platform/mail/mail-transport';
import { Clock } from '../../../platform/time/clock';
import { LIMITS } from '../domain/catalog';
import type { SurveyConfig, TurnosConfiguration } from '../domain/configuration';
import { SurveyClosedError, SurveyNotFoundError, TurnosInvalidError, ViewNotAllowedError } from '../domain/errors';
import { Issues } from '../domain/issues';
import { resolveRange, type RangeQuery } from '../domain/range';
import {
  analyzeSurveys,
  hashSurveyToken,
  newSurveyToken,
  parseSurveyAnswer,
  type DeliveryState,
  type SurveyAnalytics,
  type SurveyAnswerInput,
  type SurveyInvitation,
} from '../domain/survey';
import { SurveyRepository, type SurveyFilter } from '../domain/survey.repository';
import type { Ticket } from '../domain/ticket';
import { BusinessDirectory } from '../../businesses/public';
import { canUse, reaches, type TurnosScope } from './turnos-access.service';
import { TurnosConfigurationStore } from './turnos-configuration.store';
import { TurnosRealtimeHub } from './turnos-realtime.hub';
import { buildSurveyEmail } from './turnos-survey-email';
const MAX_ANALYTICS_ROWS = 20000;
const state = (status: DeliveryState['status'], now: Date | null = null, failureCode: string | null = null): DeliveryState => ({ status, attemptedAt: now, failureCode });
/** What the customer sees when they open the link of the survey. */
export interface PublicSurvey {
  businessName: string;
  queueName: string;
  question: string;
  allowComment: boolean;
  thanksMessage: string | null;
  expiresAt: Date;
  /** True when it was already answered or expired: the page shows it closed. */
  closed: false | 'answered' | 'expired';
}
export interface SurveyQuery extends RangeQuery {
  queueId?: string;
  operatorId?: string;
  rating?: number;
  page?: number;
  pageSize?: number;
}
/**
 * The satisfaction surveys of Turnos: when a turn is completed the customer gets an invitation with a private link; they answer with a
 * rating from 1 to 5 (and a comment if the business allows it); the answers become the satisfaction numbers of the dashboard.
 *
 * Sending uses the mail the platform already has. Mail only counts as "accepted" when the provider took it, never as received. With no mail
 * provider configured the invitation is recorded as `not-configured`, and WhatsApp (which has no provider in this backend) always is: no
 * channel ever reports a send that did not happen.
 */
@Injectable()
export class TurnosSurveyService implements OnApplicationShutdown {
  private readonly logger = new Logger(TurnosSurveyService.name);
  private readonly inFlight = new Set<Promise<void>>();
  constructor(
    private readonly surveys: SurveyRepository,
    private readonly transport: MailTransport,
    private readonly directory: BusinessDirectory,
    private readonly hub: TurnosRealtimeHub,
    private readonly clock: Clock,
    private readonly config: ConfigService,
    private readonly store: TurnosConfigurationStore,
  ) {}
  /** Resolves when every invitation being sent has finished (on shutdown, and in tests). */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }
  onApplicationShutdown(): Promise<void> {
    return this.drain();
  }
  /** Creates the invitation of a completed turn (once per turn) and starts sending it. Does nothing when the survey is off for that queue. */
  async invite(ticket: Ticket, configuration: TurnosConfiguration): Promise<SurveyInvitation | null> {
    const survey = configuration.survey;
    if (!survey.enabled || (survey.queueIds !== null && !survey.queueIds.includes(ticket.queueId))) return null;
    const now = this.clock.now();
    const { token, hash } = newSurveyToken();
    const wantsEmail = survey.channels.email;
    const wantsWhatsapp = survey.channels.whatsapp;
    const invitation: SurveyInvitation = {
      id: randomUUID(),
      businessId: ticket.businessId,
      ticketId: ticket.id,
      ticketCode: ticket.code,
      queueId: ticket.queueId,
      queueName: ticket.queueName,
      operatorId: ticket.attendedBy?.operatorId ?? null,
      operatorName: ticket.attendedBy?.name ?? null,
      customerName: ticket.customer.name,
      createdAt: now,
      expiresAt: new Date(now.getTime() + survey.validHours * 3_600_000),
      tokenHash: hash,
      delivery: {
        email: !wantsEmail ? state('not-requested') : !ticket.customer.email ? state('no-contact') : state('pending'),
        // There is no WhatsApp provider in this backend: asking for it is recorded as not configured, never as sent.
        whatsapp: !wantsWhatsapp ? state('not-requested') : !ticket.customer.phone ? state('no-contact') : state('not-configured', now),
      },
      response: null,
    };
    const stored = await this.surveys.insertOnce(invitation);
    // A turn completed twice (a repeated request) has its invitation already: nothing more is sent.
    if (!stored.created) return stored.invitation;
    if (invitation.delivery.email.status === 'pending' && ticket.customer.email) {
      const job = this.sendEmail(stored.invitation, ticket.customer.email, token, survey).finally(() => this.inFlight.delete(job));
      this.inFlight.add(job);
    }
    return stored.invitation;
  }
  /** What the customer sees at the link. A link that does not exist answers like any other unknown one. */
  async open(token: string): Promise<PublicSurvey> {
    const invitation = await this.find(token);
    const business = await this.directory.find(invitation.businessId);
    if (!business) throw new SurveyNotFoundError();
    const config = (await this.configurationOf(invitation.businessId)) ?? null;
    return {
      businessName: business.name,
      queueName: invitation.queueName,
      question: config?.question ?? '¿Cómo calificas la atención que recibiste?',
      allowComment: config?.allowComment ?? true,
      thanksMessage: config?.thanksMessage ?? null,
      expiresAt: invitation.expiresAt,
      closed: invitation.response ? 'answered' : invitation.expiresAt.getTime() <= this.clock.now().getTime() ? 'expired' : false,
    };
  }
  /** Saves the customer's answer. The first valid answer wins; a second one (or one after the link expired) is refused with 409. */
  async respond(token: string, input: SurveyAnswerInput): Promise<{ thanksMessage: string | null }> {
    const invitation = await this.find(token);
    const config = await this.configurationOf(invitation.businessId);
    const answer = parseSurveyAnswer(input, config?.allowComment ?? true);
    const result = await this.surveys.answer(hashSurveyToken(token), { rating: answer.rating, comment: answer.comment, answeredAt: this.clock.now() }, this.clock.now());
    if (result.kind === 'unavailable') {
      if (result.invitation?.response) throw new SurveyClosedError('answered');
      throw new SurveyClosedError('expired');
    }
    this.hub.publish({ type: 'survey.answered', businessId: invitation.businessId, at: this.clock.now(), queueId: invitation.queueId });
    return { thanksMessage: config?.thanksMessage ?? null };
  }
  /** Satisfaction numbers of the range for what the person may see: an administrator sees all, an operator only their queues (and themselves). */
  async analytics(scope: TurnosScope, query: SurveyQuery): Promise<{ range: { from: string; to: string }; analytics: SurveyAnalytics; truncated: boolean }> {
    this.requireSurveysView(scope);
    const range = resolveRange(query, this.clock.now(), scope.timezone);
    const filter = this.filterOf(scope, query);
    const invitations = await this.surveys.inRange(scope.businessId, filter, range.from, range.to, MAX_ANALYTICS_ROWS + 1);
    const analytics = analyzeSurveys(invitations.slice(0, MAX_ANALYTICS_ROWS), range, scope.timezone, scope.configuration.queues, {
      all: scope.role === 'admin',
      operatorId: scope.operator?.id ?? null,
    });
    return { range: { from: range.fromDay, to: range.toDay }, analytics, truncated: invitations.length > MAX_ANALYTICS_ROWS };
  }
  /** The answered surveys, newest first, with the comments. */
  async responses(scope: TurnosScope, query: SurveyQuery): Promise<{ items: SurveyInvitation[]; total: number; page: number; pageSize: number }> {
    this.requireSurveysView(scope);
    const filter = this.filterOf(scope, query);
    if (query.from !== undefined || query.to !== undefined || query.preset !== undefined) {
      const range = resolveRange(query, this.clock.now(), scope.timezone);
      filter.from = range.from;
      filter.to = range.to;
    }
    const pageSize = query.pageSize ?? LIMITS.pageSize.default;
    const page = query.page ?? 1;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > LIMITS.pageSize.max || !Number.isInteger(page) || page < 1) {
      throw new TurnosInvalidError('invalid-filter', { page: [`page must be from 1 and pageSize from 1 to ${LIMITS.pageSize.max}`] });
    }
    const { items, total } = await this.surveys.listResponses(scope.businessId, filter, { page, pageSize });
    return { items, total, page, pageSize };
  }
  private requireSurveysView(scope: TurnosScope): void {
    if (scope.role === 'operator' && !canUse(scope, 'surveys')) throw new ViewNotAllowedError();
  }
  private filterOf(scope: TurnosScope, query: SurveyQuery): SurveyFilter {
    const issues = new Issues();
    if (query.queueId && !reaches(scope, query.queueId)) issues.add('queueId', 'queueId must be one of your queues');
    if (query.rating !== undefined && (!Number.isInteger(query.rating) || query.rating < 1 || query.rating > 5)) issues.add('rating', 'rating must be a whole number from 1 to 5');
    if (issues.any) throw new TurnosInvalidError('invalid-filter', issues.fields);
    const filter: SurveyFilter = { queueIds: scope.queueIds };
    if (query.queueId) filter.queueId = query.queueId;
    if (query.rating) filter.rating = query.rating;
    // An operator sees what is said about their queues, in every operator's turns. Naming one operator narrows it, for the administrator only.
    if (scope.role === 'admin' && query.operatorId) filter.operatorId = query.operatorId;
    return filter;
  }
  private async find(token: string): Promise<SurveyInvitation> {
    const invitation = typeof token === 'string' && token.length >= 20 && token.length <= 100 ? await this.surveys.findByTokenHash(hashSurveyToken(token)) : null;
    if (!invitation) throw new SurveyNotFoundError();
    return invitation;
  }
  /** The current survey settings of a business (the question and options shown to the customer). */
  private async configurationOf(businessId: string): Promise<SurveyConfig | null> {
    return (await this.store.find(businessId))?.survey ?? null;
  }
  private async sendEmail(invitation: SurveyInvitation, to: string, token: string, survey: SurveyConfig): Promise<void> {
    const attemptedAt = this.clock.now();
    try {
      const business = await this.directory.find(invitation.businessId);
      const base = (this.config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:6020').trim();
      const link = new URL(`/turnos/survey/${token}`, base).toString();
      const email = buildSurveyEmail({ businessName: business?.name ?? '', customerName: invitation.customerName, question: survey.question, link, validHours: survey.validHours });
      await this.transport.send({ to, ...email });
      await this.surveys.recordDelivery(invitation.id, { email: state('accepted', attemptedAt) });
    } catch (error) {
      const code = error instanceof MailSendError ? error.code : 'unknown';
      this.logger.warn(`Survey email not sent (invitation ${invitation.id}): ${code}`);
      try {
        await this.surveys.recordDelivery(invitation.id, { email: code === 'not-configured' ? state('not-configured', attemptedAt) : state('failed', attemptedAt, code) });
      } catch {
        this.logger.error(`The result of invitation ${invitation.id} could not be recorded`);
      }
    }
  }
}
