import type { SuggestedQueue, TurnosProfileId } from './catalog';

export interface TurnosProfileOption {
  id: TurnosProfileId;
  name: string;
  description: string;
  suggestedQueues: readonly SuggestedQueue[];
}

/** How far the Turnos configuration of a business is, for the card of the module in the base setup. */
export interface TurnosSetupStatus {
  /** Saved as ready: at least one queue and valid rules, and nothing changed since. */
  ready: boolean;
  queueCount: number;
  operatorCount: number;
}

/**
 * Public contract of the Turnos module for the base setup of a business. The attention profile is chosen in the base setup
 * (step "Tipo de negocio") but belongs to Turnos, which is the only place it is stored and the only one that knows what each
 * profile suggests; the base setup also shows whether Turnos is ready. Every call that changes something names the
 * administrator by email and succeeds only if that person is, at this very moment, the current boss of an ACTIVE business that
 * has Turnos enabled.
 */
export abstract class TurnosBaseSetup {
  abstract options(): readonly TurnosProfileOption[];
  /** The profile of the business: the chosen one, or the one the category suggests. Reading creates nothing. */
  abstract current(businessId: string, category: string): Promise<TurnosProfileId>;
  /** The profile that a category suggests, for showing it as the default. */
  abstract suggestedFor(category: string): TurnosProfileId;
  /**
   * Chooses the profile. Nothing the person already configured in Turnos is lost or duplicated (see `changeProfile`).
   * @throws TurnosBusinessNotFoundError, TurnosNotEnabledError
   */
  abstract choose(adminEmail: string, businessId: string, profile: TurnosProfileId): Promise<TurnosProfileId>;
  /** Reading creates nothing: a business whose Turnos was never opened is not ready, with no queues or operators. */
  abstract statusOf(businessId: string): Promise<TurnosSetupStatus>;
}
