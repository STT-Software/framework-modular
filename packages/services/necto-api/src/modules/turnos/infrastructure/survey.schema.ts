import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({ _id: false })
export class DeliveryRecord {
  @Prop({ type: String, required: true })
  status: string;
  @Prop({ type: Date, default: null })
  attemptedAt: Date | null;
  @Prop({ type: String, default: null })
  failureCode: string | null;
}
const DeliverySchema = SchemaFactory.createForClass(DeliveryRecord);
@Schema({ _id: false })
export class SurveyDeliveryRecord {
  @Prop({ type: DeliverySchema, required: true })
  email: DeliveryRecord;
  @Prop({ type: DeliverySchema, required: true })
  whatsapp: DeliveryRecord;
}
const SurveyDeliverySchema = SchemaFactory.createForClass(SurveyDeliveryRecord);
@Schema({ _id: false })
export class SurveyResponseRecord {
  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;
  @Prop({ type: String, default: null })
  comment: string | null;
  @Prop({ type: Date, required: true })
  answeredAt: Date;
}
const SurveyResponseSchema = SchemaFactory.createForClass(SurveyResponseRecord);
/** MongoDB record of a satisfaction invitation and its answer (collection `turnos_surveys`, owned by the turnos module). */
@Schema({ collection: 'turnos_surveys' })
export class SurveyRecord {
  @Prop({ type: String, required: true })
  id: string;
  @Prop({ type: String, required: true })
  businessId: string;
  @Prop({ type: String, required: true })
  ticketId: string;
  @Prop({ type: String, required: true })
  ticketCode: string;
  @Prop({ type: String, required: true })
  queueId: string;
  @Prop({ type: String, required: true })
  queueName: string;
  @Prop({ type: String, default: null })
  operatorId: string | null;
  @Prop({ type: String, default: null })
  operatorName: string | null;
  @Prop({ type: String, default: null })
  customerName: string | null;
  @Prop({ type: Date, required: true })
  createdAt: Date;
  @Prop({ type: Date, required: true })
  expiresAt: Date;
  @Prop({ type: String, required: true })
  tokenHash: string;
  @Prop({ type: SurveyDeliverySchema, required: true })
  delivery: SurveyDeliveryRecord;
  @Prop({ type: SurveyResponseSchema, default: null })
  response: SurveyResponseRecord | null;
}
export const SurveySchema = SchemaFactory.createForClass(SurveyRecord);
SurveySchema.index({ businessId: 1, id: 1 }, { unique: true });
// One invitation per turn, even if the turn is completed twice at the same time.
SurveySchema.index({ businessId: 1, ticketId: 1 }, { unique: true });
SurveySchema.index({ tokenHash: 1 }, { unique: true });
SurveySchema.index({ businessId: 1, createdAt: 1 });
SurveySchema.index({ businessId: 1, 'response.answeredAt': -1 });
