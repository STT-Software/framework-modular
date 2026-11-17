import { DomainError } from '../../../platform/errors/domain-error';

/** Another account already uses the phone. The client tells it apart from other conflicts by its `code`. */
export class PhoneAlreadyInUseError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'phone-in-use';

  constructor() {
    super('Phone number already in use');
  }
}

/** The second step was sent before the first one. The client sends the person back to the phone step. */
export class PhoneRequiredError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'phone-required';

  constructor() {
    super('Save the phone number first');
  }
}
