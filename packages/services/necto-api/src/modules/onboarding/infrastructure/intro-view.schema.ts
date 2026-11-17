import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * MongoDB record of "this user already saw the welcome intro" (collection `onboarding_intro_views`, owned by the
 * onboarding module). One document per user.
 *
 * It lives apart from `onboarding_profiles` because a profile always has a phone, and the intro is seen before the
 * user gives one. The unique index keeps it to one document per user even when two requests arrive together.
 */
@Schema({ timestamps: true, collection: 'onboarding_intro_views' })
export class IntroViewRecord {
  @Prop({ required: true, unique: true })
  userId: string;

  /** When the user first saw the intro. Never changes after that. */
  @Prop({ type: Date, required: true })
  seenAt: Date;
}

export const IntroViewSchema = SchemaFactory.createForClass(IntroViewRecord);
