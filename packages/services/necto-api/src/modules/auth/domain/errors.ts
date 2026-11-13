import { DomainError } from '../../../platform/errors/domain-error';

/** Which unique value was already taken. */
export type DuplicateField = 'identity document' | 'username' | 'email' | 'value';

export class DuplicateSuperAdminError extends DomainError {
  readonly kind = 'conflict';

  constructor(readonly field: DuplicateField) {
    super(`A super admin with that ${field} already exists`);
  }
}

/** Same error for "no such user" and "wrong password", so a login cannot be used to find out which users exist. */
export class InvalidCredentialsError extends DomainError {
  readonly kind = 'unauthenticated';

  constructor() {
    super('Invalid credentials');
  }
}

export class SuperAdminNotFoundError extends DomainError {
  readonly kind = 'not-found';

  constructor() {
    super('Super admin not found');
  }
}
