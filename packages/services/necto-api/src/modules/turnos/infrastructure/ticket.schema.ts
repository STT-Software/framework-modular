import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { FIELD_TYPES, TICKET_STATUSES } from '../domain/catalog';
@Schema({ _id: false })
export class TicketActorRecord {
  @Prop({ type: String, required: true })
  operatorId: string;
  @Prop({ type: String, required: true })
  name: string;
}
const TicketActorSchema = SchemaFactory.createForClass(TicketActorRecord);
@Schema({ _id: false })
export class TicketEventRecord {
  @Prop({ type: String, required: true })
  type: string;
  @Prop({ type: Date, required: true })
  at: Date;
  @Prop({ type: TicketActorSchema, required: true })
  by: TicketActorRecord;
  @Prop({ type: Boolean, default: false })
  automatic: boolean;
}
const TicketEventSchema = SchemaFactory.createForClass(TicketEventRecord);
@Schema({ _id: false })
export class TicketAnswerRecord {
  @Prop({ type: String, required: true })
  fieldId: string;
  @Prop({ type: String, required: true })
  label: string;
  @Prop({ type: String, required: true, enum: FIELD_TYPES })
  type: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  value: string | number | boolean;
}
const TicketAnswerSchema = SchemaFactory.createForClass(TicketAnswerRecord);
@Schema({ _id: false })
export class TicketCustomerRecord {
  @Prop({ type: String, default: null })
  name: string | null;
  @Prop({ type: String, default: null })
  phone: string | null;
  @Prop({ type: String, default: null })
  email: string | null;
}
const TicketCustomerSchema = SchemaFactory.createForClass(TicketCustomerRecord);
/**
 * MongoDB record of a turn (collection `turnos_tickets`, owned by the turnos module). Every state change is one conditional update, and the
 * indexes below are what makes the rules hold when requests arrive together: a code is never repeated on a day, an operator never has two
 * turns in attention, and a repeated "create" with the same `clientRequestId` finds the turn it already made.
 */
@Schema({ collection: 'turnos_tickets' })
export class TicketRecord {
  @Prop({ type: String, required: true })
  id: string;
  @Prop({ type: String, required: true })
  businessId: string;
  @Prop({ type: String, required: true })
  queueId: string;
  @Prop({ type: String, required: true })
  queueName: string;
  @Prop({ type: String, required: true })
  dayKey: string;
  @Prop({ type: String, default: '' })
  prefix: string;
  @Prop({ type: Number, required: true })
  number: number;
  @Prop({ type: String, required: true })
  code: string;
  @Prop({ type: Number, required: true })
  seq: number;
  @Prop({ type: String, required: true, enum: TICKET_STATUSES })
  status: string;
  @Prop({ type: TicketCustomerSchema, required: true })
  customer: TicketCustomerRecord;
  @Prop({ type: [TicketAnswerSchema], default: [] })
  answers: TicketAnswerRecord[];
  @Prop({ type: String, default: null })
  note: string | null;
  @Prop({ type: Date, required: true })
  createdAt: Date;
  @Prop({ type: TicketActorSchema, required: true })
  createdBy: TicketActorRecord;
  @Prop({ type: TicketActorSchema, default: null })
  attendedBy: TicketActorRecord | null;
  @Prop({ type: Date, default: null })
  calledAt: Date | null;
  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
  @Prop({ type: String, default: null })
  cancelReason: string | null;
  @Prop({ type: [TicketEventSchema], default: [] })
  events: TicketEventRecord[];
  /** The moment of the latest event: lets the recent activity read only the latest turns. */
  @Prop({ type: Date, required: true })
  lastEventAt: Date;
  @Prop({ type: String, default: null })
  clientRequestId: string | null;
}
export const TicketSchema = SchemaFactory.createForClass(TicketRecord);
TicketSchema.index({ businessId: 1, id: 1 }, { unique: true });
// A code is never repeated on a day of a business, even when two requests ask for a number at the same time.
TicketSchema.index({ businessId: 1, dayKey: 1, code: 1 }, { unique: true });
// A repeated "create" with the same clientRequestId finds the turn that already exists instead of making another.
TicketSchema.index({ businessId: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });
// An operator has at most one turn in attention: the second call fails here, atomically, whatever the requests do.
TicketSchema.index({ businessId: 1, 'attendedBy.operatorId': 1 }, { unique: true, partialFilterExpression: { status: 'attending' } });
// The line of a queue, in order of arrival.
TicketSchema.index({ businessId: 1, queueId: 1, status: 1, createdAt: 1, seq: 1 });
TicketSchema.index({ businessId: 1, createdAt: -1 });
TicketSchema.index({ businessId: 1, lastEventAt: -1 });
TicketSchema.index({ businessId: 1, calledAt: -1 });
@Schema({ collection: 'turnos_counters' })
export class TicketCounterRecord {
  /** `<businessId>:<scope>`: the numbering of a day (or of "all"). */
  @Prop({ type: String, required: true })
  _id: string;
  /** Position of arrival in the scope. */
  @Prop({ type: Number, required: true, default: 0 })
  seq: number;
  /** The last number given to each prefix (`_` is no prefix). */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  n: Record<string, number>;
}
export const TicketCounterSchema = SchemaFactory.createForClass(TicketCounterRecord);
