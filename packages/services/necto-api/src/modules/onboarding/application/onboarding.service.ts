import { Injectable } from '@nestjs/common';
import { PhoneRequiredError } from '../domain/errors';
import type { OnboardingProfile } from '../domain/onboarding-profile';
import { OnboardingProfileRepository } from '../domain/onboarding-profile.repository';
import type { ProfileSource } from '../domain/profile-sources';

/** What the API returns about a profile. The phone is only ever shown to its owner. */
export interface ProfileView {
  phone: string | null;
  sources: ProfileSource[];
  completed: boolean;
}

/** The two onboarding steps (phone, then where the user met Necto) and reading the result. */
@Injectable()
export class OnboardingService {
  constructor(private readonly profiles: OnboardingProfileRepository) {}

  /** The profile of a user. If there is none yet, an empty one (not an error). */
  async get(userId: string): Promise<ProfileView> {
    return this.toView(await this.profiles.findByUserId(userId));
  }

  /** Step 1: saves the phone. Another user already using it is a conflict. */
  async savePhone(userId: string, phone: string): Promise<ProfileView> {
    return this.toView(await this.profiles.savePhone(userId, phone));
  }

  /** Step 2: saves where the user met Necto and marks the profile as completed. Requires step 1. */
  async saveSources(userId: string, sources: ProfileSource[]): Promise<ProfileView> {
    const current = await this.profiles.findByUserId(userId);
    if (!current) {
      throw new PhoneRequiredError();
    }
    // Saving again replaces the list but keeps the date the profile was first completed.
    const saved = await this.profiles.saveSources(userId, sources, current.completedAt ?? new Date());
    if (!saved) {
      throw new PhoneRequiredError();
    }
    return this.toView(saved);
  }

  private toView(profile: OnboardingProfile | null): ProfileView {
    return {
      phone: profile?.phone ?? null,
      sources: profile?.sources ?? [],
      completed: Boolean(profile?.completedAt),
    };
  }
}
