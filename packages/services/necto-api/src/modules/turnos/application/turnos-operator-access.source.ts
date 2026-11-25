import { Injectable, type OnModuleInit } from '@nestjs/common';
import { MemberAccessRegistry, MemberAccessSource, type BusinessMemberCandidate, type MemberAssignment } from '../../business-access/public';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { TurnosConfigurationRepository } from '../domain/turnos-configuration.repository';
/**
 * Tells business-access which businesses an email works in as an operator of Turnos, so the same login serves them. It reads
 * the configuration every time (nothing is copied into the access module), so what the administrator changes (removing the
 * operator, switching them off, taking their views or their queues away) is seen on the next request, in sessions that already exist.
 *
 * An operator counts as having access while they are `active` or `pending` (a pending one needs to sign in to become active) and have at
 * least one view and one existing queue; only an `active` one is `operable`. The views go with the assignment, in the order the workspace
 * offers them, so the person lands on the first one they may use. The person is identified only by the email.
 */
@Injectable()
export class TurnosOperatorAccessSource extends MemberAccessSource implements OnModuleInit {
  constructor(
    private readonly configurations: TurnosConfigurationRepository,
    private readonly registry: MemberAccessRegistry,
  ) {
    super();
  }
  onModuleInit(): void {
    this.registry.register(this);
  }
  async assignmentsOf(email: string): Promise<MemberAssignment[]> {
    const configurations = await this.configurations.findByOperatorEmail(email);
    const assignments: MemberAssignment[] = [];
    for (const config of configurations) {
      const operator = config.operators.find((candidate) => candidate.email === email);
      if (!operator || operator.status === 'inactive' || operator.views.length === 0) continue;
      if (!operator.queueIds.some((id) => config.queues.some((queue) => queue.id === id))) continue;
      assignments.push({
        businessId: config.businessId,
        moduleId: TURNOS_MODULE_ID,
        role: 'operator',
        personName: operator.name,
        views: operator.views,
        operable: operator.status === 'active',
      });
    }
    return assignments;
  }

  async membersOfBusiness(businessId: string): Promise<BusinessMemberCandidate[]> {
    const config = await this.configurations.find(businessId);
    if (!config) return [];
    return config.operators.map((operator) => ({
      moduleId: TURNOS_MODULE_ID,
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
    }));
  }
}
