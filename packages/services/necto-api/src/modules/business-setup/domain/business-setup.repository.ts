import type { BusinessModuleId } from '../../businesses/public';
import type { BusinessSetup, ModuleScheduleEntry } from './business-setup';
import type { LogoFile } from './logo';
import type { SetupStep } from './setup-steps';
import type { WeekSchedule } from './week-schedule';

/** The parts of a setup that can change in one write. What is not mentioned is not touched. */
export interface SetupPatch {
  description?: string | null;
  /** A file replaces the logo; `null` removes it. */
  logo?: LogoFile | null;
  baseSchedule?: WeekSchedule;
  moduleSchedule?: { moduleId: BusinessModuleId; entry: ModuleScheduleEntry };
  /** The step the person is on; it is also added to the visited ones. */
  step?: SetupStep;
  /** `null` clears "ready"; a date marks the base as ready. */
  baseReadyAt?: Date | null;
}

/** What the module needs to persist the setup of a business. The business id always comes from an already authorized request. */
export abstract class BusinessSetupRepository {
  abstract find(businessId: string): Promise<BusinessSetup | null>;
  abstract findLogo(businessId: string): Promise<LogoFile | null>;
  /** Creates the setup if it does not exist yet and applies the patch, in one write per business. */
  abstract apply(businessId: string, patch: SetupPatch, now: Date): Promise<BusinessSetup>;
}
