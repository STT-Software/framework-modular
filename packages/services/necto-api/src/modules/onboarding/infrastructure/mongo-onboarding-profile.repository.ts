import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PhoneAlreadyInUseError } from '../domain/errors';
import type { OnboardingProfile } from '../domain/onboarding-profile';
import { OnboardingProfileRepository } from '../domain/onboarding-profile.repository';
import type { ProfileSource } from '../domain/profile-sources';
import { OnboardingProfileRecord } from './onboarding-profile.schema';

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

function toDomain(record: OnboardingProfileRecord): OnboardingProfile {
  return {
    userId: record.userId,
    phone: record.phone,
    sources: record.sources,
    completedAt: record.completedAt,
  };
}

@Injectable()
export class MongoOnboardingProfileRepository extends OnboardingProfileRepository {
  constructor(@InjectModel(OnboardingProfileRecord.name) private readonly model: Model<OnboardingProfileRecord>) {
    super();
  }

  async findByUserId(userId: string): Promise<OnboardingProfile | null> {
    const record = await this.model.findOne({ userId }).lean();
    return record ? toDomain(record) : null;
  }

  async savePhone(userId: string, phone: string): Promise<OnboardingProfile> {
    // Two first saves of the same user can arrive together: both try to create the
    // document and one fails on the userId index. The retry then updates it.
    for (let attempt = 0; ; attempt++) {
      try {
        const record = await this.model
          .findOneAndUpdate(
            { userId },
            { $set: { phone }, $setOnInsert: { sources: [], completedAt: null } },
            { upsert: true, returnDocument: 'after' },
          )
          .lean();
        return toDomain(record!);
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        if (error.keyPattern && 'phone' in error.keyPattern) {
          throw new PhoneAlreadyInUseError();
        }
        if (attempt >= 1) throw error;
      }
    }
  }

  async saveSources(userId: string, sources: ProfileSource[], completedAt: Date): Promise<OnboardingProfile | null> {
    const record = await this.model
      .findOneAndUpdate({ userId }, { $set: { sources, completedAt } }, { returnDocument: 'after' })
      .lean();
    return record ? toDomain(record) : null;
  }
}
