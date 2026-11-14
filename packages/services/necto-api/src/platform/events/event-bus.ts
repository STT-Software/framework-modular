import { Injectable, Logger } from '@nestjs/common';

type Handler<T> = (event: T) => Promise<void> | void;

/**
 * In-process publish/subscribe between modules, so one module can react to something another did
 * without importing it. The publisher only knows the event class (exported from its public door);
 * it never knows who listens.
 *
 * - `publish` waits for every handler, so what a handler persists is done when the publisher continues.
 * - A failing handler never breaks the publisher: the work the publisher already did stays done, and
 *   the failure is logged without the event payload (it can carry personal data).
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers = new Map<unknown, Array<Handler<never>>>();

  subscribe<T extends object>(type: new (...args: never[]) => T, handler: Handler<T>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(type, list);
  }

  async publish(event: object): Promise<void> {
    const list = this.handlers.get(event.constructor) ?? [];
    for (const handler of list) {
      try {
        await (handler as Handler<object>)(event);
      } catch {
        this.logger.error(`A handler of ${event.constructor.name} failed`);
      }
    }
  }
}
