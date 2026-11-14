import type { Business } from '../domain/business';

/**
 * What the API shows of a business: the saved data and its current boss. Never idempotency data, history
 * of replaced bosses or anything about access codes. `summary` is empty on purpose: there is no activity yet
 * (no billing, ratings or charts are invented), so the frontend gets an explicit "no data" state.
 */
export function toBusinessResponse(business: Business) {
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
    modules: business.modules,
    status: business.status,
    boss: {
      name: business.boss.name,
      email: business.boss.email,
      assignedAt: business.boss.assignedAt.toISOString(),
    },
    summary: { hasActivity: false },
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}
