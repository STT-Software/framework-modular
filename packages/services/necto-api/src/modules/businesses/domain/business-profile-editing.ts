import type { BusinessStatus } from './business';
import type { BusinessCategoryId, BusinessModuleId } from './catalog';

/**
 * A business as its own administrator sees it while setting it up: the data the owner registered, which is the one and only
 * source (nothing is copied elsewhere), and the functionalities the owner enabled.
 */
export interface AdministeredBusinessProfile {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  supportEmail: string | null;
  website: string | null;
  category: BusinessCategoryId;
  /** Only when the category is "other". */
  categoryOther: string | null;
  currency: string;
  timezone: string;
  modules: readonly BusinessModuleId[];
  status: BusinessStatus;
}

/** What an administrator may correct of the contact data. Currency, time zone, modules and boss stay with the owner. */
export interface ContactChange {
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  supportEmail: string | null;
  website: string | null;
}

export interface CategoryChange {
  category: BusinessCategoryId;
  /** Required by the caller's validation when the category is "other"; ignored (stored as null) for any other category. */
  categoryOther: string | null;
}

/**
 * Public contract of the businesses module for the module that sets a business up. Every call names the administrator by
 * email and succeeds only if that person is, at this very moment, the current boss of an ACTIVE business: the check and the
 * write are one atomic operation, so a boss replaced or a business paused a moment ago cannot slip a write through.
 * Anything else (unknown business, someone else's, paused) answers `null`, the same for all of them.
 *
 * It deliberately cannot change the enabled modules, the boss, the status, the currency or the time zone: those belong to the owner.
 */
export abstract class AdministeredBusinessProfiles {
  abstract find(bossEmail: string, businessId: string): Promise<AdministeredBusinessProfile | null>;
  abstract updateContact(bossEmail: string, businessId: string, change: ContactChange): Promise<AdministeredBusinessProfile | null>;
  abstract updateCategory(bossEmail: string, businessId: string, change: CategoryChange): Promise<AdministeredBusinessProfile | null>;
}
