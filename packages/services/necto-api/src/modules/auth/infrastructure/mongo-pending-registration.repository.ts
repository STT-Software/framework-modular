import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { PendingRegistration } from '../domain/pending-registration';
import { PendingRegistrationRepository } from '../domain/pending-registration.repository';
import { PendingRegistrationRecord, type PendingRegistrationRecordDocument } from './pending-registration.schema';

function toDomain(record: PendingRegistrationRecordDocument): PendingRegistration {
  return {
    id: record.id,
    username: record.username,
    email: record.email,
    passwordHash: record.passwordHash,
    identityDocumentType: record.identityDocumentType,
    identityDocument: record.identityDocument,
    termsAcceptedAt: record.termsAcceptedAt,
    codeHmac: record.codeHmac,
    attempts: record.attempts,
    expiresAt: record.expiresAt,
    resendAvailableAt: record.resendAvailableAt,
    sends: record.sends,
    windowStartedAt: record.windowStartedAt,
    purgeAt: record.purgeAt,
  };
}

@Injectable()
export class MongoPendingRegistrationRepository extends PendingRegistrationRepository {
  constructor(@InjectModel(PendingRegistrationRecord.name) private readonly model: Model<PendingRegistrationRecord>) {
    super();
  }

  newId(): string {
    return new Types.ObjectId().toHexString();
  }

  async replace(pending: PendingRegistration): Promise<void> {
    const { id, ...data } = pending;
    await this.model.deleteMany({ $or: [{ email: data.email }, { username: data.username }] }).exec();
    await this.model.create({ _id: new Types.ObjectId(id), ...data });
  }

  async findById(id: string): Promise<PendingRegistration | null> {
    if (!isValidObjectId(id)) return null;
    const record = await this.model.findById(id).exec();
    return record ? toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<PendingRegistration | null> {
    const record = await this.model.findOne({ email }).exec();
    return record ? toDomain(record) : null;
  }

  async reserveAttempt(id: string, maxAttempts: number): Promise<number | null> {
    if (!isValidObjectId(id)) return null;
    const record = await this.model
      .findOneAndUpdate({ _id: id, attempts: { $lt: maxAttempts } }, { $inc: { attempts: 1 } }, { returnDocument: 'after' })
      .exec();
    return record ? record.attempts : null;
  }

  async renewCode(
    id: string,
    change: Pick<PendingRegistration, 'codeHmac' | 'expiresAt' | 'resendAvailableAt' | 'purgeAt'>,
  ): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { ...change, attempts: 0 }, $inc: { sends: 1 } }).exec();
  }

  async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.model.deleteOne({ _id: id }).exec();
  }
}
