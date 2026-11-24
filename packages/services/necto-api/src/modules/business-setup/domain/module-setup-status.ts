/**
 * Readiness status and numeric summary that a functional module (pedidos, reservas...) reports to the business setup
 * overview. Kept intentionally generic so `business-setup` never has to import each functional module directly.
 */
export interface ModuleSetupStatus {
  ready: boolean;
  summary?: Record<string, number> | null;
}

/**
 * Implemented by a functional module that tracks its own configuration status. It registers itself in
 * `ModuleSetupStatusRegistry` on module init so `business-setup` stays free of circular dependencies.
 */
export abstract class ModuleSetupStatusSource {
  abstract readonly moduleId: string;
  abstract statusOf(businessId: string): Promise<ModuleSetupStatus>;
}
