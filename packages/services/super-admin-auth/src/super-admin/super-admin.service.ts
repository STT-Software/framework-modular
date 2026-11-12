import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SuperAdmin, SuperAdminDocument } from './schemas/super-admin.schema';

export interface CreateSuperAdminData {
  username: string;
  email: string;
  passwordHash: string;
  identityDocument: string;
}

const DUPLICATE_FIELD_LABELS: Record<string, string> = {
  username: 'username',
  email: 'email',
  identityDocument: 'identity document',
};

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === 'object' && error !== null && (error as MongoDuplicateKeyError).code === 11000;
}

@Injectable()
export class SuperAdminService {
  constructor(@InjectModel(SuperAdmin.name) private readonly model: Model<SuperAdminDocument>) {}

  async create(data: CreateSuperAdminData): Promise<SuperAdminDocument> {
    try {
      return await this.model.create(data);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const field = Object.keys(error.keyPattern ?? {})[0];
        throw new ConflictException(
          `A super admin with that ${DUPLICATE_FIELD_LABELS[field] ?? 'value'} already exists`,
        );
      }
      throw error;
    }
  }

  findById(id: string): Promise<SuperAdminDocument | null> {
    return this.model.findById(id).exec();
  }

  /**
   * Finds by email or by username. The username cannot contain "@" (validated on
   * registration), so an identifier containing "@" is always an email.
   * The identifier must already be normalized (trimmed and lowercase).
   */
  findByIdentifier(identifier: string): Promise<SuperAdminDocument | null> {
    const filter = identifier.includes('@') ? { email: identifier } : { username: identifier };
    return this.model.findOne(filter).exec();
  }
}
