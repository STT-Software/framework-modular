import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import type { TurnosConfiguration } from '../domain/configuration';
import { ConcurrentTurnosChangeError } from '../domain/errors';
import { newConfiguration } from '../domain/operations';
import { TurnosConfigurationRepository } from '../domain/turnos-configuration.repository';

const MAX_ATTEMPTS = 5;

/**
 * Reads and changes the configuration of a business as ONE write that is checked against the version that was read: if
 * somebody else wrote in between, the change is calculated again over what they wrote (up to a few times) instead of
 * overwriting it. That is what makes a change that touches queues and operators together consistent.
 */
@Injectable()
export class TurnosConfigurationStore {
  constructor(
    private readonly configurations: TurnosConfigurationRepository,
    private readonly clock: Clock,
  ) {}

  find(businessId: string): Promise<TurnosConfiguration | null> {
    return this.configurations.find(businessId);
  }

  /**
   * Applies `change` to the stored configuration (creating an empty one the first time). `change` returns the same object when
   * there is nothing to save. A domain error thrown by `change` aborts without writing anything.
   */
  async update(businessId: string, change: (current: TurnosConfiguration, now: Date) => TurnosConfiguration): Promise<TurnosConfiguration> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const now = this.clock.now();
      const stored = (await this.configurations.find(businessId)) ?? (await this.configurations.insert(newConfiguration(businessId, now)));
      const next = change(stored, now);
      if (next === stored) return stored;
      const saved = await this.configurations.replace(stored.version, next);
      if (saved) return saved;
    }
    throw new ConcurrentTurnosChangeError();
  }
}
