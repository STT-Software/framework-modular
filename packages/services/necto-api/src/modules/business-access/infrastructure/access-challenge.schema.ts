import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { ChallengePurpose, ChallengeStatus, DeliveryFailureCode, DeliveryStatus } from '../domain/challenge';

@Schema({ _id: false })
export class DeliveryRecord {
  @Prop({ type: String, required: true, enum: ['sending', 'accepted', 'failed'] })
  status: DeliveryStatus;

  @Prop({ type: Date, required: true })
  attemptedAt: Date;

  @Prop({ type: Date, default: null })
  acceptedAt: Date | null;

  @Prop({ type: Date, default: null })
  failedAt: Date | null;

  @Prop({ type: String, default: null })
  failureCode: DeliveryFailureCode | null;
}
const DeliveryRecordSchema = SchemaFactory.createForClass(DeliveryRecord);

/**
 * MongoDB record of an access code (collection `access_challenges`, owned by the business-access module).
 * It stores the HMAC of the code, never the code. A TTL index removes old records, but nothing relies on it:
 * expiry is always checked against `expiresAt` when a code is verified.
 */
@Schema({ timestamps: false, collection: 'access_challenges' })
export class AccessChallengeRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  businessId: string;

  @Prop({ type: String, required: true })
  assignmentId: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true, enum: ['invitation', 'login'] })
  purpose: ChallengePurpose;

  @Prop({ type: String, required: true })
  codeHmac: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Number, required: true, default: 0 })
  attempts: number;

  @Prop({ type: Number, required: true })
  maxAttempts: number;

  @Prop({ type: String, required: true, enum: ['pending', 'consumed', 'revoked', 'superseded', 'locked'], default: 'pending' })
  status: ChallengeStatus;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Date, default: null })
  consumedAt: Date | null;

  @Prop({ type: DeliveryRecordSchema, required: true })
  delivery: DeliveryRecord;
}

export const AccessChallengeSchema = SchemaFactory.createForClass(AccessChallengeRecord);

// Finding the newest usable code of a person for a business (verification) and the latest of a business (status).
AccessChallengeSchema.index({ businessId: 1, email: 1, status: 1, createdAt: -1 });
AccessChallengeSchema.index({ businessId: 1, purpose: 1, createdAt: -1 });
// Housekeeping only: one day after a code expires its record is deleted. Authorization never depends on this.
AccessChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });
