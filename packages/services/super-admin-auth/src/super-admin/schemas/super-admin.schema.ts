import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** CC: cédula de ciudadanía, CE: cédula de extranjería, PA: pasaporte, NIT: número de identificación tributaria. */
export const IDENTITY_DOCUMENT_TYPES = ['CC', 'CE', 'PA', 'NIT'] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

/**
 * SuperAdmin: the account that manages the whole platform. It is independent from
 * a business admin (which will have its own login and its own collection).
 *
 * The unique indexes make MongoDB reject duplicates even when two registrations
 * arrive at the same time (it does not rely on a previous query).
 */
@Schema({ timestamps: true, collection: 'super_admins' })
export class SuperAdmin {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  /** bcrypt hash of the password. The password is never stored or returned in plain text. */
  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: IDENTITY_DOCUMENT_TYPES })
  identityDocumentType: IdentityDocumentType;

  /** Document number. It is only unique together with its type (see the index below). */
  @Prop({ required: true, trim: true })
  identityDocument: string;

  /** When the user accepted the terms and conditions while registering. */
  @Prop({ required: true })
  termsAcceptedAt: Date;
}

export type SuperAdminDocument = HydratedDocument<SuperAdmin>;
export const SuperAdminSchema = SchemaFactory.createForClass(SuperAdmin);

// The same number can exist under two different types (a CC and a passport can match).
SuperAdminSchema.index({ identityDocumentType: 1, identityDocument: 1 }, { unique: true });
