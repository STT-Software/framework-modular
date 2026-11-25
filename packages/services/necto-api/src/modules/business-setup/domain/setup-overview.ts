import type { BusinessModuleId } from '../../businesses/public';
export interface SetupOverviewModule {
  id: BusinessModuleId;
  name: string;
  description: string;
  /**
   * Whether the module has its own configuration that can be completed today. A module that is assigned but whose configuration does not
   * exist yet (it is still to be built) is not configurable: it is listed, but it can never be "ready", so it does not hold the business back.
   */
  configurable: boolean;
  settings: { status: 'pending' | 'ready'; summary: Record<string, number> | null };
  openNow: boolean | null;
}
/** How far the setup of a business is: the base configuration and the settings of each module assigned to it. */
export interface SetupOverview {
  business: { id: string; name: string; category: string; categoryOther: string | null; status: string; timezone: string };
  baseReady: boolean;
  baseReadyAt: Date | null;
  modules: SetupOverviewModule[];
}
/**
 * Public contract of the base setup for modules that need to know how far it is (the general dashboard): the real state, read at this moment.
 * It is for the CURRENT BOSS of the business only: anybody else gets "not found".
 */
export abstract class BusinessSetupOverview {
  abstract overviewOf(adminEmail: string, businessId: string): Promise<SetupOverview>;
}
