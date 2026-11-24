import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { OPERATOR_VIEWS, type FieldType, type OperatorStatus, type OperatorViewId, type PrefixMode, type QueueColor, type QueueMode, type QueueStatus, type RoomNameDisplay, type SetupStep, type TurnosProfileId } from '../domain/catalog';
import type { TurnosConfiguration } from '../domain/configuration';
import { DEFAULT_ROOM_SCREEN, DEFAULT_SURVEY } from '../domain/settings';
import { TurnosConfigurationRepository } from '../domain/turnos-configuration.repository';
import { TurnosConfigurationRecord } from './turnos-configuration.schema';

type Lean = TurnosConfigurationRecord & { _id: unknown };

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

function toDomain(record: Lean): TurnosConfiguration {
  return {
    businessId: record.businessId,
    profile: (record.profile as TurnosProfileId | null) ?? null,
    seeded: record.seeded,
    touched: record.touched,
    rules: {
      prefixMode: record.rules.prefixMode as PrefixMode,
      fixedPrefix: record.rules.fixedPrefix ?? null,
      dailyReset: record.rules.dailyReset,
      urgentMinutes: record.rules.urgentMinutes,
      busyLimit: record.rules.busyLimit,
      fullLimit: record.rules.fullLimit,
    },
    queues: record.queues.map((queue) => ({
      id: queue.id,
      name: queue.name,
      color: queue.color as QueueColor,
      mode: queue.mode as QueueMode,
      averageMinutes: queue.averageMinutes,
      source: queue.source as 'custom' | TurnosProfileId,
      overrides: {
        prefix: queue.overrides?.prefix ?? null,
        urgentMinutes: queue.overrides?.urgentMinutes ?? null,
        busyLimit: queue.overrides?.busyLimit ?? null,
        fullLimit: queue.overrides?.fullLimit ?? null,
      },
      status: (queue.status as QueueStatus | undefined) ?? 'active',
      fields: (queue.fields ?? []).map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type as FieldType,
        required: field.required === true,
        options: [...(field.options ?? [])],
      })),
    })),
    operators: record.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      email: operator.email,
      phone: operator.phone ?? null,
      queueIds: [...operator.queueIds],
      // Saved before the workspace existed: they could already use what there was, so they are active with every view.
      views: (operator.views as OperatorViewId[] | undefined) ?? [...OPERATOR_VIEWS],
      status: (operator.status as OperatorStatus | undefined) ?? 'active',
      activatedAt: operator.activatedAt ?? null,
      createdAt: operator.createdAt,
    })),
    roomScreen: record.roomScreen
      ? {
          enabled: record.roomScreen.enabled,
          queueIds: record.roomScreen.queueIds ? [...record.roomScreen.queueIds] : null,
          customerName: record.roomScreen.customerName as RoomNameDisplay,
          playSound: record.roomScreen.playSound,
          recentCalls: record.roomScreen.recentCalls,
          message: record.roomScreen.message ?? null,
        }
      : { ...DEFAULT_ROOM_SCREEN },
    survey: record.survey
      ? {
          enabled: record.survey.enabled,
          channels: { email: record.survey.channels.email, whatsapp: record.survey.channels.whatsapp },
          question: record.survey.question,
          allowComment: record.survey.allowComment,
          thanksMessage: record.survey.thanksMessage ?? null,
          validHours: record.survey.validHours,
          queueIds: record.survey.queueIds ? [...record.survey.queueIds] : null,
        }
      : { ...DEFAULT_SURVEY, channels: { ...DEFAULT_SURVEY.channels } },
    currentStep: (record.currentStep as SetupStep | null) ?? null,
    visitedSteps: record.visitedSteps as SetupStep[],
    readyAt: record.readyAt ?? null,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class MongoTurnosConfigurationRepository extends TurnosConfigurationRepository {
  constructor(@InjectModel(TurnosConfigurationRecord.name) private readonly model: Model<TurnosConfigurationRecord>) {
    super();
  }

  async find(businessId: string): Promise<TurnosConfiguration | null> {
    const record = await this.model.findOne({ businessId }).lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async insert(config: TurnosConfiguration): Promise<TurnosConfiguration> {
    try {
      const record = await this.model.create({ ...config });
      return toDomain(record.toObject() as Lean);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // Another request created it first: continue with that one.
      const existing = await this.find(config.businessId);
      if (!existing) throw error;
      return existing;
    }
  }

  async replace(expectedVersion: number, next: TurnosConfiguration): Promise<TurnosConfiguration | null> {
    const { businessId, createdAt: _createdAt, version: _version, ...content } = next;
    const record = await this.model
      .findOneAndUpdate({ businessId, version: expectedVersion }, { $set: { ...content, version: expectedVersion + 1 } }, { returnDocument: 'after' })
      .lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async findByOperatorEmail(email: string): Promise<TurnosConfiguration[]> {
    const records = await this.model.find({ 'operators.email': email }).lean<Lean[]>();
    return records.map(toDomain);
  }
}
