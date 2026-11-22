import { Injectable, type OnModuleInit } from '@nestjs/common';
import { MemberAccessRegistry, MemberAccessSource, type MemberAssignment } from '../../business-access/public';
import { PEDIDOS_MODULE_ID } from '../domain/catalog';
import { PedidosConfigurationRepository } from '../domain/pedidos-configuration.repository';

/**
 * Announces Pedidos operator assignments to `business-access` so operators sign in through the shared OTP flow.
 * Only operators with at least one assigned operational stage qualify; removing an operator revokes access immediately.
 */
@Injectable()
export class PedidosOperatorAccessSource extends MemberAccessSource implements OnModuleInit {
  constructor(
    private readonly configurations: PedidosConfigurationRepository,
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
      if (!operator || operator.stages.length === 0) continue;
      assignments.push({
        businessId: config.businessId,
        moduleId: PEDIDOS_MODULE_ID,
        role: 'operator',
        personName: operator.name,
      });
    }
    return assignments;
  }
}
