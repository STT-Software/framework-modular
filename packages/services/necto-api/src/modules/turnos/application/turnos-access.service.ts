import { Injectable } from '@nestjs/common';
import { Clock } from '../../../platform/time/clock';
import { BusinessDirectory } from '../../businesses/public';
import { OPERATOR_VIEWS, TURNOS_MODULE_ID, type OperatorViewId } from '../domain/catalog';
import type { Operator, TurnosConfiguration } from '../domain/configuration';
import { newConfiguration } from '../domain/operations';
import { OperatorNotFoundError, OperatorNotOperableError, TurnosBusinessNotFoundError, TurnosNotEnabledError, ViewNotAllowedError } from '../domain/errors';
import { TurnosConfigurationStore } from './turnos-configuration.store';
/** The time zone used when a business has none stored. */
export const FALLBACK_TIMEZONE = 'America/Bogota';
/**
 * What a request is allowed to see and do in Turnos, decided on the server from the data as it is now: never from anything the page sends.
 * An administrator sees every queue and every view but only watches (the operators attend); an operator sees only the queues and views
 * the administrator gave them.
 */
export interface TurnosScope {
  role: 'admin' | 'operator';
  businessId: string;
  businessName: string;
  email: string;
  timezone: string;
  /** The queues this person may reach; `null` is every queue of the business. */
  queueIds: readonly string[] | null;
  views: readonly OperatorViewId[];
  /** Only for an operator. */
  operator: Pick<Operator, 'id' | 'name' | 'email'> | null;
  configuration: TurnosConfiguration;
}
export const ticketViews: readonly OperatorViewId[] = ['home', 'my-turns', 'create-turn', 'queues'];
/**
 * Turns "who is asking" into a scope. The routes already checked, with the guards of business-access, that the person is the boss of the
 * business or an operator of it with Turnos enabled; this looks at what Turnos itself knows (the operator's status, views and queues),
 * so a change of permissions is seen on the very next request, with no need for the person to sign in again.
 */
@Injectable()
export class TurnosAccessService {
  constructor(
    private readonly store: TurnosConfigurationStore,
    private readonly directory: BusinessDirectory,
    private readonly clock: Clock,
  ) {}
  async forAdmin(email: string, businessId: string): Promise<TurnosScope> {
    const { business, config: stored } = await this.load(businessId);
    // A business whose Turnos was never configured has nothing yet: the administrator sees it empty, nothing is created by looking.
    const config = stored ?? newConfiguration(businessId, this.clock.now());
    return { role: 'admin', businessId, businessName: business.name, email, timezone: business.timezone ?? FALLBACK_TIMEZONE, queueIds: null, views: OPERATOR_VIEWS, operator: null, configuration: config };
  }
  /**
   * @param view the view the route belongs to; without it only "can operate at all" is checked.
   * @throws OperatorNotFoundError (not an operator of this business), OperatorNotOperableError (pending, inactive, no views or no queues),
   *         ViewNotAllowedError (no permission for that view).
   */
  async forOperator(email: string, businessId: string, view?: OperatorViewId | readonly OperatorViewId[]): Promise<TurnosScope> {
    const { business, config } = await this.load(businessId);
    const operator = config?.operators.find((candidate) => candidate.email === email);
    if (!config || !operator) throw new OperatorNotFoundError();
    const queueIds = config.queues.filter((queue) => operator.queueIds.includes(queue.id)).map((queue) => queue.id);
    if (operator.status !== 'active' || operator.views.length === 0 || queueIds.length === 0) throw new OperatorNotOperableError();
    const needed = view === undefined ? [] : Array.isArray(view) ? view : [view];
    if (needed.length > 0 && !needed.some((candidate) => operator.views.includes(candidate))) throw new ViewNotAllowedError();
    return {
      role: 'operator',
      businessId,
      businessName: business.name,
      email,
      timezone: business.timezone ?? FALLBACK_TIMEZONE,
      queueIds,
      views: operator.views,
      operator: { id: operator.id, name: operator.name, email: operator.email },
      configuration: config,
    };
  }
  private async load(businessId: string) {
    const business = await this.directory.find(businessId);
    if (!business || business.status !== 'active') throw new TurnosBusinessNotFoundError();
    if (!business.modules.includes(TURNOS_MODULE_ID)) throw new TurnosNotEnabledError();
    return { business, config: await this.store.find(businessId) };
  }
}
/** True when the scope may use at least one of the views. */
export const canUse = (scope: TurnosScope, ...views: OperatorViewId[]): boolean => views.some((view) => scope.views.includes(view));
/** True when the scope may reach this queue. */
export const reaches = (scope: TurnosScope, queueId: string): boolean => scope.queueIds === null || scope.queueIds.includes(queueId);
