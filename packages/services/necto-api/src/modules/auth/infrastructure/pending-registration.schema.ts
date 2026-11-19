import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { IDENTITY_DOCUMENT_TYPES, type IdentityDocumentType } from '../domain/super-admin';

/**
 * A registration waiting for its emailed code (collection `pending_registrations`, owned by the auth module).
 * MongoDB removes each record on its own once `purgeAt` passes (TTL index): the later of the code expiry and the end
 * of the sending window, so the per-email limit outlives an expired code.
 */
@Schema({ timestamps: true, collection: 'pending_registrations' })
export class PendingRegistrationRecord {
  @Prop({ required: true, index: true })
  username: string;

  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: IDENTITY_DOCUMENT_TYPES })
  identityDocumentType: IdentityDocumentType;

  @Prop({ required: true })
  identityDocument: string;

  @Prop({ required: true })
  termsAcceptedAt: Date;

  @Prop({ required: true })
  codeHmac: string;

  @Prop({ required: true, default: 0 })
  attempts: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true })
  resendAvailableAt: Date;

  @Prop({ required: true, default: 1 })
  sends: number;

  @Prop({ required: true })
  windowStartedAt: Date;

  @Prop({ required: true })
  purgeAt: Date;
}

export type PendingRegistrationRecordDocument = HydratedDocument<PendingRegistrationRecord>;
export const PendingRegistrationSchema = SchemaFactory.createForClass(PendingRegistrationRecord);

PendingRegistrationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
