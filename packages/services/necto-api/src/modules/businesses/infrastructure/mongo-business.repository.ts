import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';
import type { Business, BusinessStatus } from '../domain/business';
import {
  BusinessRepository,
  type BusinessChange,
  type IdempotencyMark,
  type ListQuery,
  type NewBusiness,
} from '../domain/business.repository';
import { IdempotencyKeyReusedError } from '../domain/errors';
import { BusinessRecord } from './business.schema';

type Lean = BusinessRecord & { _id: unknown };

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

/** A malformed id is simply "not found", never a database error. */
const OBJECT_ID = /^[a-f0-9]{24}$/;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toDomain(record: Lean): Business {
  return {
    id: String(record._id),
    ownerId: record.ownerId,
    name: record.name,
    legalName: record.legalName,
    taxId: record.taxId,
    phone: record.phone,
    address: record.address,
    supportEmail: record.supportEmail,
    website: record.website,
    category: record.category,
    categoryOther: record.categoryOther,
    currency: record.currency,
    timezone: record.timezone,
    modules: record.modules,
    status: record.status,
    boss: {
      assignmentId: record.boss.assignmentId,
      name: record.boss.name,
      email: record.boss.email,
      assignedAt: record.boss.assignedAt,
    },
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class MongoBusinessRepository extends BusinessRepository {
  constructor(@InjectModel(BusinessRecord.name) private readonly model: Model<BusinessRecord>) {
    super();
  }

  async insert(business: NewBusiness, mark: IdempotencyMark): Promise<{ business: Business; created: boolean }> {
    try {
      const record = await this.model.create({
        ownerId: business.ownerId,
        ...business.profile,
        status: 'active',
        boss: business.boss,
        bossHistory: [],
        version: 1,
        idempotencyKey: mark.key,
        fingerprint: mark.fingerprint,
      });
      return { business: toDomain(record.toObject() as Lean), created: true };
    } catch (error) {
      if (!isDuplicateKeyError(error) || !error.keyPattern || !('idempotencyKey' in error.keyPattern)) throw error;
      // The same owner already created a business with this key (a double click, or a retry): return it.
      const existing = await this.model.findOne({ ownerId: business.ownerId, idempotencyKey: mark.key }).lean<Lean>();
      if (!existing) throw error;
      if (existing.fingerprint !== mark.fingerprint) throw new IdempotencyKeyReusedError();
      return { business: toDomain(existing), created: false };
    }
  }

  async findOwned(ownerId: string, id: string): Promise<Business | null> {
    if (!OBJECT_ID.test(id)) return null;
    const record = await this.model.findOne({ _id: id, ownerId }).lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async findById(id: string): Promise<Business | null> {
    if (!OBJECT_ID.test(id)) return null;
    const record = await this.model.findById(id).lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async list(ownerId: string, query: ListQuery): Promise<{ items: Business[]; total: number }> {
    const filter: QueryFilter<BusinessRecord> = { ownerId };
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    const text = query.q?.trim();
    if (text) {
      const pattern = new RegExp(escapeRegex(text), 'i');
      filter.$or = [{ name: pattern }, { 'boss.name': pattern }, { 'boss.email': pattern }, { address: pattern }];
    }
    const [records, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean<Lean[]>(),
      this.model.countDocuments(filter),
    ]);
    return { items: records.map(toDomain), total };
  }

  async updateOwned(ownerId: string, id: string, expectedVersion: number, change: BusinessChange): Promise<Business | null> {
    if (!OBJECT_ID.test(id)) return null;
    const update: Record<string, unknown> = {
      $set: { ...change.profile, boss: change.boss },
      $inc: { version: 1 },
    };
    if (change.revokedBoss) update.$push = { bossHistory: change.revokedBoss };
    const record = await this.model
      .findOneAndUpdate({ _id: id, ownerId, version: expectedVersion }, update, { returnDocument: 'after' })
      .lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async setStatus(ownerId: string, id: string, status: BusinessStatus): Promise<Business | null> {
    if (!OBJECT_ID.test(id)) return null;
    const record = await this.model
      .findOneAndUpdate({ _id: id, ownerId }, { $set: { status }, $inc: { version: 1 } }, { returnDocument: 'after' })
      .lean<Lean>();
    return record ? toDomain(record) : null;
  }
}
