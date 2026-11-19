import type { TurnosConfiguration } from './configuration';

/** What the Turnos module needs to persist the configuration of a business (one document per business). */
export abstract class TurnosConfigurationRepository {
  abstract find(businessId: string): Promise<TurnosConfiguration | null>;
  /** Stores a new configuration. If another request created it first, returns that one. */
  abstract insert(config: TurnosConfiguration): Promise<TurnosConfiguration>;
  /**
   * Saves `next` only if the stored configuration still has `expectedVersion`, and raises its version by one. Returns the
   * saved configuration, or null if somebody changed it in the meantime.
   */
  abstract replace(expectedVersion: number, next: TurnosConfiguration): Promise<TurnosConfiguration | null>;
  /** Every configuration (of any business) that has an operator with this email (already normalized). */
  abstract findByOperatorEmail(email: string): Promise<TurnosConfiguration[]>;
}
