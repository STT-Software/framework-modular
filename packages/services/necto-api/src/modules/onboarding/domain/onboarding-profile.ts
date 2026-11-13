import type { ProfileSource } from './profile-sources';

/**
 * What a user tells us right after the first login. One profile per user.
 *
 * Rules: the phone (E.164) is unique across users, and the profile is complete once the second
 * step (`sources`) has been saved, which requires the phone to be saved first.
 */
export interface OnboardingProfile {
  /** Id of the user who owns the profile (the identity that comes from the session). */
  userId: string;
  phone: string;
  /** Empty until the second step is saved. */
  sources: ProfileSource[];
  /** When the user finished both steps. Null while the profile is incomplete. */
  completedAt: Date | null;
}
