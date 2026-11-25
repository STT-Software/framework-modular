import { Injectable } from '@nestjs/common';
import type { Business } from '../domain/business';
import {
  AdministeredBusinessProfiles,
  type AdministeredBusinessProfile,
  type CategoryChange,
  type ContactChange,
} from '../domain/business-profile-editing';
import { BusinessRepository } from '../domain/business.repository';

function toProfile(business: Business): AdministeredBusinessProfile {
  return {
    id: business.id,
    name: business.name,
    legalName: business.legalName,
    taxId: business.taxId,
    phone: business.phone,
    address: business.address,
    supportEmail: business.supportEmail,
    website: business.website,
    category: business.category,
    categoryOther: business.categoryOther,
    currency: business.currency,
    timezone: business.timezone,
    modules: [...business.modules],
    status: business.status,
    boss: {
      name: business.boss.name,
      email: business.boss.email,
    },
  };
}

/** What the administrator of a business may read and correct of it, always on the owner's business document. */
@Injectable()
export class AdministeredBusinessProfilesService extends AdministeredBusinessProfiles {
  constructor(private readonly businesses: BusinessRepository) {
    super();
  }

  async find(bossEmail: string, businessId: string): Promise<AdministeredBusinessProfile | null> {
    const business = await this.businesses.findAdministered(bossEmail, businessId);
    return business ? toProfile(business) : null;
  }

  async updateContact(bossEmail: string, businessId: string, change: ContactChange): Promise<AdministeredBusinessProfile | null> {
    const business = await this.businesses.updateAdministered(bossEmail, businessId, {
      name: change.name,
      legalName: change.legalName,
      taxId: change.taxId,
      phone: change.phone,
      address: change.address,
      supportEmail: change.supportEmail,
      website: change.website,
    });
    return business ? toProfile(business) : null;
  }

  async updateCategory(bossEmail: string, businessId: string, change: CategoryChange): Promise<AdministeredBusinessProfile | null> {
    const business = await this.businesses.updateAdministered(bossEmail, businessId, {
      category: change.category,
      // "Other" is the only category that keeps its own text.
      categoryOther: change.category === 'other' ? change.categoryOther : null,
    });
    return business ? toProfile(business) : null;
  }
}
