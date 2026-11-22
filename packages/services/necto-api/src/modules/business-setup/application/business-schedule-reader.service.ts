import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import type { ModuleScheduleEntry } from '../domain/business-setup';
import { BusinessSetupRepository } from '../domain/business-setup.repository';
import { BusinessScheduleReader, type EffectiveModuleSchedule } from '../domain/business-schedule-reader';
import { defaultWeekSchedule, isOpenAt } from '../domain/week-schedule';

/** Computes the effective schedule of a module from the business setup, using the exact same inheritance rules as BusinessSetupService. */
@Injectable()
export class BusinessScheduleReaderService extends BusinessScheduleReader {
  constructor(
    private readonly setups: BusinessSetupRepository,
    private readonly clock: Clock,
  ) {
    super();
  }

  async forModule(businessId: string, moduleId: string, timezone: string): Promise<EffectiveModuleSchedule> {
    const setup = await this.setups.find(businessId);
    const baseSchedule = setup?.baseSchedule ?? defaultWeekSchedule();
    const entry = (setup?.moduleSchedules as Record<string, ModuleScheduleEntry | undefined> | undefined)?.[moduleId];
    const inherit = entry?.inherit ?? true;
    const days = inherit || !entry?.schedule ? baseSchedule : entry.schedule;
    return {
      timezone,
      inherit,
      openNow: isOpenAt(days, timezone, this.clock.now()) ?? false,
      days,
    };
  }
}
