import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DuplicateSuperAdminError, type DuplicateField } from '../domain/errors';
import type { NewSuperAdmin, SuperAdmin } from '../domain/super-admin';
import { SuperAdminRepository } from '../domain/super-admin.repository';
import { SuperAdminRecord, type SuperAdminRecordDocument } from './super-admin.schema';

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === 'object' && error !== null && (error as MongoDuplicateKeyError).code === 11000;
}

/** Which field caused the duplicate. The document index is compound (type + number). */
function duplicateField(keyPattern: Record<string, unknown> = {}): DuplicateField {
  if ('identityDocument' in keyPattern) return 'identity document';
  if ('username' in keyPattern) return 'username';
  if ('email' in keyPattern) return 'email';
  return 'value';
}

function toDomain(record: SuperAdminRecordDocument): SuperAdmin {
  return {
    id: record.id,
    username: record.username,
    email: record.email,
    passwordHash: record.passwordHash,
    identityDocumentType: record.identityDocumentType,
    identityDocument: record.identityDocument,
    termsAcceptedAt: record.termsAcceptedAt,
  };
}

@Injectable()
export class MongoSuperAdminRepository extends SuperAdminRepository {
  constructor(@InjectModel(SuperAdminRecord.name) private readonly model: Model<SuperAdminRecord>) {
    super();
  }

  async create(data: NewSuperAdmin): Promise<SuperAdmin> {
    try {
      return toDomain(await this.model.create(data));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateSuperAdminError(duplicateField(error.keyPattern));
      }
      throw error;
    }
  }

  async findById(id: string): Promise<SuperAdmin | null> {
    const record = await this.model.findById(id).exec();
    return record ? toDomain(record) : null;
  }

  async findByIdentifier(identifier: string): Promise<SuperAdmin | null> {
    const filter = identifier.includes('@') ? { email: identifier } : { username: identifier };
    const record = await this.model.findOne(filter).exec();
    return record ? toDomain(record) : null;
  }
}
