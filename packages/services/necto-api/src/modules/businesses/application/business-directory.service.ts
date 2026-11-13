import { Injectable } from '@nestjs/common';
import type { Business } from '../domain/business';
import { BusinessDirectory, BusinessModuleAccess, type BusinessAccessView } from '../domain/business-directory';
import { BusinessRepository } from '../domain/business.repository';
import type { BusinessModuleId } from '../domain/catalog';

function toView(business: Business): BusinessAccessView {
  return {
    id: business.id,
    ownerId: business.ownerId,
    name: business.name,
    status: business.status,
    modules: business.modules,
    boss: { assignmentId: business.boss.assignmentId, name: business.boss.name, email: business.boss.email },
  };
}

/** The public contracts of the businesses module, built on its own repository. */
@Injectable()
export class BusinessDirectoryService extends BusinessDirectory {
  constructor(private readonly businesses: BusinessRepository) {
    super();
  }

  async findOwned(ownerId: string, businessId: string): Promise<BusinessAccessView | null> {
    const business = await this.businesses.findOwned(ownerId, businessId);
    return business ? toView(business) : null;
  }

  async find(businessId: string): Promise<BusinessAccessView | null> {
    const business = await this.businesses.findById(businessId);
    return business ? toView(business) : null;
  }
}

@Injectable()
export class BusinessModuleAccessService extends BusinessModuleAccess {
  constructor(private readonly businesses: BusinessRepository) {
    super();
  }

  async isEnabled(businessId: string, moduleId: BusinessModuleId): Promise<boolean> {
    const business = await this.businesses.findById(businessId);
    return business !== null && business.status === 'active' && business.modules.includes(moduleId);
  }
}
