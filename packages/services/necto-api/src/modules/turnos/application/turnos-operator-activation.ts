import { Injectable, type OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../../platform/events/event-bus';
import { Clock } from '../../../platform/time/clock';
import { MemberSignedIn } from '../../business-access/public';
import { activatePendingOperator } from '../domain/operations';
import { TurnosConfigurationRepository } from '../domain/turnos-configuration.repository';
import { TurnosConfigurationStore } from './turnos-configuration.store';
import { TurnosRealtimeHub } from './turnos-realtime.hub';
/**
 * The first time someone proves their email with a code, the operators waiting for it (`pending`) become `active`, in every business
 * where that email was assigned. An operator the administrator switched off is not touched.
 */
@Injectable()
export class TurnosOperatorActivation implements OnModuleInit {
  constructor(
    private readonly events: EventBus,
    private readonly configurations: TurnosConfigurationRepository,
    private readonly store: TurnosConfigurationStore,
    private readonly hub: TurnosRealtimeHub,
    private readonly clock: Clock,
  ) {}
  onModuleInit(): void {
    this.events.subscribe(MemberSignedIn, (event) => this.activate(event.email));
  }
  async activate(email: string): Promise<void> {
    const configurations = await this.configurations.findByOperatorEmail(email);
    for (const configuration of configurations) {
      if (!configuration.operators.some((operator) => operator.email === email && operator.status === 'pending')) continue;
      await this.store.update(configuration.businessId, (current, now) => activatePendingOperator(current, email, now));
      const operator = configuration.operators.find((candidate) => candidate.email === email);
      this.hub.publish({ type: 'access.changed', businessId: configuration.businessId, at: this.clock.now(), queueId: null, operatorId: operator?.id });
    }
  }
}
