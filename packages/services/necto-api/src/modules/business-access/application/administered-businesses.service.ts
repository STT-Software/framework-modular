import { Injectable } from '@nestjs/common';
import { BusinessDirectory, BusinessModuleAccess, type BusinessAccessView, type BusinessModuleId } from '../../businesses/public';
import { BusinessNotAdministeredError, ModuleNotEnabledError } from '../domain/errors';

/** A business as the administrator sees it: what they need to choose it and know what they can open. */
export interface AdministeredBusiness {
  id: string;
  name: string;
  category: string;
  /** The free text of the category, only when it is "other". */
  categoryOther: string | null;
  /** Enabled functionalities. */
  modules: readonly string[];
}

function toAdministered(view: BusinessAccessView): AdministeredBusiness {
  return { id: view.id, name: view.name, category: view.category, categoryOther: view.categoryOther, modules: view.modules };
}

/**
 * Which businesses a signed-in administrator may enter, decided from the data as it is RIGHT NOW: the person must
 * be the current boss of the business, and the business must be active. Nothing here comes from the token or from
 * what was true when the person signed in, so pausing a business or replacing its boss closes the door at once.
 */
@Injectable()
export class AdministeredBusinessesService {
  constructor(
    private readonly directory: BusinessDirectory,
    private readonly modules: BusinessModuleAccess,
  ) {}

  /** Only the authorized businesses: an active one whose current boss has this email. */
  async list(email: string): Promise<AdministeredBusiness[]> {
    return (await this.directory.findActiveByBossEmail(email)).map(toAdministered);
  }

  /** The name the person is known by in their active businesses, or null if they administer none. */
  async person(email: string): Promise<{ name: string } | null> {
    const [first] = await this.directory.findActiveByBossEmail(email);
    return first ? { name: first.boss.name } : null;
  }

  /** One authorized business. Unknown, paused, someone else's and "not yours" all answer the same. */
  async get(email: string, businessId: string): Promise<AdministeredBusiness> {
    const business = await this.directory.find(businessId);
    if (!business || business.status !== 'active' || business.boss.email !== email) throw new BusinessNotAdministeredError();
    return toAdministered(business);
  }

  /** The business must be authorized AND have the functionality enabled (the server decides, not the interface). */
  async requireModule(email: string, businessId: string, moduleId: string): Promise<AdministeredBusiness> {
    const business = await this.get(email, businessId);
    if (!(await this.modules.isEnabled(businessId, moduleId as BusinessModuleId))) throw new ModuleNotEnabledError();
    return business;
  }
}
