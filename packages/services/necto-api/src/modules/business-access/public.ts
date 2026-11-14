/**
 * Public door of the business-access module: the only file other code may import from it.
 *
 * Today it exposes just the module, so the application can register it. Nothing else needs it yet.
 * A module that serves a functionality to bosses (reservas, turnos...) will need to restrict a route to
 * the boss of an active business: when the first one exists, export a `BossOnly` decorator here
 * (the guard and the decorator live in `api/`), never the repositories or the code logic.
 */
export { BusinessAccessModule } from './business-access.module';
