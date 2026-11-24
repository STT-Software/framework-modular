import { Injectable } from '@nestjs/common';
import type { OperatorViewId } from '../domain/catalog';
import type { Operator, Queue } from '../domain/configuration';
import { ticketExample } from '../domain/rules';
import { TurnosAccessService } from './turnos-access.service';
/** What an operator sees: who they are in this business, what they may use, and ONLY the queues they are assigned to. */
export interface OperatorView {
  business: { id: string; name: string };
  operator: Pick<Operator, 'id' | 'name' | 'email' | 'status'>;
  /** The views they may use, in the order to offer them, and the one to open first. */
  views: readonly OperatorViewId[];
  firstView: OperatorViewId | null;
  queues: Array<Pick<Queue, 'id' | 'name' | 'color' | 'mode' | 'averageMinutes' | 'status' | 'fields'> & { ticketExample: string }>;
}
/**
 * The workspace of an operator of Turnos. The route already requires, on every request, that the signed-in person is an operator of this
 * business with the module enabled; this finds THEIR assignment by the email of the session (never one sent by the page), and refuses it
 * while they are pending, inactive or have no views, so nobody else's queues can be reached.
 */
@Injectable()
export class TurnosOperatorService {
  constructor(private readonly access: TurnosAccessService) {}
  async view(operatorEmail: string, businessId: string): Promise<OperatorView> {
    const scope = await this.access.forOperator(operatorEmail, businessId);
    const config = scope.configuration;
    const operator = config.operators.find((candidate) => candidate.email === operatorEmail)!;
    return {
      business: { id: scope.businessId, name: scope.businessName },
      operator: { id: operator.id, name: operator.name, email: operator.email, status: operator.status },
      views: operator.views,
      firstView: operator.views[0] ?? null,
      queues: config.queues
        .filter((queue) => scope.queueIds!.includes(queue.id))
        .map((queue) => ({
          id: queue.id,
          name: queue.name,
          color: queue.color,
          mode: queue.mode,
          averageMinutes: queue.averageMinutes,
          status: queue.status,
          fields: queue.fields,
          ticketExample: ticketExample(queue, config.rules),
        })),
    };
  }
}
