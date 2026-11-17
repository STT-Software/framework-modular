import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { AdminSession, SessionEndReason } from '../domain/admin-session';
import { SessionRepository } from '../domain/session.repository';
import { AdminSessionRecord } from './admin-session.schema';

function toDomain(record: AdminSessionRecord): AdminSession {
  return {
    id: record._id,
    email: record.email,
    secretHash: record.secretHash,
    remember: record.remember,
    createdAt: record.createdAt,
    verifiedAt: record.verifiedAt,
    lastSeenAt: record.lastSeenAt,
    idleExpiresAt: record.idleExpiresAt,
    absoluteExpiresAt: record.absoluteExpiresAt,
    revokedAt: record.revokedAt ?? null,
    revokedReason: record.revokedReason ?? null,
  };
}

/** The filter of "this session is still active at `now`": not ended, not idle for too long, not past its hard limit. */
function activeAt(now: Date) {
  return { revokedAt: null, idleExpiresAt: { $gt: now }, absoluteExpiresAt: { $gt: now } };
}

@Injectable()
export class MongoSessionRepository extends SessionRepository {
  constructor(@InjectModel(AdminSessionRecord.name) private readonly model: Model<AdminSessionRecord>) {
    super();
  }

  async create(session: AdminSession): Promise<void> {
    await this.model.create({ _id: session.id, ...session });
  }

  async findById(id: string): Promise<AdminSession | null> {
    const record = await this.model.findById(id).lean<AdminSessionRecord>();
    return record ? toDomain(record) : null;
  }

  async renew(id: string, now: Date, idleExpiresAt: Date): Promise<AdminSession | null> {
    // Conditional on the session still being active: an ended session can never be brought back by a late renewal.
    const record = await this.model
      .findOneAndUpdate({ _id: id, ...activeAt(now) }, { $set: { lastSeenAt: now, idleExpiresAt } }, { returnDocument: 'after' })
      .lean<AdminSessionRecord>();
    return record ? toDomain(record) : null;
  }

  async markVerified(id: string, now: Date): Promise<AdminSession | null> {
    const record = await this.model
      .findOneAndUpdate({ _id: id, ...activeAt(now) }, { $set: { verifiedAt: now } }, { returnDocument: 'after' })
      .lean<AdminSessionRecord>();
    return record ? toDomain(record) : null;
  }

  async revoke(id: string, reason: SessionEndReason, now: Date): Promise<boolean> {
    const result = await this.model.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: now, revokedReason: reason } });
    return result.modifiedCount === 1;
  }

  async revokeAllOfEmail(email: string, exceptId: string | null, reason: SessionEndReason, now: Date): Promise<number> {
    const filter = { email, ...activeAt(now), ...(exceptId ? { _id: { $ne: exceptId } } : {}) };
    const result = await this.model.updateMany(filter, { $set: { revokedAt: now, revokedReason: reason } });
    return result.modifiedCount;
  }
}
