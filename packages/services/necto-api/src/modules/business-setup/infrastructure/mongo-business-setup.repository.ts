import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { BusinessSetup, ModuleScheduleEntry } from '../domain/business-setup';
import { BusinessSetupRepository, type SetupPatch } from '../domain/business-setup.repository';
import type { LogoContentType, LogoFile } from '../domain/logo';
import type { SetupStep } from '../domain/setup-steps';
import type { WeekSchedule } from '../domain/week-schedule';
import { BusinessSetupRecord } from './business-setup.schema';

type Lean = BusinessSetupRecord & { _id: unknown };

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

/** A lean read gives a BSON `Binary`, not a Buffer. */
function toBytes(value: unknown): Uint8Array {
  if (Buffer.isBuffer(value)) return value;
  const inner = (value as { buffer?: Uint8Array } | null)?.buffer;
  return inner ? Buffer.from(inner) : new Uint8Array();
}

function toDomain(record: Lean): BusinessSetup {
  return {
    businessId: record.businessId,
    description: record.description ?? null,
    logo: record.logo
      ? {
          contentType: record.logo.contentType as LogoContentType,
          sizeBytes: record.logo.sizeBytes,
          sha256: record.logo.sha256,
          updatedAt: record.logo.updatedAt,
        }
      : null,
    baseSchedule: (record.baseSchedule as unknown as WeekSchedule | null | undefined) ?? null,
    moduleSchedules: (record.moduleSchedules as Record<string, ModuleScheduleEntry> | undefined) ?? {},
    currentStep: (record.currentStep as SetupStep | null | undefined) ?? null,
    visitedSteps: (record.visitedSteps as SetupStep[] | undefined) ?? [],
    baseReadyAt: record.baseReadyAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class MongoBusinessSetupRepository extends BusinessSetupRepository {
  constructor(@InjectModel(BusinessSetupRecord.name) private readonly model: Model<BusinessSetupRecord>) {
    super();
  }

  async find(businessId: string): Promise<BusinessSetup | null> {
    // The logo's bytes are left out: they are only needed to serve the image.
    const record = await this.model.findOne({ businessId }, { 'logo.data': 0 }).lean<Lean>();
    return record ? toDomain(record) : null;
  }

  async findLogo(businessId: string): Promise<LogoFile | null> {
    const record = await this.model.findOne({ businessId }, { logo: 1 }).lean<Lean>();
    if (!record?.logo) return null;
    return {
      info: {
        contentType: record.logo.contentType as LogoContentType,
        sizeBytes: record.logo.sizeBytes,
        sha256: record.logo.sha256,
        updatedAt: record.logo.updatedAt,
      },
      bytes: toBytes(record.logo.data),
    };
  }

  async apply(businessId: string, patch: SetupPatch, now: Date): Promise<BusinessSetup> {
    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.logo === null) unset.logo = '';
    else if (patch.logo) set.logo = { ...patch.logo.info, data: Buffer.from(patch.logo.bytes) };
    if (patch.baseSchedule) set.baseSchedule = patch.baseSchedule;
    if (patch.moduleSchedule) set[`moduleSchedules.${patch.moduleSchedule.moduleId}`] = patch.moduleSchedule.entry;
    if (patch.step) set.currentStep = patch.step;
    if (patch.baseReadyAt !== undefined) set.baseReadyAt = patch.baseReadyAt;
    set.updatedAt = now;

    const update: Record<string, unknown> = { $set: set, $setOnInsert: { createdAt: now } };
    if (Object.keys(unset).length > 0) update.$unset = unset;
    if (patch.step) update.$addToSet = { visitedSteps: patch.step };

    const run = () =>
      this.model
        .findOneAndUpdate({ businessId }, update, { upsert: true, returnDocument: 'after', projection: { 'logo.data': 0 }, timestamps: false })
        .lean<Lean>();
    try {
      return toDomain((await run()) as Lean);
    } catch (error) {
      // Two first writes at once: one creates the document, the other collides with the unique index. The second try only updates it.
      if (!isDuplicateKeyError(error)) throw error;
      return toDomain((await run()) as Lean);
    }
  }
}
