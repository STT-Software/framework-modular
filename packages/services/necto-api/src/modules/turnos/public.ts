/**
 * Public door of the turnos module: the only file other code may import from it.
 *
 * - `TurnosModule`: so the application can register it, and so a module that needs the contract below can import it.
 * - `TurnosBaseSetup`: what the base setup of a business needs from Turnos: the attention profile (chosen in the base setup but
 *   stored by Turnos, which knows what each profile suggests) and whether Turnos is ready.
 * - `TurnosDashboard`: the real indicators of Turnos for the general dashboard of a business.
 *
 * Never the repository, the schema, the controllers or the operations on the configuration.
 */
export { TurnosModule } from './turnos.module';
export { TurnosBaseSetup, type TurnosProfileOption, type TurnosSetupStatus } from './domain/turnos-base-setup';
export { TURNOS_PROFILE_IDS, TURNOS_MODULE_ID, type TurnosProfileId } from './domain/catalog';
export { TurnosDashboard, type TurnosDashboardSummary } from './domain/turnos-dashboard';
