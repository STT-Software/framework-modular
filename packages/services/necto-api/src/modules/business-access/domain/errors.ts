import { DomainError } from '../../../platform/errors/domain-error';

/**
 * Wrong, expired, used, revoked, locked, for another business or for a replaced boss: all answer the same,
 * so the response never tells an attacker which of those it was, or whether the email is assigned at all.
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
    super('The business is paused: resume it before sending a new invitation');
  }
}

/** An invitation was sent a moment ago. */
export class InvitationTooSoonError extends DomainError {
  readonly kind = 'rate-limited';

  constructor(override readonly retryAfterSeconds: number) {
    super('An invitation was sent very recently: wait a moment before sending another');
  }
}
