import { DomainError } from '../../../platform/errors/domain-error';

export class PhoneAlreadyInUseError extends DomainError {
  readonly kind = 'conflict';

  constructor() {
    super('Phone number already in use');
  }
}

/** The second step was sent before the first one. */
export class PhoneRequiredError extends DomainError {
  readonly kind = 'conflict';

  constructor() {
    super('Save the phone number first');
  }
}
