import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
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
  type CancellationStage,
  type CarrierId,
  type ConfirmationExpiryAction,
  type ConfirmationMode,
  type OnSiteMode,
  type OperatorStage,
  type OutOfHoursPolicy,
  type PaymentMethodId,
  type PedidosModality,
  type PedidosProfileId,
  type PedidosStep,
  type PickupScheduleMode,
  type ShippingPricingMode,
} from '../../domain/catalog';

/*
 * DTOs enforce request shape (types, enums, nested structures, and no undeclared fields under forbidNonWhitelisted).
 * Cross-field invariants and numeric bounds live in the Pedidos domain so every caller receives uniform field errors.
 */

export class ChangePedidosProfileDto {
  @IsIn(PEDIDOS_PROFILE_IDS, { message: `profile must be one of: ${PEDIDOS_PROFILE_IDS.join(', ')}` })
  profile: PedidosProfileId;
}

export class UpdatePedidosModalitiesDto {
  @IsArray({ message: 'modalities must be a list' })
  @ArrayMaxSize(PEDIDOS_MODALITIES.length)
  @IsIn(PEDIDOS_MODALITIES, {
    each: true,
    message: `each modality must be one of: ${PEDIDOS_MODALITIES.join(', ')}`,
  })
  modalities: PedidosModality[];

  @IsIn(ON_SITE_MODES, { message: `onSiteMode must be one of: ${ON_SITE_MODES.join(', ')}` })
  onSiteMode: OnSiteMode;
}

export class CarrierConfigDto {
  @IsIn(CARRIER_IDS, { message: `carrier id must be one of: ${CARRIER_IDS.join(', ')}` })
  id: CarrierId;

  @IsOptional()
  @IsString({ message: 'name must be text' })
  @MaxLength(100)
  name?: string;

  @IsBoolean({ message: 'enabled must be true or false' })
  enabled: boolean;

  @IsBoolean({ message: 'isDefault must be true or false' })
  isDefault: boolean;
}

export class UpdatePedidosFulfillmentDto {
  @IsBoolean({ message: 'hasOwnCourier must be true or false' })
  hasOwnCourier: boolean;

  @IsArray({ message: 'carriers must be a list' })
  @ArrayMaxSize(CARRIER_IDS.length)
  @ValidateNested({ each: true })
  @Type(() => CarrierConfigDto)
  carriers: CarrierConfigDto[];

  @IsIn(PICKUP_MODES, { message: `pickupMode must be one of: ${PICKUP_MODES.join(', ')}` })
  pickupMode: PickupScheduleMode;

  @IsIn(CONFIRMATION_MODES, { message: `confirmationMode must be one of: ${CONFIRMATION_MODES.join(', ')}` })
  confirmationMode: ConfirmationMode;

  @IsString({ message: 'whatsappNumber must be text' })
  @MaxLength(60)
  whatsappNumber: string;

  @IsBoolean({ message: 'riskThresholdActive must be true or false' })
  riskThresholdActive: boolean;

  @IsInt({ message: 'maxShippingCostRisk must be a whole number' })
  maxShippingCostRisk: number;

  @IsIn(SHIPPING_PRICING_MODES, {
    message: `shippingPricingMode must be one of: ${SHIPPING_PRICING_MODES.join(', ')}`,
  })
  shippingPricingMode: ShippingPricingMode;

  @IsInt({ message: 'flatShippingFee must be a whole number' })
  flatShippingFee: number;

  @IsInt({ message: 'freeShippingThreshold must be a whole number' })
  freeShippingThreshold: number;

  @IsBoolean({ message: 'minimumOrderActive must be true or false' })
  minimumOrderActive: boolean;

  @IsInt({ message: 'minimumOrderAmount must be a whole number' })
  minimumOrderAmount: number;
}

export class UpdatePedidosPaymentsDto {
  @IsArray({ message: 'methods must be a list' })
  @ArrayMaxSize(PAYMENT_METHOD_IDS.length)
  @IsIn(PAYMENT_METHOD_IDS, {
    each: true,
    message: `each payment method must be one of: ${PAYMENT_METHOD_IDS.join(', ')}`,
  })
  methods: PaymentMethodId[];

  @IsBoolean({ message: 'requireTransferReceipt must be true or false' })
  requireTransferReceipt: boolean;

  @IsBoolean({ message: 'requirePrepaymentBeforePrep must be true or false' })
  requirePrepaymentBeforePrep: boolean;

  @IsIn(CONFIRMATION_EXPIRY_ACTIONS, {
    message: `confirmationExpiryAction must be one of: ${CONFIRMATION_EXPIRY_ACTIONS.join(', ')}`,
  })
  confirmationExpiryAction: ConfirmationExpiryAction;

  @IsIn(CANCELLATION_STAGES, {
    message: `cancellationLimit must be one of: ${CANCELLATION_STAGES.join(', ')}`,
  })
  cancellationLimit: CancellationStage;
}

export class UpdatePedidosSlaDto {
  @IsInt({ message: 'confirmationMinutes must be a whole number' })
  confirmationMinutes: number;

  @IsInt({ message: 'preparationMinutes must be a whole number' })
  preparationMinutes: number;

  @IsInt({ message: 'dispatchMinutes must be a whole number' })
  dispatchMinutes: number;

  @IsInt({ message: 'urgencyThresholdMinutes must be a whole number' })
  urgencyThresholdMinutes: number;

  @IsIn(OUT_OF_HOURS_POLICIES, {
    message: `outOfHoursPolicy must be one of: ${OUT_OF_HOURS_POLICIES.join(', ')}`,
  })
  outOfHoursPolicy: OutOfHoursPolicy;

  @IsBoolean({ message: 'outOfHoursAutoReply must be true or false' })
  outOfHoursAutoReply: boolean;

  @IsString({ message: 'outOfHoursMessage must be text' })
  @MaxLength(1000)
  outOfHoursMessage: string;
}

export class UpsertPedidosOperatorDto {
  @IsString({ message: 'name must be text' })
  @MaxLength(200)
  name: string;

  @IsString({ message: 'email must be text' })
  @MaxLength(320)
  email: string;

  @IsOptional()
  @IsString({ message: 'phone must be text' })
  @MaxLength(60)
  phone?: string | null;

  @IsArray({ message: 'stages must be a list' })
  @ArrayMaxSize(OPERATOR_STAGES.length)
  @IsIn(OPERATOR_STAGES, {
    each: true,
    message: `each stage must be one of: ${OPERATOR_STAGES.join(', ')}`,
  })
  stages: OperatorStage[];
}

export class SavePedidosProgressDto {
  @IsIn(PEDIDOS_STEPS, { message: `currentStep must be one of: ${PEDIDOS_STEPS.join(', ')}` })
  currentStep: PedidosStep;

  @IsOptional()
  @IsArray({ message: 'visitedSteps must be a list' })
  @ArrayMaxSize(PEDIDOS_STEPS.length)
  @IsIn(PEDIDOS_STEPS, {
    each: true,
    message: `each visited step must be one of: ${PEDIDOS_STEPS.join(', ')}`,
  })
  visitedSteps?: PedidosStep[];
}
