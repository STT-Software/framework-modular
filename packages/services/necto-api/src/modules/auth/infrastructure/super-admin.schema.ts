import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { IDENTITY_DOCUMENT_TYPES, type IdentityDocumentType } from '../domain/super-admin';

/**
 * MongoDB record of a super admin (collection `super_admins`, owned by the auth module).
 *
 * The unique indexes make MongoDB reject duplicates even when two registrations
 * arrive at the same time (it does not rely on a previous query).
 */
@Schema({ timestamps: true, collection: 'super_admins' })
export class SuperAdminRecord {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: IDENTITY_DOCUMENT_TYPES })
  identityDocumentType: IdentityDocumentType;

  @Prop({ required: true, trim: true })
  identityDocument: string;

  @Prop({ required: true })
  termsAcceptedAt: Date;
}

export type SuperAdminRecordDocument = HydratedDocument<SuperAdminRecord>;
export const SuperAdminSchema = SchemaFactory.createForClass(SuperAdminRecord);

// The same number can exist under two different types (a CC and a passport can match).
SuperAdminSchema.index({ identityDocumentType: 1, identityDocument: 1 }, { unique: true });
