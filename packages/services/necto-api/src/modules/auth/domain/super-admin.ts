/** CC: cédula de ciudadanía, CE: cédula de extranjería, PA: pasaporte, NIT: número de identificación tributaria. */
export const IDENTITY_DOCUMENT_TYPES = ['CC', 'CE', 'PA', 'NIT'] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

/**
 * SuperAdmin: the account that manages the whole platform. It is independent from a business admin
 * (which will have its own login). Uniqueness rules, enforced when saving: `username` and `email` are
 * unique, and the identity document is unique together with its type (a CC and a passport can share a number).
 */
export interface SuperAdmin {
  id: string;
  username: string;
  email: string;
  /** bcrypt hash of the password. The password is never stored or returned in plain text. */
  passwordHash: string;
  identityDocumentType: IdentityDocumentType;
  identityDocument: string;
  /** When the user accepted the terms and conditions while registering. */
  termsAcceptedAt: Date;
}

export type NewSuperAdmin = Omit<SuperAdmin, 'id'>;
