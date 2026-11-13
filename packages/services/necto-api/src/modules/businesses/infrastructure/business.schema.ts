import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BUSINESS_CATEGORY_IDS, BUSINESS_MODULE_IDS, type BusinessCategoryId, type BusinessModuleId } from '../domain/catalog';

@Schema({ _id: false })
export class BossRecord {
  @Prop({ type: String, required: true })
  assignmentId: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  /** Normalized: trimmed and lowercase. */
  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: Date, required: true })
  assignedAt: Date;
}
const BossRecordSchema = SchemaFactory.createForClass(BossRecord);

@Schema({ _id: false })
export class RevokedBossRecord extends BossRecord {
  @Prop({ type: Date, required: true })
  revokedAt: Date;
}
const RevokedBossRecordSchema = SchemaFactory.createForClass(RevokedBossRecord);

/**
 * MongoDB record of a business (collection `businesses`, owned by the businesses module).
 *
 * The current boss is a subdocument of the business, so creating or replacing it is one atomic write
 * (MongoDB here has no multi-document transactions, so nothing is split across collections).
 * Names, tax ids and phones are NOT unique: two branches of the same company may share them.
 */
@Schema({ timestamps: true, collection: 'businesses' })
export class BusinessRecord {
  /** Id of the super admin who owns the business (the "sub" of their session). */
  @Prop({ type: String, required: true })
  ownerId: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  legalName: string | null;

  @Prop({ type: String, default: null })
  taxId: string | null;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: String, default: null })
  address: string | null;

  @Prop({ type: String, default: null })
  supportEmail: string | null;

  @Prop({ type: String, default: null })
  website: string | null;

  @Prop({ type: String, required: true, enum: BUSINESS_CATEGORY_IDS })
  category: BusinessCategoryId;

  @Prop({ type: String, default: null })
  categoryOther: string | null;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true })
  timezone: string;

  @Prop({ type: [String], enum: BUSINESS_MODULE_IDS, default: [] })
  modules: BusinessModuleId[];

  @Prop({ type: String, required: true, enum: ['active', 'paused'], default: 'active' })
  status: 'active' | 'paused';

  @Prop({ type: BossRecordSchema, required: true })
  boss: BossRecord;

  /** Bosses that were replaced, oldest first. */
  @Prop({ type: [RevokedBossRecordSchema], default: [] })
  bossHistory: RevokedBossRecord[];

  @Prop({ type: Number, required: true, default: 1 })
  version: number;

  /** Idempotency of the creation request, scoped to the owner (see the unique index below). Never exposed. */
  @Prop({ type: String, required: true })
  idempotencyKey: string;

  @Prop({ type: String, required: true })
  fingerprint: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BusinessSchema = SchemaFactory.createForClass(BusinessRecord);

// The same owner cannot create the same business twice with the same key, even with two requests at once.
BusinessSchema.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true });
// The owner's directory: newest first, optionally narrowed by status and category.
BusinessSchema.index({ ownerId: 1, createdAt: -1 });
BusinessSchema.index({ ownerId: 1, status: 1, category: 1 });
