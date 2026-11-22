import type { PedidosConfiguration } from './configuration';

/** Persistence port for Pedidos business configurations (one atomically versioned document per business). */
export abstract class PedidosConfigurationRepository {
  abstract findByBusinessId(businessId: string): Promise<PedidosConfiguration | null>;
  /** Every configuration (across all businesses) containing an operator with the given normalized email. */
  abstract findByOperatorEmail(email: string): Promise<PedidosConfiguration[]>;
  /** Stores a new configuration; if another request inserted first, returns the existing one. */
  abstract insert(config: PedidosConfiguration): Promise<PedidosConfiguration>;
  /**
   * Replaces the stored configuration only if its current version matches `expectedVersion`, incrementing the version.
   * Returns the saved configuration, or `null` on version mismatch.
   */
  abstract replace(expectedVersion: number, next: PedidosConfiguration): Promise<PedidosConfiguration | null>;
}
