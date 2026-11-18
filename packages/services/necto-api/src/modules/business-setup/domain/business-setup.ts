import type { BusinessModuleId } from '../../businesses/public';
import type { LogoInfo } from './logo';
import type { SetupStep } from './setup-steps';
import type { WeekSchedule } from './week-schedule';

/**
 * How a module gets its opening hours. With `inherit` the module follows the schedule of the business, whatever it is at
 * the moment it is read. `schedule` is the module's OWN schedule (its exception): it is kept while the module inherits, so
 * switching back to its own hours does not lose it.
 */
export interface ModuleScheduleEntry {
  inherit: boolean;
  schedule: WeekSchedule | null;
}

/**
 * What the administrator has set up for one business, besides the data of the business itself (that stays in `businesses`).
 * Nothing here repeats it: the description, the logo, the opening hours and the progress are new information.
 */
export interface BusinessSetup {
  businessId: string;
  description: string | null;
  logo: LogoInfo | null;
  /** `null` until someone saves it: the business then shows the default schedule. */
  baseSchedule: WeekSchedule | null;
  /** Only the modules that have an entry; the others inherit. Entries of modules that are no longer assigned are ignored. */
  moduleSchedules: Partial<Record<BusinessModuleId, ModuleScheduleEntry>>;
  currentStep: SetupStep | null;
  visitedSteps: SetupStep[];
  /** When the base configuration was saved as ready. Any later change to it clears it again. */
  baseReadyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
