import { Injectable } from '@nestjs/common';
import { BusinessDirectory, BusinessModuleAccess } from '../../businesses/public';
import { grantKey, type AccessGrant } from '../domain/access-grant';
import { BusinessNotAdministeredError } from '../domain/errors';
import { MemberAccessRegistry } from './member-access.registry';

/**
 * Everything a person may enter, decided from the data as it is RIGHT NOW:
 * - as administrator: the active businesses whose current boss has this email;
 * - as operator: the assignments the modules report, but only while the business is active and still has that module.
 * Pausing a business, replacing its boss, disabling a module or removing an operator closes the door on the next request.
 */
@Injectable()
export class AccessGrantsService {
  constructor(
    private readonly directory: BusinessDirectory,
    private readonly modules: BusinessModuleAccess,
    private readonly registry: MemberAccessRegistry,
  ) {}

  /** Administrator grants first (oldest business first), then operator grants by business name. */
  async list(email: string): Promise<AccessGrant[]> {
    const [admin, operator] = await Promise.all([this.adminGrants(email), this.operatorGrants(email)]);
    return [...admin, ...operator];
  }

  /** The name to greet the person with: their name as boss if they are one, otherwise as an operator. Null without any access. */
  async person(email: string): Promise<{ name: string } | null> {
    const [first] = await this.list(email);
    return first ? { name: first.personName } : null;
  }

  /** The operator grant for this business and module, or "not found" (the same answer as for a business that is not theirs). */
  async requireOperator(email: string, businessId: string, moduleId: string): Promise<AccessGrant> {
    const grant = (await this.operatorGrants(email)).find((item) => item.businessId === businessId && item.modules.includes(moduleId));
    if (!grant) throw new BusinessNotAdministeredError();
    return grant;
  }

  private async adminGrants(email: string): Promise<AccessGrant[]> {
    const businesses = await this.directory.findActiveByBossEmail(email);
    return businesses.map((business) => ({
      key: grantKey(business.id, 'admin'),
      businessId: business.id,
      businessName: business.name,
      category: business.category,
      categoryOther: business.categoryOther,
      role: 'admin' as const,
      modules: [...business.modules],
      personName: business.boss.name,
    }));
  }

  private async operatorGrants(email: string): Promise<AccessGrant[]> {
    const assignments = await this.registry.assignmentsOf(email);
    const byBusiness = new Map<string, { modules: Set<string>; personName: string }>();
    for (const assignment of assignments) {
      if (assignment.role !== 'operator') continue;
      if (!(await this.modules.isEnabled(assignment.businessId, assignment.moduleId as never))) continue;
      const entry = byBusiness.get(assignment.businessId) ?? { modules: new Set<string>(), personName: assignment.personName };
      entry.modules.add(assignment.moduleId);
      byBusiness.set(assignment.businessId, entry);
    }
    const grants: AccessGrant[] = [];
    for (const [businessId, entry] of byBusiness) {
      const business = await this.directory.find(businessId);
      if (!business || business.status !== 'active') continue;
      grants.push({
        key: grantKey(businessId, 'operator'),
        businessId,
        businessName: business.name,
        category: business.category,
        categoryOther: business.categoryOther,
        role: 'operator',
        modules: [...entry.modules].sort(),
        personName: entry.personName,
      });
    }
    return grants.sort((a, b) => a.businessName.localeCompare(b.businessName) || a.businessId.localeCompare(b.businessId));
  }
}
