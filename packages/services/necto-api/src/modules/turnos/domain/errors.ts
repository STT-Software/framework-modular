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
    override readonly code: 'invalid-rules' | 'invalid-queue' | 'invalid-operator' | 'invalid-profile' | 'invalid-request' | 'invalid-room-screen' | 'invalid-survey' | 'invalid-ticket' | 'invalid-filter' | 'invalid-answer',
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

/** The person is signed in but this operator assignment cannot work right now: pending, inactive or without any view. */
export class OperatorNotOperableError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'operator-not-operable';
  constructor() {
    super('This operator cannot operate right now');
  }
}
/** The operator has no permission for the view this route belongs to. */
export class ViewNotAllowedError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'view-not-allowed';
  constructor() {
    super('You do not have access to this view');
  }
}
/** A route that only an operator can use, reached with an administrator access (the administrator watches, the operators attend). */
export class OperatorRequiredError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'operator-required';
  constructor() {
    super('Only an operator of this business can do this');
  }
}
/** What only the administrator of the business does (comparing people, reports, settings), reached with an operator access. */
export class AdministratorRequiredError extends DomainError {
  readonly kind = 'forbidden';
  override readonly code = 'administrator-required';
  constructor() {
    super('Only the administrator of this business can do this');
  }
}
export class QueueHasOpenTurnsError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'queue-has-open-turns';
  constructor() {
    super('This queue still has turns waiting or in attention: finish or cancel them first');
  }
}
export class TicketNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Turn not found');
  }
}
/** The queue is paused: it takes no new turns. The turns it already has stay. */
export class QueuePausedError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'queue-paused';
  constructor() {
    super('This queue is paused and does not accept new turns');
  }
}
/** The turn is not in a state from which this can be done (for example completing one that is still waiting). */
export class InvalidTicketStateError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'invalid-ticket-state';
  constructor(readonly current: string) {
    super(`This turn is ${current} and cannot change that way`);
  }
}
/** Someone else already took this turn. */
export class TicketAlreadyTakenError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'ticket-already-taken';
  constructor() {
    super('This turn was already called by another operator');
  }
}
/** The operator already has a turn in attention: they must finish it (complete, cancel or mark absent) before calling another. */
export class OperatorBusyError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'operator-busy';
  constructor() {
    super('You already have a turn in attention: finish it before calling another');
  }
}
/** Nobody is waiting in the queue. */
export class QueueEmptyError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'queue-empty';
  constructor() {
    super('Nobody is waiting in this queue');
  }
}
/** In an automatic queue turns are called in order of arrival: this one is not next. */
export class NotNextInLineError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'not-next-in-line';
  constructor() {
    super('This queue calls turns in order of arrival: this turn is not the next one');
  }
}
/** The numbering could not settle on a free number after several tries. */
export class TicketNumberingError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'numbering-busy';
  constructor() {
    super('Many turns were created at the same time; try again');
  }
}
export class SurveyNotFoundError extends DomainError {
  readonly kind = 'not-found';
  constructor() {
    super('Survey not found');
  }
}
/** The invitation was already answered or its link expired. */
export class SurveyClosedError extends DomainError {
  readonly kind = 'conflict';
  override readonly code = 'survey-closed';
  constructor(reason: 'answered' | 'expired') {
    super(reason === 'answered' ? 'This survey was already answered' : 'This survey link expired');
  }
}
