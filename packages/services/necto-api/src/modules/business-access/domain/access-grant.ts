/** The two things a person can be in a business: its administrator (boss) or an operator of one of its modules. */
export type AccessRole = 'admin' | 'operator';

/**
 * One thing a signed-in person may enter right now: a business in a role. An email can hold several (it can be the
 * boss of one business, an operator of another, and both in the same one — or operate multiple modules in the same
 * business). It is decided from the data as it is at this moment, never from the token.
 */
export interface AccessGrant {
  /** Stable key of the choice: `<businessId>:admin` or `<businessId>:operator:<moduleId>`. */
  key: string;
  businessId: string;
  businessName: string;
  category: string;
  /** The free text of the category, only when it is "other". */
  categoryOther: string | null;
  role: AccessRole;
  /** An administrator: the modules enabled for the business. An operator: only the module they are assigned to. */
  modules: readonly string[];
  /** The name the business knows the person by in that role. */
  personName: string;
  /**
   * An operator: the views of the module they may use right now (in the order to offer them) and the one to open first, so they
   * go straight to their module without passing through the general dashboard. Null for an administrator.
   */
  views: readonly string[] | null;
  firstView: string | null;
  /** An operator who is assigned but cannot operate yet (pending): they can sign in, no operator route lets them in. Always true for an administrator. */
  operable: boolean;
}

export function grantKey(businessId: string, role: 'admin'): string;
export function grantKey(businessId: string, role: 'operator', moduleId: string): string;
export function grantKey(businessId: string, role: AccessRole, moduleId?: string): string {
  return role === 'operator' && moduleId ? `${businessId}:operator:${moduleId}` : `${businessId}:${role}`;
}
