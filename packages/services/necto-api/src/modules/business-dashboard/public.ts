/**
 * Public door of the business-dashboard module: the only file other code may import from it.
 *
 * - `BusinessDashboardModule`: so the application can register it.
 *
 * Nothing else is shared: the dashboard is read through its HTTP route.
 */
export { BusinessDashboardModule } from './business-dashboard.module';
