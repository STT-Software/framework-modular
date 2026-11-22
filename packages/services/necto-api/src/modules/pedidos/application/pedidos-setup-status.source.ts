import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  ModuleSetupStatusRegistry,
  ModuleSetupStatusSource,
  type ModuleSetupStatus,
} from '../../business-setup/public';
import { PEDIDOS_MODULE_ID } from '../domain/catalog';
import { PedidosConfigurationRepository } from '../domain/pedidos-configuration.repository';

/**
 * Reports Pedidos readiness and numeric summary to `business-setup` via IoC registration (`pedidos -> business-setup`)
 * so `business-setup` displays live Pedidos status without importing the `pedidos` module.
 */
@Injectable()
export class PedidosSetupStatusSource extends ModuleSetupStatusSource implements OnModuleInit {
  readonly moduleId = PEDIDOS_MODULE_ID;

  constructor(
    private readonly configurations: PedidosConfigurationRepository,
    private readonly registry: ModuleSetupStatusRegistry,
  ) {
    super();
  }

  onModuleInit(): void {
    this.registry.register(this);
  }

  async statusOf(businessId: string): Promise<ModuleSetupStatus> {
    const config = await this.configurations.findByBusinessId(businessId);
    return {
      ready: config?.readyAt != null,
      summary: {
        modalityCount: config?.modalities.length ?? 0,
        operatorCount: config?.operators.length ?? 0,
      },
    };
  }
}
