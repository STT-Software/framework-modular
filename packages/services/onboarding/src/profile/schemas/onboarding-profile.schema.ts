import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PROFILE_SOURCES, type ProfileSource } from '../profile-sources';

/**
 * OnboardingProfile: what a super admin tells us right after the first login.
 * One document per user.
 *
 * The unique indexes make MongoDB reject duplicates even when two requests arrive
 * at the same time (it does not rely on a previous query).
 */
@Schema({ timestamps: true, collection: 'onboarding_profiles' })
export class OnboardingProfile {
  /** Id of the super admin: the "sub" claim of the token issued by super-admin-auth. */
  @Prop({ required: true, unique: true })
  userId: string;

  /** Phone in E.164 format (+573001234567). Unique: two users cannot share a number. */
  @Prop({ required: true, unique: true })
  phone: string;

  /** Where the user met Necto. Empty until the second step is saved. */
  @Prop({ type: [String], enum: PROFILE_SOURCES, default: [] })
  sources: ProfileSource[];

  /** When the user finished both steps. Null while the profile is incomplete. */
  @Prop({ type: Date, default: null })
  completedAt: Date | null;
}

export type OnboardingProfileDocument = HydratedDocument<OnboardingProfile>;
export const OnboardingProfileSchema = SchemaFactory.createForClass(OnboardingProfile);
