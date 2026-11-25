import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BusinessAccessChecks } from '../../business-access/public';
import { TURNOS_MODULE_ID, type OperatorViewId } from '../domain/catalog';
import { canUse, reaches, TurnosAccessService, type TurnosScope } from './turnos-access.service';
import { TurnosRealtimeHub, type TurnosEvent } from './turnos-realtime.hub';
/** Who opened the stream: from the token and the route, already checked once by the guards. */
export interface StreamIdentity {
  role: 'admin' | 'operator';
  businessId: string;
  email: string;
  sessionId: string;
}
export interface StreamItem {
  /** The SSE event name: `ready`, `ping`, `access.updated`, `access.revoked`, or an event type of the hub. */
  name: string;
  event?: TurnosEvent;
  /** Whether the person may see the body of the turn (customer data) or only that something happened in the queue. */
  withTicket?: boolean;
  scope?: { role: 'admin' | 'operator'; queueIds: readonly string[] | null; views: readonly OperatorViewId[]; firstView: OperatorViewId | null };
}
const TICKET_VIEWS: OperatorViewId[] = ['home', 'my-turns', 'create-turn', 'queues'];
/**
 * The live stream of Turnos for one connection. It is authorized when it opens (by the route's guards) and AGAIN while it lasts:
 * - every few seconds, and on every heartbeat, the session, the role in the business, the module and the operator's own status,
 *   views and queues are checked against the database; when any fails the stream says `access.revoked` and closes;
 * - when the administrator changes this operator's permissions the stream is told at once (`access.changed`), reads the new ones and says
 *   `access.updated`, so an open session never keeps what was taken away.
 * Every event is filtered by what the person may reach, at the moment it is delivered.
 */
@Injectable()
export class TurnosStreamService {
  /** How long a check stays valid before the next event triggers another. */
  revalidateMs = 5_000;
  heartbeatMs = 15_000;
  constructor(
    private readonly hub: TurnosRealtimeHub,
    private readonly access: TurnosAccessService,
    private readonly checks: BusinessAccessChecks,
  ) {}
  open(identity: StreamIdentity): Observable<StreamItem> {
    return new Observable<StreamItem>((subscriber) => {
      let scope: TurnosScope | null = null;
      let validatedAt = 0;
      let closed = false;
      let chain: Promise<void> = Promise.resolve();
      const revoke = () => {
        if (closed) return;
        closed = true;
        subscriber.next({ name: 'access.revoked' });
        subscriber.complete();
      };
      const validate = async (): Promise<boolean> => {
        try {
          await this.checks.requireSession(identity.sessionId, identity.email);
          if (identity.role === 'admin') {
            await this.checks.requireAdministrator(identity.email, identity.businessId, TURNOS_MODULE_ID);
            scope = await this.access.forAdmin(identity.email, identity.businessId);
          } else {
            await this.checks.requireOperator(identity.email, identity.businessId, TURNOS_MODULE_ID);
            scope = await this.access.forOperator(identity.email, identity.businessId);
          }
          validatedAt = Date.now();
          return true;
        } catch {
          revoke();
          return false;
        }
      };
      const summary = () => ({
        role: scope!.role,
        queueIds: scope!.queueIds,
        views: scope!.views,
        firstView: scope!.role === 'operator' ? (scope!.views[0] ?? null) : null,
      });
      const handle = async (event: TurnosEvent) => {
        if (closed) return;
        if (event.type === 'access.changed') {
          if (identity.role !== 'operator' || event.operatorId !== scope?.operator?.id) return;
          if (await validate()) subscriber.next({ name: 'access.updated', scope: summary() });
          return;
        }
        if (Date.now() - validatedAt > this.revalidateMs && !(await validate())) return;
        if (closed || !scope) return;
        const item = visibleItem(scope, event);
        if (item) subscriber.next(item);
      };
      const unsubscribe = this.hub.subscribe(identity.businessId, (event) => {
        chain = chain.then(() => handle(event)).catch(() => undefined);
      });
      const heartbeat = setInterval(() => {
        chain = chain
          .then(async () => {
            if (closed) return;
            if (await validate()) subscriber.next({ name: 'ping' });
          })
          .catch(() => undefined);
      }, this.heartbeatMs);
      void validate().then((valid) => {
        if (valid && !closed) subscriber.next({ name: 'ready', scope: summary() });
      });
      return () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };
    });
  }
}
/** What this person receives of an event, or null: only their queues, only what their views are for. */
export function visibleItem(scope: TurnosScope, event: TurnosEvent): StreamItem | null {
  const admin = scope.role === 'admin';
  const sees = (views: OperatorViewId[]) => admin || canUse(scope, ...views);
  if (event.type === 'room-screen.updated') return admin ? { name: event.type, event } : null;
  if (event.type === 'config.updated') return { name: event.type, event };
  if (event.type === 'survey.answered') return event.queueId !== null && reaches(scope, event.queueId) && sees(['surveys']) ? { name: event.type, event } : null;
  if (event.queueId === null || !reaches(scope, event.queueId) || !sees(TICKET_VIEWS)) return null;
  return { name: event.type, event, withTicket: admin || canUse(scope, 'my-turns', 'create-turn') };
}
