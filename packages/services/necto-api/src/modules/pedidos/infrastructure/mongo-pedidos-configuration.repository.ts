import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type {
  CancellationStage,
  CarrierId,
  ConfirmationExpiryAction,
  ConfirmationMode,
  OnSiteMode,
  OperatorStage,
  OutOfHoursPolicy,
  PaymentMethodId,
  PedidosModality,
  PedidosProfileId,
  PedidosStep,
  PickupScheduleMode,
  ShippingPricingMode,
} from '../domain/catalog';
import type { PedidosConfiguration } from '../domain/configuration';
import { PedidosConfigurationRepository } from '../domain/pedidos-configuration.repository';
import { PedidosConfigurationRecord } from './pedidos-configuration.schema';

type Lean = PedidosConfigurationRecord & { _id: unknown };

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

function toDomain(record: Lean): PedidosConfiguration {
  return {
    businessId: record.businessId,
    profile: record.profile as PedidosProfileId,
    seeded: record.seeded,
    touched: record.touched,
    modalities: [...(record.modalities as PedidosModality[])],
    onSiteMode: record.onSiteMode as OnSiteMode,
    fulfillment: {
      hasOwnCourier: record.fulfillment.hasOwnCourier,
      carriers: record.fulfillment.carriers.map((carrier) => ({
        id: carrier.id as CarrierId,
        name: carrier.name,
        enabled: carrier.enabled,
        isDefault: carrier.isDefault,
      })),
      pickupMode: record.fulfillment.pickupMode as PickupScheduleMode,
      confirmationMode: record.fulfillment.confirmationMode as ConfirmationMode,
      whatsappNumber: record.fulfillment.whatsappNumber ?? '',
      riskThresholdActive: record.fulfillment.riskThresholdActive,
      maxShippingCostRisk: record.fulfillment.maxShippingCostRisk,
      shippingPricingMode: record.fulfillment.shippingPricingMode as ShippingPricingMode,
      flatShippingFee: record.fulfillment.flatShippingFee,
      freeShippingThreshold: record.fulfillment.freeShippingThreshold,
      minimumOrderActive: record.fulfillment.minimumOrderActive,
      minimumOrderAmount: record.fulfillment.minimumOrderAmount,
    },
    payments: {
      methods: [...(record.payments.methods as PaymentMethodId[])],
      requireTransferReceipt: record.payments.requireTransferReceipt,
      requirePrepaymentBeforePrep: record.payments.requirePrepaymentBeforePrep,
      confirmationExpiryAction: record.payments.confirmationExpiryAction as ConfirmationExpiryAction,
      cancellationLimit: record.payments.cancellationLimit as CancellationStage,
    },
    sla: {
      confirmationMinutes: record.sla.confirmationMinutes,
      preparationMinutes: record.sla.preparationMinutes,
      dispatchMinutes: record.sla.dispatchMinutes,
      urgencyThresholdMinutes: record.sla.urgencyThresholdMinutes,
      outOfHoursPolicy: record.sla.outOfHoursPolicy as OutOfHoursPolicy,
      outOfHoursAutoReply: record.sla.outOfHoursAutoReply,
      outOfHoursMessage: record.sla.outOfHoursMessage ?? '',
    },
    operators: record.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      email: operator.email,
      phone: operator.phone ?? null,
      stages: [...(operator.stages as OperatorStage[])],
      createdAt: operator.createdAt,
    })),
    currentStep: (record.currentStep as PedidosStep | null) ?? null,
    visitedSteps: [...(record.visitedSteps as PedidosStep[])],
    readyAt: record.readyAt ?? null,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class MongoPedidosConfigurationRepository extends PedidosConfigurationRepository {
  constructor(@InjectModel(PedidosConfigurationRecord.name) private readonly model: Model<PedidosConfigurationRecord>) {
    super();
  }

  async findByBusinessId(businessId: string): Promise<PedidosConfiguration | null> {
    const record = await this.model.findOne({ businessId }).lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async findByOperatorEmail(email: string): Promise<PedidosConfiguration[]> {
    const records = await this.model.find({ 'operators.email': email }).lean<Lean[]>();
    return records.map(toDomain);
  }

  async insert(config: PedidosConfiguration): Promise<PedidosConfiguration> {
    try {
      const record = await this.model.create({ ...config });
      return toDomain(record.toObject() as Lean);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await this.findByBusinessId(config.businessId);
      if (!existing) throw error;
      return existing;
    }
  }

  async replace(expectedVersion: number, next: PedidosConfiguration): Promise<PedidosConfiguration | null> {
    const { businessId, createdAt: _createdAt, version: _version, ...content } = next;
    const record = await this.model
      .findOneAndUpdate(
        { businessId, version: expectedVersion },
        { $set: { ...content, version: expectedVersion + 1 } },
        { returnDocument: 'after' },
      )
      .lean<Lean>();
    return record ? toDomain(record) : null;
  }
}
