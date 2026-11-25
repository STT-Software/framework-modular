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
 * - `OperatesModule(id)`: for routes under `/:businessId/`: the person must be an OPERATOR of that business for that module (the
 *   module assigned them), with the same login as the administrators and none of their permissions.
 * - `MemberAccessRegistry` + `MemberAccessSource`: how a module that assigns operators lets business-access know about them
 *   without being imported by it (it registers itself when it starts; the assignments stay in the module).
 * - `BusinessAccessChecks`: asks again, while a connection stays open (a live stream), whether the session, the administrator or the
 *   operator may still do what they are doing.
 * - `RequiresBusinessModule(id)`: for routes under `/:businessId/`: the person must be the current boss of that
 *   active business AND it must have that functionality enabled. The server decides; hiding it in the UI is not enough.
 *
 * Never the repositories, the schemas or the code logic.
 */
export { BusinessAccessModule } from './business-access.module';
export { AdministersBusiness, BusinessAdminOnly, OperatesModule, RecentlyVerified, RequiresBusinessModule, type AdminRequest } from './api/business-admin.guards';
export { BusinessAccessChecks } from './domain/access-checks';
export { MemberAccessRegistry } from './application/member-access.registry';
export { MemberAccessSource, MemberSignedIn, type BusinessMemberCandidate, type MemberAssignment } from './domain/member-access';
export type { AccessGrant, AccessRole } from './domain/access-grant';
