import { Injectable } from '@nestjs/common';
import { TURNOS_MODULE_ID } from '../../turnos/public';
import { BusinessSetupOverview, type SetupOverview } from '../domain/setup-overview';
import { BusinessSetupService } from './business-setup.service';
import { ModuleSetupStatusRegistry } from './module-setup-status.registry';
@Injectable()
export class BusinessSetupOverviewService extends BusinessSetupOverview {
  constructor(
    private readonly setup: BusinessSetupService,
    private readonly registry: ModuleSetupStatusRegistry,
  ) {
    super();
  }
  async overviewOf(adminEmail: string, businessId: string): Promise<SetupOverview> {
    const state = await this.setup.get(adminEmail, businessId);
    return {
      business: {
        id: state.business.id,
        name: state.business.name,
        category: state.business.category,
        categoryOther: state.business.categoryOther,
        status: state.business.status,
        timezone: state.timezone,
      },
      baseReady: state.progress.baseReady,
      baseReadyAt: state.progress.baseReadyAt,
      modules: state.modules.map((module) => ({
        id: module.id,
        name: module.name,
        description: module.description,
        configurable: module.id === TURNOS_MODULE_ID || this.registry.has(module.id),
        settings: module.settings,
        openNow: module.openNow,
      })),
    };
  }
}
