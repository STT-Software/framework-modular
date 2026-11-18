/**
 * Public door of the business-access module: the only file other code may import from it.
 *
 * - `BusinessAccessModule`: so the application can register it, and so a module that serves a functionality
 *   (reservas, turnos...) can import it to use the decorators below.
 * - `BusinessAdminOnly()`: restricts a route to a signed-in administrator of businesses (their session is checked
 *   against the database on every request).
 * - `RecentlyVerified()`: the same, and the person must have confirmed a code recently (sensitive actions).
 * - `AdministersBusiness()`: for routes under `/:businessId/`: the person must be the current boss of that active business,
 *   whatever functionalities it has (what every business has, such as its initial setup).
 * - `RequiresBusinessModule(id)`: for routes under `/:businessId/`: the person must be the current boss of that
 *   active business AND it must have that functionality enabled. The server decides; hiding it in the UI is not enough.
 *
 * Never the repositories, the schemas or the code logic.
 */
export { BusinessAccessModule } from './business-access.module';
export { AdministersBusiness, BusinessAdminOnly, RecentlyVerified, RequiresBusinessModule, type AdminRequest } from './api/business-admin.guards';
