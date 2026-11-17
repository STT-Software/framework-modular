import type { ProfileSource } from './profile-sources';

/**
 * What a user tells us right after the first login. One profile per user.
 *
 * Rules: the phone (canonical E.164 of a mobile number) is unique across users, and the profile is complete once the
 * second step (`sources`) has been saved, which requires the phone to be saved first. The second step may be skipped:
 * saving an empty list completes the profile too.
 */
export interface OnboardingProfile {
  /** Id of the user who owns the profile (the identity that comes from the session). */
  userId: string;
  phone: string;
  /** Empty until the second step is saved, and also when the person skipped it. At most one since that step became single choice. */
  sources: ProfileSource[];
  /** Free text the person wrote for "other". Null unless `sources` includes "other". */
  sourceOther: string | null;
  /** When the user finished both steps. Null while the profile is incomplete. */
  completedAt: Date | null;
}
