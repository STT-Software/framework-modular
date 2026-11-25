import type { SetupOverview, SetupOverviewModule } from '../../business-setup/public';
import type { TurnosDashboardSummary } from '../../turnos/public';
/** Where the administrator goes after choosing the business: the dashboard when everything is prepared, the setup while something is missing. */
export type DashboardEntry = 'dashboard' | 'setup';
export type SetupNext = { step: 'base' } | { step: 'module'; moduleId: string };
export interface DashboardModule extends SetupOverviewModule {
  /** The module can be operated today (its operation exists). Today only Turnos. */
  operational: boolean;
  /** Real indicators of the module, only while it is operational and its configuration is ready. Null otherwise: nothing is invented. */
  indicators: { turnos: TurnosDashboardSummary } | null;
}
export interface Dashboard {
  entry: DashboardEntry;
  business: SetupOverview['business'];
  setup: {
    baseReady: boolean;
    baseReadyAt: Date | null;
    /** What is missing, in the order to do it; null when everything is prepared. */
    next: SetupNext | null;
    /** The modules of the business that can be configured and are not ready yet. */
    pendingModules: string[];
    configurableModules: number;
    readyModules: number;
  };
  modules: DashboardModule[];
  generatedAt: Date;
}
/**
 * Prepared means: the base configuration is saved as ready AND every assigned module that can be configured today has its configuration
 * ready. An assigned module that has no configuration yet (it is still to be built) is listed but never holds the business back.
 */
export function setupProgress(overview: Pick<SetupOverview, 'baseReady' | 'modules'>) {
  const configurable = overview.modules.filter((module) => module.configurable);
  const pendingModules = configurable.filter((module) => module.settings.status !== 'ready').map((module) => module.id as string);
  const next: SetupNext | null = !overview.baseReady ? { step: 'base' } : pendingModules.length > 0 ? { step: 'module', moduleId: pendingModules[0] } : null;
  return {
    entry: (next === null ? 'dashboard' : 'setup') as DashboardEntry,
    next,
    pendingModules,
    configurableModules: configurable.length,
    readyModules: configurable.length - pendingModules.length,
  };
}
