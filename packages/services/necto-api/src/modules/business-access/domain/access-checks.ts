/**
 * Asks, at this very moment, whether a signed-in person may still do what they are doing. The guards of the routes answer it once per
 * request; a connection that stays open (a live stream) asks it again while it lasts, so a session that ends, a business that is paused, an
 * administrator who is replaced or an operator who is removed stops receiving data without waiting for the next request.
 * Each method throws the same errors the guards do when the answer is no.
 */
export abstract class BusinessAccessChecks {
  /** The session behind the token is still active and belongs to this email. */
  abstract requireSession(sessionId: string, email: string): Promise<void>;
  /** This email is the current boss of the active business, and it has the module enabled. */
  abstract requireAdministrator(email: string, businessId: string, moduleId: string): Promise<void>;
  /** This email is an operator of the module in that business, who can operate now, with the business active and the module enabled. */
  abstract requireOperator(email: string, businessId: string, moduleId: string): Promise<void>;
}
