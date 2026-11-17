import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { SessionEndReason } from '../domain/admin-session';

/**
 * MongoDB record of an administrator's session (collection `admin_sessions`, owned by the business-access module).
 * It stores the HASH of the cookie secret, never the secret. The TTL index only tidies old records: whether a
 * session is valid is always decided from `idleExpiresAt`, `absoluteExpiresAt` and `revokedAt` on each request.
 */
@Schema({ timestamps: false, collection: 'admin_sessions' })
export class AdminSessionRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  secretHash: string;

  @Prop({ type: Boolean, required: true, default: false })
  remember: boolean;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  verifiedAt: Date;

  @Prop({ type: Date, required: true })
  lastSeenAt: Date;

  @Prop({ type: Date, required: true })
  idleExpiresAt: Date;

  @Prop({ type: Date, required: true })
  absoluteExpiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  @Prop({ type: String, default: null, enum: ['signed-out', 'replaced', 'revoked-by-user', 'no-access', null] })
  revokedReason: SessionEndReason | null;
}

export const AdminSessionSchema = SchemaFactory.createForClass(AdminSessionRecord);

// "Sign out everywhere else": the active sessions of one email.
AdminSessionSchema.index({ email: 1, revokedAt: 1 });
// Housekeeping only: a week after the absolute expiry the record is deleted. Authorization never depends on this.
AdminSessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
