import { Injectable } from '@nestjs/common';
import { MemberAccessSource, type MemberAssignment } from '../domain/member-access';

/**
 * Where functional modules announce that they assign people (operators) to a business. A module registers once when it
 * starts; business-access asks every registered source on each decision. The assignments stay in the module that owns them.
 */
@Injectable()
export class MemberAccessRegistry {
  private readonly sources: MemberAccessSource[] = [];

  register(source: MemberAccessSource): void {
    if (!this.sources.includes(source)) this.sources.push(source);
  }

  async assignmentsOf(email: string): Promise<MemberAssignment[]> {
    const lists = await Promise.all(this.sources.map((source) => source.assignmentsOf(email)));
    return lists.flat();
  }
}
