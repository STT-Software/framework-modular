import type { MessageEvent } from '@nestjs/common';
import type { StreamItem } from '../application/turnos-stream.service';
import { toEventResponse } from './turnos-operation.response';
/** A stream item as the Server-Sent Event the page receives: the event name and a JSON body. */
export function toEventItem(item: StreamItem): MessageEvent {
  if (item.event) return { type: item.name, data: toEventResponse(item.event, item.withTicket === true) };
  if (item.scope) return { type: item.name, data: item.scope };
  return { type: item.name, data: {} };
}
