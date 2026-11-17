import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PROFILE_SOURCES, SOURCE_OTHER_MAX_LENGTH, type ProfileSource } from '../domain/profile-sources';

/**
 * MongoDB record of an onboarding profile (collection `onboarding_profiles`, owned by the onboarding
 * module). One document per user.
 *
 * The unique indexes make MongoDB reject duplicates even when two requests arrive
 * at the same time (it does not rely on a previous query).
 */
@Schema({ timestamps: true, collection: 'onboarding_profiles' })
export class OnboardingProfileRecord {
  @Prop({ required: true, unique: true })
  userId: string;

  /** Canonical E.164 of a mobile number (+573001234567). Unique: two users cannot share a number. */
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ type: [String], enum: PROFILE_SOURCES, default: [] })
  sources: ProfileSource[];

  /** Free text for the "other" source. Documents saved before this field existed do not have it (read as null). */
  @Prop({ type: String, default: null, maxlength: SOURCE_OTHER_MAX_LENGTH })
  sourceOther: string | null;

  @Prop({ type: Date, default: null })
  completedAt: Date | null;
}

export const OnboardingProfileSchema = SchemaFactory.createForClass(OnboardingProfileRecord);
