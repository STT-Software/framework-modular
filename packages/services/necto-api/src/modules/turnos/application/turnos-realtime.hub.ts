import { Injectable } from '@nestjs/common';
import type { Ticket } from '../domain/ticket';
export type TurnosEventType =
  | 'ticket.created'
  | 'ticket.called'
  | 'ticket.completed'
  | 'ticket.cancelled'
  | 'ticket.no-show'
  | 'ticket.released'
  | 'queue.paused'
  | 'queue.resumed'
  | 'config.updated'
  | 'access.changed'
  | 'survey.answered'
  | 'room-screen.updated';
export interface TurnosEvent {
  type: TurnosEventType;
  businessId: string;
  at: Date;
  /** The queue it is about; null for what concerns the whole business. Subscribers only receive the queues they may reach. */
  queueId: string | null;
  /** The turn it is about (the whole turn: each subscriber decides what to show of it). */
  ticket?: Ticket;
  /** `access.changed`: whose permissions changed. Other people's streams ignore it. */
  operatorId?: string;
}
export type TurnosListener = (event: TurnosEvent) => void;
/**
 * Delivers what happens in Turnos to the live connections of that business. It lives in the memory of the process: with several instances
 * behind a balancer an event only reaches the connections of the instance that handled the change (the day the backend runs on several
 * instances, this is the one piece to replace with a shared channel). Listeners never see another business's events.
 */
@Injectable()
export class TurnosRealtimeHub {
  private readonly listeners = new Map<string, Set<TurnosListener>>();
  subscribe(businessId: string, listener: TurnosListener): () => void {
    const set = this.listeners.get(businessId) ?? new Set<TurnosListener>();
    set.add(listener);
    this.listeners.set(businessId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(businessId);
    };
  }
  publish(event: TurnosEvent): void {
    for (const listener of [...(this.listeners.get(event.businessId) ?? [])]) {
      try {
        listener(event);
      } catch {
        // One broken connection never stops the others (or the change that caused the event).
      }
    }
  }
  /** How many connections are open for a business (for tests and diagnostics). */
  count(businessId: string): number {
    return this.listeners.get(businessId)?.size ?? 0;
  }
}
