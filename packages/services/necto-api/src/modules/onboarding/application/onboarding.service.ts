import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { PhoneRequiredError } from '../domain/errors';
import type { OnboardingProfile } from '../domain/onboarding-profile';
import { OnboardingProfileRepository } from '../domain/onboarding-profile.repository';
import { normalizePhoneNumber } from '../domain/phone-number';
import { sourceOtherFor, type ProfileSource } from '../domain/profile-sources';

/** What the API returns about a profile. The phone is only ever shown to its owner. */
export interface ProfileView {
  phone: string | null;
  sources: ProfileSource[];
  /** Free text the person wrote for "other". Null unless `sources` is `["other"]` and they wrote something. */
  sourceOther: string | null;
  completed: boolean;
  /**
   * True once the user is past the welcome intro, on any device: they saw its first act, or they already saved a
   * phone (a profile exists), or they completed onboarding. So the intro is only ever shown to new users.
   */
  introSeen: boolean;
}

/** The two onboarding steps (phone, then where the user met Necto) and reading the result. */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly profiles: OnboardingProfileRepository,
    private readonly clock: Clock,
  ) {}

  /** The profile of a user. If there is none yet, an empty one (not an error). */
  async get(userId: string): Promise<ProfileView> {
    return this.toView(userId, await this.profiles.findByUserId(userId));
  }

  /** Records that the user saw the welcome intro (only the first time counts). */
  async markIntroSeen(userId: string): Promise<ProfileView> {
    await this.profiles.markIntroSeen(userId, this.clock.now());
    return this.get(userId);
  }

  /**
   * Step 1: saves the phone in its canonical E.164 form. Another user already using it is a conflict (`phone-in-use`).
   * The DTO already normalizes it; normalizing again here keeps the rule even for callers that skip the HTTP layer.
   */
  async savePhone(userId: string, phone: string): Promise<ProfileView> {
    const canonical = normalizePhoneNumber(phone);
    if (canonical === null) {
      // Unreachable through HTTP (the DTO answers 400 first), so this is a programming error, not a domain rule.
      throw new TypeError('savePhone expects a valid mobile number with its country code');
    }
    return this.toView(userId, await this.profiles.savePhone(userId, canonical));
  }

  /**
   * Step 2: saves where the user met Necto and marks the profile as completed. Requires step 1 (`phone-required`).
   * An empty list is "Skip" and completes the profile too. `sourceOther` is kept only with `["other"]`.
   */
  async saveSources(userId: string, sources: ProfileSource[], sourceOther?: string | null): Promise<ProfileView> {
    const current = await this.profiles.findByUserId(userId);
    if (!current) {
      throw new PhoneRequiredError();
    }
    // Saving again replaces the answer but keeps the date the profile was first completed.
    const saved = await this.profiles.saveSources(
      userId,
      sources,
      sourceOtherFor(sources, sourceOther),
      current.completedAt ?? this.clock.now(),
    );
    if (!saved) {
      throw new PhoneRequiredError();
    }
    return this.toView(userId, saved);
  }

  private async toView(userId: string, profile: OnboardingProfile | null): Promise<ProfileView> {
    return {
      phone: profile?.phone ?? null,
      sources: profile?.sources ?? [],
      sourceOther: profile?.sourceOther ?? null,
      completed: Boolean(profile?.completedAt),
      // A profile (complete or not) means a phone was saved, which only happens after the welcome.
      introSeen: profile !== null || (await this.profiles.findIntroSeenAt(userId)) !== null,
    };
  }
}
