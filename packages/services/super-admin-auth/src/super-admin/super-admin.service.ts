import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IdentityDocumentType, SuperAdmin, SuperAdminDocument } from './schemas/super-admin.schema';

export interface CreateSuperAdminData {
  username: string;
  email: string;
  passwordHash: string;
  identityDocumentType: IdentityDocumentType;
  identityDocument: string;
  termsAcceptedAt: Date;
}

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === 'object' && error !== null && (error as MongoDuplicateKeyError).code === 11000;
}

/** Which field caused the duplicate. The document index is compound (type + number). */
function duplicateFieldLabel(keyPattern: Record<string, unknown> = {}): string {
  if ('identityDocument' in keyPattern) return 'identity document';
  if ('username' in keyPattern) return 'username';
  if ('email' in keyPattern) return 'email';
  return 'value';
}

@Injectable()
export class SuperAdminService {
  constructor(@InjectModel(SuperAdmin.name) private readonly model: Model<SuperAdminDocument>) {}

  async create(data: CreateSuperAdminData): Promise<SuperAdminDocument> {
    try {
      return await this.model.create(data);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A super admin with that ${duplicateFieldLabel(error.keyPattern)} already exists`,
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
