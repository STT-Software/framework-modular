import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  CANCELLATION_STAGES,
  CARRIER_IDS,
  CONFIRMATION_EXPIRY_ACTIONS,
  CONFIRMATION_MODES,
  ON_SITE_MODES,
  OPERATOR_STAGES,
  OUT_OF_HOURS_POLICIES,
  PAYMENT_METHOD_IDS,
  PEDIDOS_MODALITIES,
  PEDIDOS_PROFILE_IDS,
  PEDIDOS_STEPS,
  PICKUP_MODES,
  SHIPPING_PRICING_MODES,
} from '../domain/catalog';

@Schema({ _id: false })
export class CarrierConfigRecord {
  @Prop({ type: String, required: true, enum: CARRIER_IDS })
  id: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Boolean, required: true })
  enabled: boolean;

  @Prop({ type: Boolean, required: true })
  isDefault: boolean;
}
const CarrierConfigSchema = SchemaFactory.createForClass(CarrierConfigRecord);

@Schema({ _id: false })
export class FulfillmentSettingsRecord {
  @Prop({ type: Boolean, required: true })
  hasOwnCourier: boolean;

  @Prop({ type: [CarrierConfigSchema], default: [] })
  carriers: CarrierConfigRecord[];

  @Prop({ type: String, required: true, enum: PICKUP_MODES })
  pickupMode: string;

  @Prop({ type: String, required: true, enum: CONFIRMATION_MODES })
  confirmationMode: string;

  @Prop({ type: String, default: '' })
  whatsappNumber: string;

  @Prop({ type: Boolean, required: true })
  riskThresholdActive: boolean;

  @Prop({ type: Number, required: true })
  maxShippingCostRisk: number;

  @Prop({ type: String, required: true, enum: SHIPPING_PRICING_MODES })
  shippingPricingMode: string;

  @Prop({ type: Number, required: true })
  flatShippingFee: number;

  @Prop({ type: Number, required: true })
  freeShippingThreshold: number;

  @Prop({ type: Boolean, required: true })
  minimumOrderActive: boolean;

  @Prop({ type: Number, required: true })
  minimumOrderAmount: number;
}
const FulfillmentSettingsSchema = SchemaFactory.createForClass(FulfillmentSettingsRecord);

@Schema({ _id: false })
export class PaymentPoliciesSettingsRecord {
  @Prop({ type: [String], enum: PAYMENT_METHOD_IDS, default: [] })
  methods: string[];

  @Prop({ type: Boolean, required: true })
  requireTransferReceipt: boolean;

  @Prop({ type: Boolean, required: true })
  requirePrepaymentBeforePrep: boolean;

  @Prop({ type: String, required: true, enum: CONFIRMATION_EXPIRY_ACTIONS })
  confirmationExpiryAction: string;

  @Prop({ type: String, required: true, enum: CANCELLATION_STAGES })
  cancellationLimit: string;
}
const PaymentPoliciesSettingsSchema = SchemaFactory.createForClass(PaymentPoliciesSettingsRecord);

@Schema({ _id: false })
export class SlaSettingsRecord {
  @Prop({ type: Number, required: true })
  confirmationMinutes: number;

  @Prop({ type: Number, required: true })
  preparationMinutes: number;

  @Prop({ type: Number, required: true })
  dispatchMinutes: number;

  @Prop({ type: Number, required: true })
  urgencyThresholdMinutes: number;

  @Prop({ type: String, required: true, enum: OUT_OF_HOURS_POLICIES })
  outOfHoursPolicy: string;

  @Prop({ type: Boolean, required: true })
  outOfHoursAutoReply: boolean;

  @Prop({ type: String, default: '' })
  outOfHoursMessage: string;
}
const SlaSettingsSchema = SchemaFactory.createForClass(SlaSettingsRecord);

@Schema({ _id: false })
export class PedidosOperatorRecord {
  @Prop({ type: String, required: true })
  id: string;

  @Prop({ type: String, required: true })
  name: string;

  /** Normalized: trimmed and lowercase. Indexed below for shared login lookups. */
  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, default: null })
  phone: string | null;

  @Prop({ type: [String], enum: OPERATOR_STAGES, default: [] })
  stages: string[];

  @Prop({ type: Date, required: true })
  createdAt: Date;
}
const PedidosOperatorSchema = SchemaFactory.createForClass(PedidosOperatorRecord);

/**
 * MongoDB document of the Pedidos configuration of a business (collection `pedidos_configurations`).
 * Stored as one atomically versioned document per business.
 */
@Schema({ collection: 'pedidos_configurations' })
export class PedidosConfigurationRecord {
  @Prop({ type: String, required: true })
  businessId: string;

  @Prop({ type: String, required: true, enum: PEDIDOS_PROFILE_IDS })
  profile: string;

  @Prop({ type: Boolean, required: true, default: false })
  seeded: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  touched: boolean;

  @Prop({ type: [String], enum: PEDIDOS_MODALITIES, default: [] })
  modalities: string[];

  @Prop({ type: String, required: true, enum: ON_SITE_MODES })
  onSiteMode: string;

  @Prop({ type: FulfillmentSettingsSchema, required: true })
  fulfillment: FulfillmentSettingsRecord;

  @Prop({ type: PaymentPoliciesSettingsSchema, required: true })
  payments: PaymentPoliciesSettingsRecord;

  @Prop({ type: SlaSettingsSchema, required: true })
  sla: SlaSettingsRecord;

  @Prop({ type: [PedidosOperatorSchema], default: [] })
  operators: PedidosOperatorRecord[];

  @Prop({ type: String, enum: PEDIDOS_STEPS, default: null })
  currentStep: string | null;

  @Prop({ type: [String], enum: PEDIDOS_STEPS, default: [] })
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

export const PedidosConfigurationSchema = SchemaFactory.createForClass(PedidosConfigurationRecord);

PedidosConfigurationSchema.index({ businessId: 1 }, { unique: true });
PedidosConfigurationSchema.index({ 'operators.email': 1 });
