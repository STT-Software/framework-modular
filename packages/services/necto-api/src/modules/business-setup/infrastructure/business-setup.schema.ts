import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LOGO_CONTENT_TYPES } from '../domain/logo';
import { SETUP_STEPS } from '../domain/setup-steps';

@Schema({ _id: false })
export class LogoRecord {
  @Prop({ type: String, required: true, enum: LOGO_CONTENT_TYPES })
  contentType: string;

  @Prop({ type: Number, required: true })
  sizeBytes: number;

  @Prop({ type: String, required: true })
  sha256: string;

  @Prop({ type: Date, required: true })
  updatedAt: Date;

  /** The image itself (at most 1 MB). Reads exclude it unless the image is being served. */
  @Prop({ type: Buffer, required: true })
  data: Buffer;
}

const LogoRecordSchema = SchemaFactory.createForClass(LogoRecord);

/**
 * MongoDB record of the initial setup of a business (collection `business_setups`, owned by the business-setup module).
 * One document per business, pointing to it by id: the data of the business itself stays in `businesses`.
 *
 * Schedules are stored as plain objects (the domain validates their shape before they get here). No field has a default on
 * purpose: an upsert that sets `moduleSchedules.turnos` must not collide with a default for `moduleSchedules`.
 */
@Schema({ timestamps: true, collection: 'business_setups' })
export class BusinessSetupRecord {
  @Prop({ type: String, required: true })
  businessId: string;

  @Prop({ type: String, default: undefined })
  description?: string | null;

  @Prop({ type: LogoRecordSchema, default: undefined })
  logo?: LogoRecord | null;

  @Prop({ type: Object, default: undefined })
  baseSchedule?: Record<string, unknown> | null;

  @Prop({ type: Object, default: undefined })
  moduleSchedules?: Record<string, unknown>;

  @Prop({ type: String, enum: SETUP_STEPS, default: undefined })
  currentStep?: string | null;

  @Prop({ type: [String], enum: SETUP_STEPS, default: undefined })
  visitedSteps?: string[];

  @Prop({ type: Date, default: undefined })
  baseReadyAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const BusinessSetupSchema = SchemaFactory.createForClass(BusinessSetupRecord);

// One setup per business, even if two requests create it at the same time.
BusinessSetupSchema.index({ businessId: 1 }, { unique: true });
