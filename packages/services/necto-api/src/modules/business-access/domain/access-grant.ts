/** The two things a person can be in a business: its administrator (boss) or an operator of one of its modules. */
export type AccessRole = 'admin' | 'operator';

/**
 * One thing a signed-in person may enter right now: a business in a role. An email can hold several (it can be the
 * boss of one business, an operator of another, and both in the same one). It is decided from the data as it is at this
 * moment, never from the token.
 */
export interface AccessGrant {
  /** Stable key of the choice: `<businessId>:<role>`. */
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
}

export const grantKey = (businessId: string, role: AccessRole): string => `${businessId}:${role}`;
