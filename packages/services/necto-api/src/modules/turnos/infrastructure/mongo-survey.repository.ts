import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { QueryFilter, Model } from 'mongoose';
import type { DeliveryState, DeliveryStatus, SurveyInvitation, SurveyResponse } from '../domain/survey';
import { SurveyRepository, type AnswerResult, type SurveyFilter } from '../domain/survey.repository';
import { SurveyRecord } from './survey.schema';
type Lean = SurveyRecord & { _id: unknown };
const delivery = (record: { status: string; attemptedAt: Date | null; failureCode: string | null }): DeliveryState => ({
  status: record.status as DeliveryStatus,
  attemptedAt: record.attemptedAt ?? null,
  failureCode: record.failureCode ?? null,
});
function toDomain(record: Lean): SurveyInvitation {
  return {
    id: record.id,
    businessId: record.businessId,
    ticketId: record.ticketId,
    ticketCode: record.ticketCode,
    queueId: record.queueId,
    queueName: record.queueName,
    operatorId: record.operatorId ?? null,
    operatorName: record.operatorName ?? null,
    customerName: record.customerName ?? null,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    tokenHash: record.tokenHash,
    delivery: { email: delivery(record.delivery.email), whatsapp: delivery(record.delivery.whatsapp) },
    response: record.response ? { rating: record.response.rating, comment: record.response.comment ?? null, answeredAt: record.response.answeredAt } : null,
  };
}
function filterOf(businessId: string, filter: SurveyFilter): QueryFilter<SurveyRecord> {
  const query: QueryFilter<SurveyRecord> = { businessId };
  if (filter.queueIds !== null) query.queueId = { $in: [...filter.queueIds] };
  if (filter.queueId) query.queueId = filter.queueIds === null || filter.queueIds.includes(filter.queueId) ? filter.queueId : { $in: [] };
  if (filter.operatorId) query.operatorId = filter.operatorId;
  if (filter.rating) query['response.rating'] = filter.rating;
  return query;
}
@Injectable()
export class MongoSurveyRepository extends SurveyRepository {
  constructor(@InjectModel(SurveyRecord.name) private readonly model: Model<SurveyRecord>) {
    super();
  }
  async insertOnce(invitation: SurveyInvitation): Promise<{ created: boolean; invitation: SurveyInvitation }> {
    try {
      const record = await this.model.create(invitation);
      return { created: true, invitation: toDomain(record.toObject() as Lean) };
    } catch (error) {
      if (typeof error !== 'object' || error === null || (error as { code?: unknown }).code !== 11000) throw error;
      const existing = await this.model.findOne({ businessId: invitation.businessId, ticketId: invitation.ticketId }).lean<Lean>();
      if (!existing) throw error;
      return { created: false, invitation: toDomain(existing) };
    }
  }
  async recordDelivery(id: string, update: { email?: DeliveryState; whatsapp?: DeliveryState }): Promise<void> {
    const set: Record<string, unknown> = {};
    if (update.email) set['delivery.email'] = update.email;
    if (update.whatsapp) set['delivery.whatsapp'] = update.whatsapp;
    if (Object.keys(set).length > 0) await this.model.updateOne({ id }, { $set: set });
  }
  async findByTokenHash(hash: string): Promise<SurveyInvitation | null> {
    const record = await this.model.findOne({ tokenHash: hash }).lean<Lean>();
    return record ? toDomain(record) : null;
  }
  async answer(hash: string, response: SurveyResponse, now: Date): Promise<AnswerResult> {
    const record = await this.model.findOneAndUpdate({ tokenHash: hash, response: null, expiresAt: { $gt: now } }, { $set: { response } }, { returnDocument: 'after' }).lean<Lean>();
    if (record) return { kind: 'answered', invitation: toDomain(record) };
    return { kind: 'unavailable', invitation: await this.findByTokenHash(hash) };
  }
  async inRange(businessId: string, filter: SurveyFilter, from: Date, to: Date, limit: number): Promise<SurveyInvitation[]> {
    const records = await this.model.find({ ...filterOf(businessId, filter), createdAt: { $gte: from, $lt: to } }).sort({ createdAt: 1 }).limit(limit).lean<Lean[]>();
    return records.map(toDomain);
  }
  async listResponses(businessId: string, filter: SurveyFilter, page: { page: number; pageSize: number }): Promise<{ items: SurveyInvitation[]; total: number }> {
    const query: QueryFilter<SurveyRecord> = { ...filterOf(businessId, filter), response: { $ne: null } };
    if (filter.from || filter.to) query['response.answeredAt'] = { ...(filter.from ? { $gte: filter.from } : {}), ...(filter.to ? { $lt: filter.to } : {}) };
    const [records, total] = await Promise.all([
      this.model.find(query).sort({ 'response.answeredAt': -1 }).skip((page.page - 1) * page.pageSize).limit(page.pageSize).lean<Lean[]>(),
      this.model.countDocuments(query),
    ]);
    return { items: records.map(toDomain), total };
  }
}
