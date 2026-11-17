import type { BusinessStatus } from './business';
import type { BusinessCategoryId, BusinessModuleId } from './catalog';

/** What other modules may know about a business. It is a view, not the persisted business. */
export interface BusinessAccessView {
  id: string;
  ownerId: string;
  name: string;
  status: BusinessStatus;
  category: BusinessCategoryId;
  /** Only when the category is "other". */
  categoryOther: string | null;
  modules: readonly BusinessModuleId[];
  boss: {
    assignmentId: string;
    name: string;
    email: string;
  };
}

/** Public contract of the businesses module for the modules that need to look a business up. */
export abstract class BusinessDirectory {
  /** The business if it exists AND belongs to that super admin; otherwise null (never reveals other owners' businesses). */
  abstract findOwned(ownerId: string, businessId: string): Promise<BusinessAccessView | null>;

  abstract find(businessId: string): Promise<BusinessAccessView | null>;
  /**
   * The ACTIVE businesses whose current boss has this email (already normalized), oldest first. A paused business
   * and a replaced boss never appear: this is what decides which businesses a signed-in administrator may enter.
   */
  abstract findActiveByBossEmail(email: string): Promise<BusinessAccessView[]>;
}

/** Public contract to check whether a business has a functionality enabled. Authorization is decided here, on the server. */
export abstract class BusinessModuleAccess {
  /** True only if the business exists, is active and has that module enabled. */
  abstract isEnabled(businessId: string, moduleId: BusinessModuleId): Promise<boolean>;
}
