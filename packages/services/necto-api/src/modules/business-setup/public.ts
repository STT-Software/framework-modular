/**
 * Public door of the business-setup module: the only file other code may import from it.
 *
 * - `BusinessSetupModule`: so the application can register it and functional modules can import the contracts below.
 * - `ModuleSetupStatusRegistry` + `ModuleSetupStatusSource`: IoC registry for functional modules to report their
 *   configuration readiness and summary without creating a circular dependency.
 * - `BusinessScheduleReader` + `EffectiveModuleSchedule` + `WeekSchedule`: read-only access to the effective opening
 *   hours of a module (inherited from the business or its own override).
 */
export { BusinessSetupModule } from './business-setup.module';
export { ModuleSetupStatusRegistry } from './application/module-setup-status.registry';
export { ModuleSetupStatusSource, type ModuleSetupStatus } from './domain/module-setup-status';
export { BusinessScheduleReader, type EffectiveModuleSchedule } from './domain/business-schedule-reader';
export type { WeekSchedule } from './domain/week-schedule';
