import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Counter of one rate-limit key in its current window (collection `access_rate_limits`). */
@Schema({ timestamps: false, collection: 'access_rate_limits' })
export class RateLimitRecord {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Date, required: true })
  windowStart: Date;

  @Prop({ type: Number, required: true })
  count: number;

  /** When the record can be deleted by the TTL index. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const RateLimitSchema = SchemaFactory.createForClass(RateLimitRecord);
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
