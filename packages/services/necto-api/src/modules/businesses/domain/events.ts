/**
 * A person became the boss of a business: when it was created, or when the previous boss was replaced.
 * Whoever sends access to the boss (another module) reacts to this; the businesses module does not know who.
 * Part of the module's public door.
 */
export class BossAssigned {
  constructor(
    readonly businessId: string,
    readonly businessName: string,
    readonly ownerId: string,
    readonly assignmentId: string,
    readonly bossName: string,
    readonly bossEmail: string,
    /** The assignment this one replaced, or null when the business was just created. */
    readonly replacedAssignmentId: string | null,
  ) {}
}
