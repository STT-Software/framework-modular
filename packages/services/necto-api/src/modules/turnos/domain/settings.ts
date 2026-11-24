import { LIMITS, ROOM_NAME_DISPLAYS } from './catalog';
import type { Queue, RoomScreenConfig, SurveyConfig } from './configuration';
import { TurnosInvalidError } from './errors';
import { isInt, isRecord, Issues } from './issues';
export const DEFAULT_ROOM_SCREEN: RoomScreenConfig = {
  enabled: false,
  queueIds: null,
  customerName: 'first-name',
  playSound: true,
  recentCalls: 5,
  message: null,
};
export const DEFAULT_SURVEY: SurveyConfig = {
  enabled: false,
  channels: { email: true, whatsapp: false },
  question: '¿Cómo calificas la atención que recibiste?',
  allowComment: true,
  thanksMessage: '¡Gracias por tu opinión!',
  validHours: 72,
  queueIds: null,
};
export interface RoomScreenInput {
  enabled: boolean;
  queueIds?: string[] | null;
  customerName: string;
  playSound: boolean;
  recentCalls: number;
  message?: string | null;
}
export interface SurveyInput {
  enabled: boolean;
  channels: { email: boolean; whatsapp: boolean };
  question: string;
  allowComment: boolean;
  thanksMessage?: string | null;
  validHours: number;
  queueIds?: string[] | null;
}
/** `null` (or left out) means "all the queues"; a list must name existing queues of the business, at least one. */
function parseQueueSelection(raw: unknown, queues: readonly Queue[], issues: Issues): string[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) {
    issues.add('queueIds', 'queueIds must be a list of queue ids, or empty to use every queue');
    return null;
  }
  const ids = [...new Set(raw as string[])];
  if (ids.length === 0) {
    issues.add('queueIds', 'Choose at least one queue, or leave it empty to use every queue');
  } else if (ids.some((id) => !queues.some((queue) => queue.id === id))) {
    issues.add('queueIds', 'Every queue must be an existing queue of this business');
  }
  return ids;
}
function optionalMessage(raw: unknown, max: number, name: string, issues: Issues): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    issues.add(name, `${name} must be text`);
    return null;
  }
  const text = raw.trim();
  if (text.length > max) issues.add(name, `${name} must be at most ${max} characters long`);
  return text === '' ? null : text;
}
/** @throws TurnosInvalidError (`invalid-room-screen`) with every problem found. */
export function parseRoomScreen(input: RoomScreenInput, queues: readonly Queue[]): RoomScreenConfig {
  const issues = new Issues();
  if (typeof input.enabled !== 'boolean') issues.add('enabled', 'enabled must be true or false');
  const customerName = ROOM_NAME_DISPLAYS.find((candidate) => candidate === input.customerName);
  if (!customerName) issues.add('customerName', `customerName must be one of: ${ROOM_NAME_DISPLAYS.join(', ')}`);
  if (typeof input.playSound !== 'boolean') issues.add('playSound', 'playSound must be true or false');
  if (!isInt(input.recentCalls, LIMITS.roomRecentCalls.min, LIMITS.roomRecentCalls.max)) {
    issues.add('recentCalls', `recentCalls must be a whole number between ${LIMITS.roomRecentCalls.min} and ${LIMITS.roomRecentCalls.max}`);
  }
  const queueIds = parseQueueSelection(input.queueIds, queues, issues);
  const message = optionalMessage(input.message, LIMITS.roomMessage, 'message', issues);
  if (issues.any || !customerName) throw new TurnosInvalidError('invalid-room-screen', issues.fields);
  return { enabled: input.enabled, queueIds, customerName, playSound: input.playSound, recentCalls: input.recentCalls, message };
}
/** @throws TurnosInvalidError (`invalid-survey`) with every problem found. */
export function parseSurveyConfig(input: SurveyInput, queues: readonly Queue[]): SurveyConfig {
  const issues = new Issues();
  if (typeof input.enabled !== 'boolean') issues.add('enabled', 'enabled must be true or false');
  const channels: Record<string, unknown> = isRecord(input.channels) ? input.channels : {};
  if (typeof channels.email !== 'boolean') issues.add('channels.email', 'channels.email must be true or false');
  if (typeof channels.whatsapp !== 'boolean') issues.add('channels.whatsapp', 'channels.whatsapp must be true or false');
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  if (question.length < LIMITS.surveyQuestion.min || question.length > LIMITS.surveyQuestion.max) {
    issues.add('question', `question must be ${LIMITS.surveyQuestion.min} to ${LIMITS.surveyQuestion.max} characters long`);
  }
  if (typeof input.allowComment !== 'boolean') issues.add('allowComment', 'allowComment must be true or false');
  const thanksMessage = optionalMessage(input.thanksMessage, LIMITS.surveyThanks, 'thanksMessage', issues);
  if (!isInt(input.validHours, LIMITS.surveyValidHours.min, LIMITS.surveyValidHours.max)) {
    issues.add('validHours', `validHours must be a whole number between ${LIMITS.surveyValidHours.min} and ${LIMITS.surveyValidHours.max}`);
  }
  const queueIds = parseQueueSelection(input.queueIds, queues, issues);
  if (issues.any) throw new TurnosInvalidError('invalid-survey', issues.fields);
  return {
    enabled: input.enabled,
    channels: { email: channels.email === true, whatsapp: channels.whatsapp === true },
    question,
    allowComment: input.allowComment,
    thanksMessage,
    validHours: input.validHours,
    queueIds,
  };
}
