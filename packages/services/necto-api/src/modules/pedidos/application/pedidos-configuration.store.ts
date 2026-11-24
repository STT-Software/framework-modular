import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { newPedidosConfiguration, type PedidosConfiguration } from '../domain/configuration';
import { ConcurrentPedidosChangeError } from '../domain/errors';
import { PedidosConfigurationRepository } from '../domain/pedidos-configuration.repository';

const MAX_ATTEMPTS = 5;

/**
 * Reads and updates the Pedidos configuration of a business using optimistic concurrency (`version`): if another
 * request wrote concurrently, the pure transformation is recomputed on the latest state up to `MAX_ATTEMPTS` times.
 */
@Injectable()
export class PedidosConfigurationStore {
  constructor(
    private readonly configurations: PedidosConfigurationRepository,
    private readonly clock: Clock,
  ) {}

  findByBusinessId(businessId: string): Promise<PedidosConfiguration | null> {
    return this.configurations.findByBusinessId(businessId);
  }

  /**
   * Applies `change` to the stored configuration (inserting a fresh shell on first access).
   * Returning the exact same object reference avoids writing when nothing changed.
   */
  async update(
    businessId: string,
    change: (current: PedidosConfiguration, now: Date) => PedidosConfiguration,
  ): Promise<PedidosConfiguration> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const now = this.clock.now();
      const stored =
        (await this.configurations.findByBusinessId(businessId)) ??
        (await this.configurations.insert(newPedidosConfiguration(businessId, now)));
      const next = change(stored, now);
      if (next === stored) return stored;
      const saved = await this.configurations.replace(stored.version, next);
      if (saved) return saved;
    }
    throw new ConcurrentPedidosChangeError();
  }
}
