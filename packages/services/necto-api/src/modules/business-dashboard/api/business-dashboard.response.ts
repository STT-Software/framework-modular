import type { Dashboard } from '../domain/dashboard';
/** What the API shows of the dashboard. Dates are ISO strings. */
export function toDashboardResponse(dashboard: Dashboard) {
  return {
    entry: dashboard.entry,
    business: dashboard.business,
    setup: { ...dashboard.setup, baseReadyAt: dashboard.setup.baseReadyAt?.toISOString() ?? null },
    modules: dashboard.modules.map((module) => ({
      id: module.id,
      name: module.name,
      description: module.description,
      configurable: module.configurable,
      operational: module.operational,
      setup: module.settings,
      openNow: module.openNow,
      indicators: module.indicators,
    })),
    generatedAt: dashboard.generatedAt.toISOString(),
  };
}
