import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { AccessChallenge, Delivery, NewChallenge } from '../domain/challenge';
import { ChallengeRepository } from '../domain/challenge.repository';
import { AccessChallengeRecord } from './access-challenge.schema';

function toDomain(record: AccessChallengeRecord): AccessChallenge {
  return {
    id: record._id,
    businessId: record.businessId,
    assignmentId: record.assignmentId,
    email: record.email,
    purpose: record.purpose,
    codeHmac: record.codeHmac,
    expiresAt: record.expiresAt,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    status: record.status,
    createdAt: record.createdAt,
    consumedAt: record.consumedAt,
    delivery: {
      status: record.delivery.status,
      attemptedAt: record.delivery.attemptedAt,
      acceptedAt: record.delivery.acceptedAt,
      failedAt: record.delivery.failedAt,
      failureCode: record.delivery.failureCode,
    },
  };
}

@Injectable()
export class MongoAccessChallengeRepository extends ChallengeRepository {
  constructor(@InjectModel(AccessChallengeRecord.name) private readonly model: Model<AccessChallengeRecord>) {
    super();
  }

  async create(challenge: NewChallenge): Promise<void> {
    await this.model.create({ _id: challenge.id, ...challenge, attempts: 0, status: 'pending', consumedAt: null });
  }

  async supersedePending(businessId: string, email: string, exceptId: string): Promise<void> {
    await this.model.updateMany({ businessId, email, status: 'pending', _id: { $ne: exceptId } }, { $set: { status: 'superseded' } });
  }

  async revokePendingExcept(businessId: string, keepAssignmentId: string): Promise<void> {
    await this.model.updateMany(
      { businessId, status: 'pending', assignmentId: { $ne: keepAssignmentId } },
      { $set: { status: 'revoked' } },
    );
  }

  async reserveAttempt(query: { businessId: string; email: string; assignmentId: string; now: Date }): Promise<AccessChallenge | null> {
    // One conditional write: it only matches a usable code, and it counts the try in the same step.
    const record = await this.model
      .findOneAndUpdate(
        {
          businessId: query.businessId,
          email: query.email,
          assignmentId: query.assignmentId,
          status: 'pending',
          expiresAt: { $gt: query.now },
          $expr: { $lt: ['$attempts', '$maxAttempts'] },
        },
        { $inc: { attempts: 1 } },
        { sort: { createdAt: -1 }, returnDocument: 'after' },
      )
      .lean<AccessChallengeRecord>();
    return record ? toDomain(record) : null;
  }

  async lock(id: string): Promise<void> {
    await this.model.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'locked' } });
  }

  async consume(id: string, now: Date): Promise<boolean> {
    // Only one caller can change a code from pending to consumed; the others get a count of 0.
    const result = await this.model.updateOne(
      { _id: id, status: 'pending', expiresAt: { $gt: now } },
      { $set: { status: 'consumed', consumedAt: now } },
    );
    return result.modifiedCount === 1;
  }

  async latestCreatedAt(businessId: string, email: string): Promise<Date | null> {
    const record = await this.model.findOne({ businessId, email }).sort({ createdAt: -1 }).select({ createdAt: 1 }).lean<{ createdAt: Date }>();
    return record?.createdAt ?? null;
  }

  async latestInvitation(businessId: string): Promise<AccessChallenge | null> {
    const record = await this.model.findOne({ businessId, purpose: 'invitation' }).sort({ createdAt: -1 }).lean<AccessChallengeRecord>();
    return record ? toDomain(record) : null;
  }

  async recordDelivery(id: string, delivery: Delivery): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { delivery } });
  }
}
