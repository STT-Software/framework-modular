import { Injectable } from '@nestjs/common';
import { BusinessDirectory } from '../../businesses/public';
import type { Operator, Queue } from '../domain/configuration';
import { OperatorNotFoundError, TurnosBusinessNotFoundError } from '../domain/errors';
import { TurnosConfigurationStore } from './turnos-configuration.store';

/** What an operator sees: who they are in this business and ONLY the queues they are assigned to. */
export interface OperatorView {
  business: { id: string; name: string };
  operator: Pick<Operator, 'id' | 'name' | 'email'>;
  queues: Array<Pick<Queue, 'id' | 'name' | 'color' | 'mode' | 'averageMinutes'>>;
}

/**
 * The view of an operator of Turnos. The route already requires, on every request, that the signed-in person is an operator of
 * this business with the module enabled; this finds THEIR assignment by the email of the session (never one sent by the page),
 * so nobody else's queues can be reached.
 */
@Injectable()
export class TurnosOperatorService {
  constructor(
    private readonly store: TurnosConfigurationStore,
    private readonly directory: BusinessDirectory,
  ) {}

  async view(operatorEmail: string, businessId: string): Promise<OperatorView> {
    const [business, config] = await Promise.all([this.directory.find(businessId), this.store.find(businessId)]);
    if (!business || business.status !== 'active' || !config) throw new TurnosBusinessNotFoundError();
    const operator = config.operators.find((candidate) => candidate.email === operatorEmail);
    if (!operator) throw new OperatorNotFoundError();
    const assigned = config.queues.filter((queue) => operator.queueIds.includes(queue.id));
    if (assigned.length === 0) throw new OperatorNotFoundError();
    return {
      business: { id: business.id, name: business.name },
      operator: { id: operator.id, name: operator.name, email: operator.email },
      queues: assigned.map((queue) => ({ id: queue.id, name: queue.name, color: queue.color, mode: queue.mode, averageMinutes: queue.averageMinutes })),
    };
  }
}
