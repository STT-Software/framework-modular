import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { BusinessSetupOverview } from '../../business-setup/public';
import { TURNOS_MODULE_ID, TurnosDashboard } from '../../turnos/public';
import { setupProgress, type Dashboard, type DashboardModule } from '../domain/dashboard';
/**
 * The general dashboard of a business, for its administrator. It only shows what is really assigned to the business and the real state of
 * each part: the setup (from business-setup), and, for the modules that already run, their own indicators (counted from their data).
 * Modules that are assigned but do not run yet appear with their assignment and state, and nothing else.
 */
@Injectable()
export class BusinessDashboardService {
  constructor(
    private readonly setup: BusinessSetupOverview,
    private readonly turnos: TurnosDashboard,
    private readonly clock: Clock,
  ) {}
  async get(adminEmail: string, businessId: string): Promise<Dashboard> {
    const overview = await this.setup.overviewOf(adminEmail, businessId);
    const progress = setupProgress(overview);
    const modules: DashboardModule[] = await Promise.all(
      overview.modules.map(async (module): Promise<DashboardModule> => {
        const operational = module.id === TURNOS_MODULE_ID;
        const ready = module.settings.status === 'ready';
        const turnos = operational && ready ? await this.turnos.summaryOf(businessId) : null;
        return { ...module, operational, indicators: turnos ? { turnos } : null };
      }),
    );
    return {
      entry: progress.entry,
      business: overview.business,
      setup: {
        baseReady: overview.baseReady,
        baseReadyAt: overview.baseReadyAt,
        next: progress.next,
        pendingModules: progress.pendingModules,
        configurableModules: progress.configurableModules,
        readyModules: progress.readyModules,
      },
      modules,
      generatedAt: this.clock.now(),
    };
  }
}
