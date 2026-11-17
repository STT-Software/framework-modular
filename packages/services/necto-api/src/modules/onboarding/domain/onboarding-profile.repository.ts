import type { OnboardingProfile } from './onboarding-profile';
import type { ProfileSource } from './profile-sources';

/** What the onboarding module needs to persist profiles. Implemented in `infrastructure/`. */
export abstract class OnboardingProfileRepository {
  abstract findByUserId(userId: string): Promise<OnboardingProfile | null>;

  /**
   * Creates the profile of the user with that phone, or changes the phone of an existing one.
   * @throws PhoneAlreadyInUseError if another user already has the phone.
   */
  abstract savePhone(userId: string, phone: string): Promise<OnboardingProfile>;

  /** Saves the sources, the "other" text and the completion date. Returns null if the user has no profile yet. */
  abstract saveSources(
    userId: string,
    sources: ProfileSource[],
    sourceOther: string | null,
    completedAt: Date,
  ): Promise<OnboardingProfile | null>;

  /** When the user first saw the welcome intro, or null if they never did. */
  abstract findIntroSeenAt(userId: string): Promise<Date | null>;

  /** Records that the user saw the welcome intro. Idempotent: the first date is kept. */
  abstract markIntroSeen(userId: string, seenAt: Date): Promise<void>;
}
