/**
 * What kind of problem a business rule found, without saying anything about HTTP.
 * The domain and application layers throw `DomainError`s; `DomainErrorFilter` turns them
 * into HTTP responses, so business code never depends on the transport.
 */
export type DomainErrorKind = 'conflict' | 'unauthenticated' | 'forbidden' | 'not-found' | 'rate-limited';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  /** For `rate-limited` errors: how many seconds until the caller may try again. */
  readonly retryAfterSeconds?: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
