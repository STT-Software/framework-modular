import { createHash, randomBytes } from 'node:crypto';
import { localDayKey } from './local-day';
import { TurnosInvalidError } from './errors';
import { isRecord, Issues } from './issues';
import { LIMITS } from './catalog';
import { daysOf, type DayRange } from './range';
export const RATINGS = [1, 2, 3, 4, 5] as const;
/** A rating of this or more counts as a satisfied customer. */
export const SATISFIED_FROM = 4;
/**
 * What happened to sending the invitation by one channel. `accepted` means the provider took the message: never that the customer got it.
 * `not-configured` is the honest answer when there is no provider (or it has no credentials): nothing was sent.
 */
export type DeliveryStatus = 'not-requested' | 'no-contact' | 'pending' | 'accepted' | 'failed' | 'not-configured';
export interface DeliveryState {
  status: DeliveryStatus;
  attemptedAt: Date | null;
  /** Why it failed (`rejected`, `timeout`, `connection`, `unknown`); never the address or the message. */
  failureCode: string | null;
}
export interface SurveyResponse {
  rating: number;
  comment: string | null;
  answeredAt: Date;
}
/** The invitation to rate one completed turn, and its answer if it already has one. */
export interface SurveyInvitation {
  id: string;
  businessId: string;
  ticketId: string;
  ticketCode: string;
  queueId: string;
  queueName: string;
  /** The operator who attended the turn: ratings are counted for them. */
  operatorId: string | null;
  operatorName: string | null;
  customerName: string | null;
  createdAt: Date;
  expiresAt: Date;
  /** Only a hash is stored: the link that carries the token is sent to the customer and cannot be rebuilt from the database. */
  tokenHash: string;
  delivery: { email: DeliveryState; whatsapp: DeliveryState };
  response: SurveyResponse | null;
}
export function newSurveyToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashSurveyToken(token) };
}
export function hashSurveyToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export interface SurveyAnswerInput {
  rating: number;
  comment?: string | null;
}
/**
 * Validates what the customer answers: a whole rating from 1 to 5 and, if the survey allows it, an optional comment.
 * @throws TurnosInvalidError (`invalid-answer`).
 */
export function parseSurveyAnswer(input: SurveyAnswerInput, allowComment: boolean): { rating: number; comment: string | null } {
  const issues = new Issues();
  if (!isRecord(input) || !RATINGS.some((rating) => rating === input.rating)) issues.add('rating', 'rating must be a whole number from 1 to 5');
  let comment: string | null = null;
  if (input.comment !== undefined && input.comment !== null) {
    if (typeof input.comment !== 'string') issues.add('comment', 'comment must be text');
    else if (input.comment.trim() !== '') {
      if (!allowComment) issues.add('comment', 'This survey does not take comments');
      else if (input.comment.trim().length > LIMITS.answerText * 2) issues.add('comment', `comment must be at most ${LIMITS.answerText * 2} characters long`);
      else comment = input.comment.trim();
    }
  }
  if (issues.any) throw new TurnosInvalidError('invalid-answer', issues.fields);
  return { rating: input.rating, comment };
}
const round = (value: number, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals;
export interface Satisfaction {
  /** Invitations created in the range. */
  invited: number;
  responses: number;
  /** Share of the invitations that were answered, 0 to 100; null without invitations. */
  responseRate: number | null;
  /** Average rating from 1 to 5; null without responses (never an invented number). */
  average: number | null;
  /** Share of responses of 4 or 5, 0 to 100; null without responses. */
  satisfied: number | null;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}
function satisfactionOf(invitations: readonly SurveyInvitation[]): Satisfaction {
  const answered = invitations.filter((invitation) => invitation.response !== null);
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const invitation of answered) distribution[String(invitation.response!.rating) as keyof typeof distribution] += 1;
  const sum = answered.reduce((total, invitation) => total + invitation.response!.rating, 0);
  return {
    invited: invitations.length,
    responses: answered.length,
    responseRate: invitations.length === 0 ? null : round((answered.length / invitations.length) * 100, 1),
    average: answered.length === 0 ? null : round(sum / answered.length),
    satisfied: answered.length === 0 ? null : round((answered.filter((invitation) => invitation.response!.rating >= SATISFIED_FROM).length / answered.length) * 100, 1),
    distribution,
  };
}
export interface SurveyAnalytics {
  overall: Satisfaction;
  /** One point per day of the range, with the days nobody answered (average null). */
  trend: Array<{ day: string; responses: number; average: number | null }>;
  byQueue: Array<{ queueId: string; queueName: string } & Satisfaction>;
  byOperator: Array<{ operatorId: string; operatorName: string } & Satisfaction>;
}
/**
 * Satisfaction computed from the invitations of the range and their answers: overall, per day (by the day each answer arrived), per queue
 * and per operator. Only real answers count; with none the numbers are null.
 */
export function analyzeSurveys(
  invitations: readonly SurveyInvitation[],
  range: DayRange,
  timeZone: string,
  queues: ReadonlyArray<{ id: string; name: string }>,
  includeOperators: { all: boolean; operatorId: string | null },
): SurveyAnalytics {
  const trendByDay = new Map(daysOf(range).map((day) => [day, [] as number[]]));
  for (const invitation of invitations) {
    if (!invitation.response) continue;
    trendByDay.get(localDayKey(invitation.response.answeredAt, timeZone))?.push(invitation.response.rating);
  }
  const groups = <K extends string>(keyOf: (invitation: SurveyInvitation) => K | null) => {
    const map = new Map<K, SurveyInvitation[]>();
    for (const invitation of invitations) {
      const key = keyOf(invitation);
      if (key !== null) map.set(key, [...(map.get(key) ?? []), invitation]);
    }
    return map;
  };
  const byQueue = [...groups((invitation) => invitation.queueId)].map(([queueId, list]) => ({
    queueId,
    queueName: queues.find((queue) => queue.id === queueId)?.name ?? list[0].queueName,
    ...satisfactionOf(list),
  }));
  const byOperator = [...groups((invitation) => invitation.operatorId)]
    .filter(([operatorId]) => includeOperators.all || operatorId === includeOperators.operatorId)
    .map(([operatorId, list]) => ({ operatorId, operatorName: list[0].operatorName ?? '', ...satisfactionOf(list) }));
  return {
    overall: satisfactionOf(invitations),
    trend: [...trendByDay].map(([day, ratings]) => ({
      day,
      responses: ratings.length,
      average: ratings.length === 0 ? null : round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length),
    })),
    byQueue: byQueue.sort((a, b) => a.queueName.localeCompare(b.queueName)),
    byOperator: byOperator.sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || a.operatorName.localeCompare(b.operatorName)),
  };
}
