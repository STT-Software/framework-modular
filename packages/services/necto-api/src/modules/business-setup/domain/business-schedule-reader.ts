import type { WeekSchedule } from './week-schedule';

/** Effective schedule of one module for a business at the current moment, honoring inheritance or its own override. */
export interface EffectiveModuleSchedule {
  timezone: string;
  inherit: boolean;
  openNow: boolean;
  days: WeekSchedule;
}

/** Public contract for functional modules to read their effective business schedule without touching setup internals. */
export abstract class BusinessScheduleReader {
  abstract forModule(businessId: string, moduleId: string, timezone: string): Promise<EffectiveModuleSchedule>;
}
