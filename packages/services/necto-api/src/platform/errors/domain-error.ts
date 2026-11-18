/**
 * What kind of problem a business rule found, without saying anything about HTTP.
 * The domain and application layers throw `DomainError`s; `DomainErrorFilter` turns them
 * into HTTP responses, so business code never depends on the transport.
 */
export type DomainErrorKind = 'conflict' | 'unauthenticated' | 'forbidden' | 'not-found' | 'rate-limited' | 'invalid';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  /** For `rate-limited` errors: how many seconds until the caller may try again. */
  readonly retryAfterSeconds?: number;
  /** A stable, machine-readable reason a client can act on (for example `reverification-required`). */
  readonly code?: string;
  /** For `invalid` errors: the problems by field (dotted paths like `schedule.mon.ranges.0.end`), same shape as a DTO validation error. */
  readonly fields?: Record<string, string[]>;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
