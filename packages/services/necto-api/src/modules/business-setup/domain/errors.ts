import { DomainError } from '../../../platform/errors/domain-error';

/** The business is not one the signed-in administrator administers right now (unknown, paused, someone else's): same answer for all. */
export class SetupBusinessNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Business not found');
  }
}

/** The administrator administers the business, but the owner did not assign it that functionality. */
export class ModuleNotAssignedError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'module-not-enabled';
  constructor() {
    super('This functionality is not enabled for the business');
  }
}

/** A schedule that does not follow the rules: incomplete ranges, a closing before the opening, overlaps... */
export class InvalidScheduleError extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'invalid-schedule';
  constructor(override readonly fields: Record<string, string[]>) {
    super('The schedule is not valid');
  }
}

/** A Turnos attention profile was sent for a business that does not have Turnos. */
export class TurnosNotAssignedError extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'invalid-turnos-profile';
  override readonly fields: Record<string, string[]>;
  constructor() {
    super('Turnos is not enabled for this business');
    this.fields = { turnosProfile: ['Turnos is not enabled for this business'] };
  }
}

export class InvalidLogoError extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'invalid-logo';
  override readonly fields: Record<string, string[]>;
  constructor(reason: string) {
    super(reason);
    this.fields = { logo: [reason] };
  }
}

export class LogoNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('The business has no logo');
  }
}

/** The base cannot be marked as ready yet: something it needs is missing or no longer valid. */
export class SetupIncompleteError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'setup-incomplete';
  constructor(override readonly fields: Record<string, string[]>) {
    super('The base configuration is not complete');
  }
}
