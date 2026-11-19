import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PREFIX_MODES, QUEUE_COLORS, QUEUE_MODES, SETUP_STEPS, TURNOS_PROFILE_IDS } from '../domain/catalog';

@Schema({ _id: false })
export class QueueOverridesRecord {
  @Prop({ type: String, default: null })
  prefix: string | null;

  @Prop({ type: Number, default: null })
  urgentMinutes: number | null;

  @Prop({ type: Number, default: null })
  busyLimit: number | null;

  @Prop({ type: Number, default: null })
  fullLimit: number | null;
}
const QueueOverridesSchema = SchemaFactory.createForClass(QueueOverridesRecord);

@Schema({ _id: false })
export class QueueRecord {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, enum: QUEUE_COLORS })
  color: string;

  @Prop({ type: String, required: true, enum: QUEUE_MODES })
  mode: string;

  @Prop({ type: Number, required: true })
  averageMinutes: number;

  /** "custom" or the id of the profile that suggested it. */
  @Prop({ type: String, required: true })
  source: string;

  @Prop({ type: QueueOverridesSchema, required: true })
  overrides: QueueOverridesRecord;
}
const QueueSchema = SchemaFactory.createForClass(QueueRecord);

@Schema({ _id: false })
export class OperatorRecord {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  name: string;

  /** Normalized: trimmed and lowercase. Looked up by the shared sign-in (see the index below). */
  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: [String], default: [] })
  queueIds: string[];

  @Prop({ type: Date, required: true })
  createdAt: Date;
}
const OperatorSchema = SchemaFactory.createForClass(OperatorRecord);

@Schema({ _id: false })
export class RulesRecord {
  @Prop({ type: String, required: true, enum: PREFIX_MODES })
  prefixMode: string;

  @Prop({ type: String, default: null })
  fixedPrefix: string | null;

  @Prop({ type: Boolean, required: true })
  dailyReset: boolean;

  @Prop({ type: Number, required: true })
  urgentMinutes: number;

  @Prop({ type: Number, required: true })
  busyLimit: number;

  @Prop({ type: Number, required: true })
  fullLimit: number;
}
const RulesSchema = SchemaFactory.createForClass(RulesRecord);

/**
 * MongoDB record of the Turnos configuration of a business (collection `turnos_configurations`, owned by the turnos module).
 * One document per business, with the queues and the operators INSIDE it: any change that touches both is one atomic write
 * (MongoDB here has no multi-document transactions), and every write is checked against `version`.
 */
@Schema({ collection: 'turnos_configurations' })
export class TurnosConfigurationRecord {
  @Prop({ type: String, required: true })
  businessId: string;

  @Prop({ type: String, enum: TURNOS_PROFILE_IDS, default: null })
  profile: string | null;

  @Prop({ type: Boolean, required: true, default: false })
  seeded: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  touched: boolean;

  @Prop({ type: RulesSchema, required: true })
  rules: RulesRecord;

  @Prop({ type: [QueueSchema], default: [] })
  queues: QueueRecord[];

  @Prop({ type: [OperatorSchema], default: [] })
  operators: OperatorRecord[];

  @Prop({ type: String, enum: SETUP_STEPS, default: null })
  currentStep: string | null;

  @Prop({ type: [String], enum: SETUP_STEPS, default: [] })
  visitedSteps: string[];

  @Prop({ type: Date, default: null })
  readyAt: Date | null;

  @Prop({ type: Number, required: true, default: 1 })
  version: number;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  updatedAt: Date;
}

export const TurnosConfigurationSchema = SchemaFactory.createForClass(TurnosConfigurationRecord);

// One configuration per business, even if two requests create it at the same time.
TurnosConfigurationSchema.index({ businessId: 1 }, { unique: true });
// Which businesses does this email operate? (the shared sign-in and every operator request)
TurnosConfigurationSchema.index({ 'operators.email': 1 });
