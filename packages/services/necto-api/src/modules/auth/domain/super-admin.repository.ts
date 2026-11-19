import type { DuplicateField } from './errors';
import type { NewSuperAdmin, SuperAdmin } from './super-admin';

/** What the auth module needs to persist super admins. Implemented in `infrastructure/`. */
export abstract class SuperAdminRepository {
  /** @throws DuplicateSuperAdminError if the username, the email or the identity document already exist. */
  abstract create(data: NewSuperAdmin): Promise<SuperAdmin>;

  abstract findById(id: string): Promise<SuperAdmin | null>;

  /**
   * Finds by email or by username. The username cannot contain "@" (validated on registration), so an
   * identifier containing "@" is always an email. The identifier must already be normalized (trimmed, lowercase).
   */
  abstract findByIdentifier(identifier: string): Promise<SuperAdmin | null>;

  /**
   * Which unique value of the candidate is already taken by an existing super admin, or null if none is. A quick
   * check before sending a code; `create` stays the final word (unique indexes) when the account is really made.
   */
  abstract findTakenField(
    candidate: Pick<NewSuperAdmin, 'username' | 'email' | 'identityDocumentType' | 'identityDocument'>,
  ): Promise<DuplicateField | null>;
}
