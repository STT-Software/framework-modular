import type { DeliveryState, SurveyInvitation, SurveyResponse } from './survey';
export interface SurveyFilter {
  /** The queues the caller may see; `null` is every queue. */
  queueIds: readonly string[] | null;
  queueId?: string;
  /** Only the turns attended by this operator. */
  operatorId?: string;
  from?: Date;
  to?: Date;
  rating?: number;
}
export type AnswerResult = { kind: 'answered'; invitation: SurveyInvitation } | { kind: 'unavailable'; invitation: SurveyInvitation | null };
/** What Turnos persists of its satisfaction surveys (collection of invitations, each with its answer once it has one). */
export abstract class SurveyRepository {
  /** Stores the invitation unless the turn already has one. Returns the one that exists. */
  abstract insertOnce(invitation: SurveyInvitation): Promise<{ created: boolean; invitation: SurveyInvitation }>;
  abstract recordDelivery(id: string, delivery: { email?: DeliveryState; whatsapp?: DeliveryState }): Promise<void>;
  abstract findByTokenHash(hash: string): Promise<SurveyInvitation | null>;
  /** Saves the answer only if the invitation has none yet and has not expired: one answer, whatever the requests do. */
  abstract answer(hash: string, response: SurveyResponse, now: Date): Promise<AnswerResult>;
  /** Invitations created in a range, with their answers, oldest first, at most `limit`. */
  abstract inRange(businessId: string, filter: SurveyFilter, from: Date, to: Date, limit: number): Promise<SurveyInvitation[]>;
  /** Answered invitations, newest answer first. */
  abstract listResponses(businessId: string, filter: SurveyFilter, page: { page: number; pageSize: number }): Promise<{ items: SurveyInvitation[]; total: number }>;
}
