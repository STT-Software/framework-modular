import { Injectable } from '@nestjs/common';
import { AdministeredBusinessProfiles } from '../../businesses/public';
import { suggestedProfileFor, TURNOS_MODULE_ID, TURNOS_PROFILES, type TurnosProfileId } from '../domain/catalog';
import { TurnosBusinessNotFoundError, TurnosNotEnabledError } from '../domain/errors';
import { changeProfile } from '../domain/operations';
import { TurnosBaseSetup, type TurnosProfileOption, type TurnosSetupStatus } from '../domain/turnos-base-setup';
import { TurnosConfigurationStore } from './turnos-configuration.store';

/** What the base setup of a business needs from Turnos: the attention profile (the same field the first step of Turnos edits) and its status. */
@Injectable()
export class TurnosBaseSetupService extends TurnosBaseSetup {
  constructor(
    private readonly store: TurnosConfigurationStore,
    private readonly businesses: AdministeredBusinessProfiles,
  ) {
    super();
  }

  options(): readonly TurnosProfileOption[] {
    return TURNOS_PROFILES.map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      suggestedQueues: profile.queues,
    }));
  }

  suggestedFor(category: string): TurnosProfileId {
    return suggestedProfileFor(category);
  }

  async current(businessId: string, category: string): Promise<TurnosProfileId> {
    return (await this.store.find(businessId))?.profile ?? suggestedProfileFor(category);
  }

  async choose(adminEmail: string, businessId: string, profile: TurnosProfileId): Promise<TurnosProfileId> {
    const business = await this.businesses.find(adminEmail, businessId);
    if (!business) throw new TurnosBusinessNotFoundError();
    if (!business.modules.includes(TURNOS_MODULE_ID)) throw new TurnosNotEnabledError();
    const saved = await this.store.update(businessId, (config, now) => changeProfile(config, profile, false, now));
    return saved.profile ?? profile;
  }

  async statusOf(businessId: string): Promise<TurnosSetupStatus> {
    const config = await this.store.find(businessId);
    return { ready: config?.readyAt != null, queueCount: config?.queues.length ?? 0, operatorCount: config?.operators.length ?? 0 };
  }
}
