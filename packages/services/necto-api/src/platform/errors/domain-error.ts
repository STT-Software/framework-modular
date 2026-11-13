/**
 * What kind of problem a business rule found, without saying anything about HTTP.
 * The domain and application layers throw `DomainError`s; `DomainErrorFilter` turns them
 * into HTTP responses, so business code never depends on the transport.
 */
export type DomainErrorKind = 'conflict' | 'unauthenticated' | 'not-found';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
