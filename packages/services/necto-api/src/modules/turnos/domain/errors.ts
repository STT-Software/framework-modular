import { DomainError } from '../../../platform/errors/domain-error';

/** The business is not one the caller may configure (unknown, paused, someone else's): the same answer for all. */
export class TurnosBusinessNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Business not found');
  }
}

export class QueueNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Queue not found');
  }
}

export class OperatorNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Operator not found');
  }
}

/** The module is not enabled for the business, so there is nothing to configure. */
export class TurnosNotEnabledError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'module-not-enabled';
  constructor() {
    super('This functionality is not enabled for the business');
  }
}

/** Something sent does not follow the rules. `fields` says which field, with dotted paths for nested ones. */
export class TurnosInvalidError extends DomainError {
  readonly kind = 'invalid';
  override readonly fields: Record<string, string[]>;
  constructor(
    override readonly code: 'invalid-rules' | 'invalid-queue' | 'invalid-operator' | 'invalid-profile' | 'invalid-request',
    fields: Record<string, string[]>,
  ) {
    super('The request is not valid');
    this.fields = fields;
  }
}

/** Deleting this queue would leave operators without any queue and the request did not say where they go. */
export class ReassignmentRequiredError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'reassignment-required';
  override readonly fields: Record<string, string[]>;
  constructor(fields: Record<string, string[]>) {
    super('Some operators would be left without a queue: choose another queue for each of them');
    this.fields = fields;
  }
}

/** It is the only queue of the business and it has operators, so there is nowhere to move them. */
export class OnlyQueueWithOperatorsError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'queue-has-operators';
  constructor() {
    super('This is the only queue and it has operators: create another queue first, or remove those operators');
  }
}

/** The configuration cannot be saved as ready yet. */
export class TurnosIncompleteError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'turnos-incomplete';
  override readonly fields: Record<string, string[]>;
  constructor(fields: Record<string, string[]>) {
    super('The Turnos configuration is not complete');
    this.fields = fields;
  }
}

/** Someone changed the configuration at the same time and the retries ran out. */
export class ConcurrentTurnosChangeError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'concurrent-change';
  constructor() {
    super('The configuration was changed at the same time; reload it and try again');
  }
}
