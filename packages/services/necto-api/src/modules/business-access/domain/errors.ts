import { DomainError } from '../../../platform/errors/domain-error';

/**
 * Wrong, expired, used, revoked, locked, or for an email with no business: all answer the same, so the
 * response never tells an attacker which of those it was, or whether the email is assigned at all.
 */
export class InvalidAccessCodeError extends DomainError {
  readonly kind = 'unauthenticated';

  constructor() {
    super('Invalid or expired code');
  }
}

export class TooManyRequestsError extends DomainError {
  readonly kind = 'rate-limited';

  constructor(override readonly retryAfterSeconds: number) {
    super('Too many requests: wait a moment and try again');
  }
}

/** The business is not one of the caller's (or does not exist): the same answer for both. */
export class InvitationBusinessNotFoundError extends DomainError {
  readonly kind = 'not-found';

  constructor() {
    super('Business not found');
  }
}

export class InvitationNotAvailableError extends DomainError {
  readonly kind = 'conflict';

  constructor() {
    super('The business is paused: resume it first');
  }
}

/** An invitation was sent a moment ago. */
export class InvitationTooSoonError extends DomainError {
  readonly kind = 'rate-limited';

  constructor(override readonly retryAfterSeconds: number) {
    super('An invitation was sent very recently: wait a moment before sending another');
  }
}

/**
 * The email is not the current boss of any active business, so there is nobody to send a code to. The access page tells
 * the person that the owner of a business must invite them first.
 *
 * This answer does reveal whether an email is assigned (the public sign-in used to answer the same for everyone). It is
 * a product decision; the per-email and per-IP request limits still apply, and it is the one place to change if the
 * generic answer must come back.
 */
export class EmailNotAssignedError extends DomainError {
  readonly kind = 'not-found';
  override readonly code = 'email-not-assigned';
  constructor() {
    super('This email is not assigned to any active business: the owner of a business must invite it first');
  }
}

/** There is no valid session: it never existed, ended, expired or was signed out. The person must verify the email again. */
export class SessionExpiredError extends DomainError {
  readonly kind = 'unauthenticated';
  override readonly code = 'session-expired';
  constructor() {
    super('The session has ended: verify your email again');
  }
}

/** A sensitive action needs a code confirmed a moment ago, and the last one is older. */
export class ReverificationRequiredError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'reverification-required';
  constructor() {
    super('This action needs a recent verification: confirm your email with a new code');
  }
}

/** The business is not one the signed-in person administers right now (unknown, paused, or someone else's): same answer for all. */
export class BusinessNotAdministeredError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Business not found');
  }
}

/** The person administers the business, but it does not have this functionality enabled. */
export class ModuleNotEnabledError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'module-not-enabled';
  constructor() {
    super('This functionality is not enabled for the business');
  }
}
