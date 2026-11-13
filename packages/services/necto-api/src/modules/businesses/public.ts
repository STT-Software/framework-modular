/**
 * Public door of the businesses module: the only file other code may import from it.
 *
 * - `BusinessesModule`: so the application can register it, and so other modules that import it get the
 *   two contracts below.
 * - `BusinessDirectory`: look a business up (any owner, or only the owner's), as a safe view.
 * - `BusinessModuleAccess`: ask whether a business has a functionality enabled. A module that serves a
 *   functionality (reservas, turnos...) must check this on the server; hiding the option in the UI is not authorization.
 * - `BossAssigned`: published when a boss is assigned (business created or boss replaced).
 *
 * Never the repository, the schema or the controller of `businesses`.
 */
export { BusinessesModule } from './businesses.module';
export { BusinessDirectory, BusinessModuleAccess, type BusinessAccessView } from './domain/business-directory';
export { BossAssigned } from './domain/events';
export type { BusinessModuleId } from './domain/catalog';
export type { BusinessStatus } from './domain/business';
