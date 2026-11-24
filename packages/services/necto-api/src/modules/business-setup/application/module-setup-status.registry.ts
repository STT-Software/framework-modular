import { Injectable } from '@nestjs/common';
import { ModuleSetupStatusSource, type ModuleSetupStatus } from '../domain/module-setup-status';

/**
 * Registry where functional modules announce how to query their configuration status. A module registers once on
 * startup; `BusinessSetupService` queries it when assembling the setup overview so `business-setup` does not import
 * functional modules directly.
 */
@Injectable()
export class ModuleSetupStatusRegistry {
  private readonly sources = new Map<string, ModuleSetupStatusSource>();

  register(source: ModuleSetupStatusSource): void {
    this.sources.set(source.moduleId, source);
  }

  async statusOf(moduleId: string, businessId: string): Promise<ModuleSetupStatus | null> {
    const source = this.sources.get(moduleId);
    if (!source) return null;
    return source.statusOf(businessId);
  }
}
