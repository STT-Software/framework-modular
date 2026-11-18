/**
 * Public door of the business-setup module: the only file other code may import from it.
 *
 * - `BusinessSetupModule`: so the application can register it.
 *
 * Nothing else is exported yet. When a functionality module (turnos, reservas...) needs to know whether the base of a
 * business is ready, or its hours, add the contract here instead of letting it reach into the repository.
 */
export { BusinessSetupModule } from './business-setup.module';
