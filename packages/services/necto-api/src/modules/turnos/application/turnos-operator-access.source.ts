import { Injectable, type OnModuleInit } from '@nestjs/common';
import { MemberAccessRegistry, MemberAccessSource, type MemberAssignment } from '../../business-access/public';
import { TURNOS_MODULE_ID } from '../domain/catalog';
import { TurnosConfigurationRepository } from '../domain/turnos-configuration.repository';

/**
 * Tells business-access which businesses an email works in as an operator of Turnos, so the same login serves them. It reads
 * the configuration every time (nothing is copied into the access module), and only counts an operator who still has at least
 * one existing queue: removing the assignment, or its last queue, takes the access away on the next request.
 * The person is identified only by the email: this module neither creates nor deletes identities or sessions.
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
      if (!operator || !operator.queueIds.some((id) => config.queues.some((queue) => queue.id === id))) continue;
      assignments.push({ businessId: config.businessId, moduleId: TURNOS_MODULE_ID, role: 'operator', personName: operator.name });
    }
    return assignments;
  }
}
