import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { QueryFilter as FilterQuery, Model } from 'mongoose';
import { OPEN_TICKET_STATUSES, type TicketStatus } from '../domain/catalog';
import type { FieldType } from '../domain/catalog';
import type { Ticket, TicketActor, TicketEventType } from '../domain/ticket';
import {
  TicketRepository,
  type ActivityEntry,
  type CallResult,
  type FinishKind,
  type InsertResult,
  type OpenCount,
  type TicketFilter,
  type TicketOrder,
  type TicketPage,
} from '../domain/ticket.repository';
import { TicketCounterRecord, TicketRecord } from './ticket.schema';
type Lean = TicketRecord & { _id: unknown };
function duplicateOf(error: unknown): { keyPattern: Record<string, unknown> } | null {
  if (typeof error !== 'object' || error === null || (error as { code?: unknown }).code !== 11000) return null;
  return { keyPattern: ((error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {}) as Record<string, unknown> };
}
const actor = (record: { operatorId: string; name: string }): TicketActor => ({ operatorId: record.operatorId, name: record.name });
function toDomain(record: Lean): Ticket {
  return {
    id: record.id,
    businessId: record.businessId,
    queueId: record.queueId,
    queueName: record.queueName,
    dayKey: record.dayKey,
    prefix: record.prefix ?? '',
    number: record.number,
    code: record.code,
    seq: record.seq,
    status: record.status as TicketStatus,
    customer: { name: record.customer?.name ?? null, phone: record.customer?.phone ?? null, email: record.customer?.email ?? null },
    answers: (record.answers ?? []).map((answer) => ({ fieldId: answer.fieldId, label: answer.label, type: answer.type as FieldType, value: answer.value })),
    note: record.note ?? null,
    createdAt: record.createdAt,
    createdBy: actor(record.createdBy),
    attendedBy: record.attendedBy ? actor(record.attendedBy) : null,
    calledAt: record.calledAt ?? null,
    finishedAt: record.finishedAt ?? null,
    cancelReason: record.cancelReason ?? null,
    events: (record.events ?? []).map((event) => ({
      type: event.type as TicketEventType,
      at: event.at,
      by: actor(event.by),
      ...(event.automatic ? { automatic: true } : {}),
    })),
    clientRequestId: record.clientRequestId ?? null,
  };
}
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const queueScope = (queueIds: readonly string[] | null): FilterQuery<TicketRecord> => (queueIds === null ? {} : { queueId: { $in: [...queueIds] } });
function filterOf(businessId: string, filter: TicketFilter): FilterQuery<TicketRecord> {
  const query: FilterQuery<TicketRecord> = { businessId, ...queueScope(filter.queueIds) };
  if (filter.queueId) {
    // The queue asked must also be one the caller may see.
    query.queueId = filter.queueIds === null || filter.queueIds.includes(filter.queueId) ? filter.queueId : { $in: [] };
  }
  if (filter.statuses && filter.statuses.length > 0) query.status = { $in: [...filter.statuses] };
  if (filter.from || filter.to) query.createdAt = { ...(filter.from ? { $gte: filter.from } : {}), ...(filter.to ? { $lt: filter.to } : {}) };
  if (filter.attendedBy) query['attendedBy.operatorId'] = filter.attendedBy;
  const search = filter.search?.trim();
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ code: pattern }, { 'customer.name': pattern }, { 'customer.phone': pattern }, { 'customer.email': pattern }];
  }
  return query;
}
@Injectable()
export class MongoTicketRepository extends TicketRepository {
  constructor(
    @InjectModel(TicketRecord.name) private readonly model: Model<TicketRecord>,
    @InjectModel(TicketCounterRecord.name) private readonly counters: Model<TicketCounterRecord>,
  ) {
    super();
  }
  async nextNumber(businessId: string, scope: string, prefix: string): Promise<{ number: number; seq: number }> {
    const key = prefix === '' ? '_' : prefix;
    // The first two requests of a scope can both try to create its counter: the loser of the race just increases the one that now exists.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const counter = await this.counters
          .findOneAndUpdate({ _id: `${businessId}:${scope}` }, { $inc: { seq: 1, [`n.${key}`]: 1 } }, { upsert: true, returnDocument: 'after' })
          .lean<{ seq: number; n: Record<string, number> }>();
        if (counter) return { number: counter.n[key], seq: counter.seq };
      } catch (error) {
        if (!duplicateOf(error)) throw error;
      }
    }
    throw new Error('The numbering counter could not be increased');
  }
  async insert(ticket: Ticket): Promise<InsertResult> {
    try {
      const record = await this.model.create({ ...ticket, lastEventAt: ticket.createdAt });
      return { kind: 'inserted', ticket: toDomain(record.toObject() as Lean) };
    } catch (error) {
      const duplicate = duplicateOf(error);
      if (!duplicate) throw error;
      if ('clientRequestId' in duplicate.keyPattern && ticket.clientRequestId) {
        const existing = await this.model.findOne({ businessId: ticket.businessId, clientRequestId: ticket.clientRequestId }).lean<Lean>();
        if (existing) return { kind: 'duplicate-request', ticket: toDomain(existing) };
      }
      return { kind: 'duplicate-code' };
    }
  }
  async findById(businessId: string, ticketId: string): Promise<Ticket | null> {
    const record = await this.model.findOne({ businessId, id: ticketId }).lean<Lean>();
    return record ? toDomain(record) : null;
  }
  async findByRequestId(businessId: string, clientRequestId: string): Promise<Ticket | null> {
    const record = await this.model.findOne({ businessId, clientRequestId }).lean<Lean>();
    return record ? toDomain(record) : null;
  }
  async list(businessId: string, filter: TicketFilter, order: TicketOrder, page: { page: number; pageSize: number }): Promise<TicketPage> {
    const query = filterOf(businessId, filter);
    const sort: Record<string, 1 | -1> = order === 'arrival' ? { createdAt: 1, seq: 1 } : { createdAt: -1, seq: -1 };
    const [records, total] = await Promise.all([
      this.model.find(query).sort(sort).skip((page.page - 1) * page.pageSize).limit(page.pageSize).lean<Lean[]>(),
      this.model.countDocuments(query),
    ]);
    return { items: records.map(toDomain), total };
  }
  async findForReport(businessId: string, filter: TicketFilter, limit: number): Promise<Ticket[]> {
    const records = await this.model.find(filterOf(businessId, filter)).sort({ createdAt: 1, seq: 1 }).limit(limit).lean<Lean[]>();
    return records.map(toDomain);
  }
  async head(businessId: string, queueId: string): Promise<Ticket | null> {
    const record = await this.model.findOne({ businessId, queueId, status: 'waiting' }).sort({ createdAt: 1, seq: 1 }).lean<Lean>();
    return record ? toDomain(record) : null;
  }
  async call(businessId: string, ticketId: string, operator: TicketActor, queueIds: readonly string[] | null, at: Date, automatic: boolean): Promise<CallResult> {
    return this.callWhere({ businessId, id: ticketId, status: 'waiting', ...queueScope(queueIds) }, undefined, operator, at, automatic, 'not-waiting');
  }
  async callNext(businessId: string, queueId: string, operator: TicketActor, at: Date, automatic: boolean): Promise<CallResult> {
    return this.callWhere({ businessId, queueId, status: 'waiting' }, { createdAt: 1, seq: 1 }, operator, at, automatic, 'empty');
  }
  private async callWhere(
    where: FilterQuery<TicketRecord>,
    sort: Record<string, 1> | undefined,
    operator: TicketActor,
    at: Date,
    automatic: boolean,
    missing: 'not-waiting' | 'empty',
  ): Promise<CallResult> {
    try {
      const record = await this.model
        .findOneAndUpdate(
          where,
          {
            $set: { status: 'attending', attendedBy: operator, calledAt: at, lastEventAt: at },
            $push: { events: { type: 'called', at, by: operator, automatic } },
          },
          { returnDocument: 'after', ...(sort ? { sort } : {}) },
        )
        .lean<Lean>();
      return record ? { kind: 'called', ticket: toDomain(record) } : { kind: missing };
    } catch (error) {
      // The unique index of "one turn in attention per operator" refused the write.
      if (duplicateOf(error)) return { kind: 'operator-busy' };
      throw error;
    }
  }
  async finish(businessId: string, ticketId: string, kind: FinishKind, by: TicketActor, queueIds: readonly string[] | null, at: Date, reason: string | null): Promise<Ticket | null> {
    const mine = { status: 'attending', 'attendedBy.operatorId': by.operatorId } as const;
    const where: FilterQuery<TicketRecord> = {
      businessId,
      id: ticketId,
      ...queueScope(queueIds),
      ...(kind === 'cancelled' ? { $or: [{ status: 'waiting' }, mine] } : mine),
    };
    const record = await this.model
      .findOneAndUpdate(
        where,
        {
          $set: { status: kind, finishedAt: at, lastEventAt: at, ...(kind === 'cancelled' ? { cancelReason: reason } : {}) },
          $push: { events: { type: kind, at, by, automatic: false } },
        },
        { returnDocument: 'after' },
      )
      .lean<Lean>();
    return record ? toDomain(record) : null;
  }
  async releaseOf(businessId: string, operatorId: string, at: Date): Promise<Ticket | null> {
    const record = await this.model
      .findOneAndUpdate(
        { businessId, status: 'attending', 'attendedBy.operatorId': operatorId },
        {
          $set: { status: 'waiting', attendedBy: null, calledAt: null, lastEventAt: at },
          $push: { events: { type: 'released', at, by: { operatorId, name: '' }, automatic: true } },
        },
        { returnDocument: 'after' },
      )
      .lean<Lean>();
    return record ? toDomain(record) : null;
  }
  countOpen(businessId: string, queueId: string): Promise<number> {
    return this.model.countDocuments({ businessId, queueId, status: { $in: [...OPEN_TICKET_STATUSES] } });
  }
  async openCounts(businessId: string, queueIds: readonly string[] | null): Promise<Map<string, OpenCount>> {
    const rows = await this.model.aggregate<{ _id: { queueId: string; status: string }; count: number; oldest: Date }>([
      { $match: { businessId, status: { $in: [...OPEN_TICKET_STATUSES] }, ...queueScope(queueIds) } },
      { $group: { _id: { queueId: '$queueId', status: '$status' }, count: { $sum: 1 }, oldest: { $min: '$createdAt' } } },
    ]);
    const counts = new Map<string, OpenCount>();
    for (const row of rows) {
      const entry = counts.get(row._id.queueId) ?? { waiting: 0, attending: 0, oldestWaitingAt: null };
      if (row._id.status === 'waiting') {
        entry.waiting = row.count;
        entry.oldestWaitingAt = row.oldest;
      } else {
        entry.attending = row.count;
      }
      counts.set(row._id.queueId, entry);
    }
    return counts;
  }
  async waitingArrivals(businessId: string, queueIds: readonly string[] | null): Promise<Array<{ queueId: string; createdAt: Date }>> {
    const records = await this.model.find({ businessId, status: 'waiting', ...queueScope(queueIds) }, { queueId: 1, createdAt: 1, _id: 0 }).lean<Array<{ queueId: string; createdAt: Date }>>();
    return records.map((record) => ({ queueId: record.queueId, createdAt: record.createdAt }));
  }
  async attendingNow(businessId: string, queueIds: readonly string[] | null): Promise<Ticket[]> {
    const records = await this.model.find({ businessId, status: 'attending', ...queueScope(queueIds) }).sort({ calledAt: 1 }).lean<Lean[]>();
    return records.map(toDomain);
  }
  async attendingOf(businessId: string, operatorId: string): Promise<Ticket | null> {
    const record = await this.model.findOne({ businessId, status: 'attending', 'attendedBy.operatorId': operatorId }).lean<Lean>();
    return record ? toDomain(record) : null;
  }
  async inRange(businessId: string, queueIds: readonly string[] | null, from: Date, to: Date, limit: number): Promise<Ticket[]> {
    const records = await this.model
      .find({ businessId, ...queueScope(queueIds), createdAt: { $gte: from, $lt: to } })
      .sort({ createdAt: 1, seq: 1 })
      .limit(limit)
      .lean<Lean[]>();
    return records.map(toDomain);
  }
  async recentActivity(businessId: string, queueIds: readonly string[] | null, limit: number): Promise<ActivityEntry[]> {
    // The `limit` latest events belong to at most `limit` turns, and those are the ones with the latest `lastEventAt`.
    const records = await this.model.find({ businessId, ...queueScope(queueIds) }).sort({ lastEventAt: -1 }).limit(limit).lean<Lean[]>();
    return records
      .map(toDomain)
      .flatMap((ticket) =>
        ticket.events.map((event) => ({
          type: event.type,
          at: event.at,
          by: event.by,
          automatic: event.automatic === true,
          ticketId: ticket.id,
          code: ticket.code,
          queueId: ticket.queueId,
          queueName: ticket.queueName,
        })),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }
  async lastCalled(businessId: string, queueIds: readonly string[] | null, limit: number): Promise<Ticket[]> {
    const records = await this.model.find({ businessId, ...queueScope(queueIds), calledAt: { $ne: null } }).sort({ calledAt: -1 }).limit(limit).lean<Lean[]>();
    return records.map(toDomain);
  }
}
