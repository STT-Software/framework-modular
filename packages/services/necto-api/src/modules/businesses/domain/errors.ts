import { DomainError } from '../../../platform/errors/domain-error';

export class BusinessNotFoundError extends DomainError {
  readonly kind = 'not-found';

  constructor() {
    super('Business not found');
  }
}

/** The same Idempotency-Key was used for a different request. */
export class IdempotencyKeyReusedError extends DomainError {
  readonly kind = 'conflict';

  constructor() {
    super('That Idempotency-Key was already used with a different request');
  }
}

/** Someone changed the business between reading it and saving the edit. */
export class ConcurrentModificationError extends DomainError {
  readonly kind = 'conflict';

  constructor() {
    super('The business was changed by someone else; reload it and try again');
  }
}
