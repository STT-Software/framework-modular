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
  /**
   * The views of the module this person may use, in the order the module wants them offered (the first is where they land after
   * signing in). Left out by a module that has no views.
   */
  views?: readonly string[];
  /**
   * False while the person is assigned but cannot work yet (for example, they have not signed in for the first time). They still
   * count as having an access to sign in, but every route that requires an operator refuses them. Left out means true.
   */
  operable?: boolean;
}

/**
 * Implemented by a module that assigns people to one of its functionalities. It registers itself in
 * `MemberAccessRegistry` (so business-access does not import it and there is no import cycle).
 */
export abstract class MemberAccessSource {
  /** Every assignment of this email (already normalized), whatever the state of the business: business-access filters. */
  abstract assignmentsOf(email: string): Promise<MemberAssignment[]>;
}

/**
 * Published once somebody proved their email with a code (a sign-in), before the accesses are listed, so a module can finish what
 * depended on that first sign-in (for example, an operator who was still pending becomes active). The email is normalized.
 */
export class MemberSignedIn {
  constructor(readonly email: string) {}
}
