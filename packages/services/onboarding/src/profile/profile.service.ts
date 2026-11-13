import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ProfileSource } from './profile-sources';
import { OnboardingProfile } from './schemas/onboarding-profile.schema';

/** What the API returns about a profile. The phone is only ever shown to its owner. */
export interface ProfileView {
  phone: string | null;
  sources: ProfileSource[];
  completed: boolean;
}

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(OnboardingProfile.name) private readonly profiles: Model<OnboardingProfile>,
  ) {}

  /** The profile of a user. If there is none yet, an empty one (not an error). */
  async get(userId: string): Promise<ProfileView> {
    const profile = await this.profiles.findOne({ userId }).lean();
    return this.toView(profile);
  }

  /** Step 1: saves the phone. Another user already using it answers 409. */
  async savePhone(userId: string, phone: string): Promise<ProfileView> {
    // Two first saves of the same user can arrive together: both try to create the
    // document and one fails on the userId index. The retry then updates it.
    for (let attempt = 0; ; attempt++) {
      try {
        const profile = await this.profiles
          .findOneAndUpdate(
            { userId },
            { $set: { phone }, $setOnInsert: { sources: [], completedAt: null } },
            { upsert: true, returnDocument: 'after' },
          )
          .lean();
        return this.toView(profile);
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        if (error.keyPattern && 'phone' in error.keyPattern) {
          throw new ConflictException('Phone number already in use');
        }
        if (attempt >= 1) throw error;
      }
    }
  }

  /** Step 2: saves where the user met Necto and marks the profile as completed. */
  async saveSources(userId: string, sources: ProfileSource[]): Promise<ProfileView> {
    const current = await this.profiles.findOne({ userId }).lean();
    if (!current) {
      throw new ConflictException('Save the phone number first');
    }
    const profile = await this.profiles
      .findOneAndUpdate(
        { userId },
        { $set: { sources, ...(current.completedAt ? {} : { completedAt: new Date() }) } },
        { returnDocument: 'after' },
      )
      .lean();
    return this.toView(profile);
  }

  private toView(profile: Pick<OnboardingProfile, 'phone' | 'sources' | 'completedAt'> | null): ProfileView {
    return {
      phone: profile?.phone ?? null,
      sources: profile?.sources ?? [],
      completed: Boolean(profile?.completedAt),
    };
  }
}
