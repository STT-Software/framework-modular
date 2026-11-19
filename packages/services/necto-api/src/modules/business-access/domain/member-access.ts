/**
 * What a functional module (turnos...) tells business-access about a person it has assigned: "this email works in
 * this business, in this module, with this role". business-access never stores or copies it: the module that owns the
 * assignment is asked every time, so removing it takes effect on the next request.
 */
export interface MemberAssignment {
  businessId: string;
  moduleId: string;
  role: 'operator';
  /** The name the module knows the person by. */
  personName: string;
}

/**
 * Implemented by a module that assigns people to one of its functionalities. It registers itself in
 * `MemberAccessRegistry` (so business-access does not import it and there is no import cycle).
 */
export abstract class MemberAccessSource {
  /** Every assignment of this email (already normalized), whatever the state of the business: business-access filters. */
  abstract assignmentsOf(email: string): Promise<MemberAssignment[]>;
}
