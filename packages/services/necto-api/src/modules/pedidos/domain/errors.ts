import { DomainError } from '../../../platform/errors/domain-error';

/** Business is unknown, paused, or not accessible to the caller (same 404 for all). */
export class PedidosBusinessNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Business not found');
  }
}

/** Pedidos module is not enabled for this business. */
export class PedidosNotEnabledError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'module-not-enabled';
  constructor() {
    super('This functionality is not enabled for the business');
  }
}

export class PedidosOperatorNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Operator not found');
  }
}

/** Request payload violated Pedidos domain validation rules. */
export class InvalidPedidosDataError extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'invalid-pedidos-data';
  override readonly fields: Record<string, string[]>;
  constructor(fields: Record<string, string[]>) {
    super('Invalid Pedidos configuration data');
    this.fields = fields;
  }
}

/** Another operator in this business already uses the given normalized email. */
export class DuplicatePedidosOperatorError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'duplicate-operator-email';
  override readonly fields: Record<string, string[]>;
  constructor(email: string) {
    super('An operator with this email already exists');
    this.fields = { email: [`Operator email "${email}" is already assigned in this business`] };
  }
}

/** Configuration failed full readiness validation and cannot be marked ready yet. */
export class PedidosIncompleteError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'pedidos-incomplete';
  override readonly fields: Record<string, string[]>;
  constructor(fields: Record<string, string[]>) {
    super('The Pedidos configuration is not complete');
    this.fields = fields;
  }
}

/** Optimistic lock retries were exhausted due to concurrent updates. */
export class ConcurrentPedidosChangeError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'concurrent-change';
  constructor() {
    super('The configuration was changed at the same time; reload it and try again');
  }
}
