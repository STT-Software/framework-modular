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

/** The code does not match. The try is counted. */
export class InvalidRegistrationCodeError extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'invalid-code';
  constructor() {
    super('The code is not correct');
  }
}

/** The code expired, or the pending registration no longer exists (unknown id, already used): register again. */
export class RegistrationCodeExpiredError extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'code-expired';
  constructor() {
    super('The code has expired: start the registration again');
  }
}

/** Too many wrong tries against this code: it no longer works. A new code can be requested. */
export class TooManyRegistrationAttemptsError extends DomainError {
  readonly kind = 'rate-limited';
  override readonly code = 'too-many-attempts';
  constructor() {
    super('Too many wrong codes: request a new code');
  }
}

/** Too many codes were emailed to this address lately: registrations and resends wait until the window ends. */
export class TooManyRegistrationCodesError extends DomainError {
  readonly kind = 'rate-limited';
  override readonly code = 'too-many-codes';
  constructor(override readonly retryAfterSeconds: number) {
    super('Too many codes were sent to this email: try again later');
  }
}

/** A new code was sent a moment ago. */
export class RegistrationResendTooSoonError extends DomainError {
  readonly kind = 'rate-limited';
  override readonly code = 'resend-too-soon';
  constructor(override readonly retryAfterSeconds: number) {
    super('A code was sent very recently: wait a moment before requesting another');
  }
}
