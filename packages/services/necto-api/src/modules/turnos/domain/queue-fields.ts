import { randomUUID } from 'node:crypto';
import { FIELD_TYPES, LIMITS, type FieldType } from './catalog';
import type { QueueField } from './configuration';
import { normalizeContactEmail, normalizePhone } from './contact';
import { isRecord, Issues } from './issues';
export interface QueueFieldInput {
  id?: string | null;
  label: string;
  type: string;
  required?: boolean | null;
  options?: string[] | null;
}
const FIELD_ID = /^[A-Za-z0-9_-]{1,40}$/;
/**
 * Validates the extra fields a queue asks when a turn is created. A field keeps its `id` (answers are stored under it); a new one
 * gets one. Labels are unique inside the queue, `select` needs its options and no other type has any.
 * Problems are added to `issues` under `fields.<index>.<name>`.
 */
export function parseFields(input: unknown, issues: Issues, ids: () => string = randomUUID): QueueField[] {
  if (!Array.isArray(input)) {
    issues.add('fields', 'fields must be a list');
    return [];
  }
  if (input.length > LIMITS.fieldsPerQueue) issues.add('fields', `A queue can ask at most ${LIMITS.fieldsPerQueue} extra fields`);
  const parsed: QueueField[] = [];
  const labels = new Set<string>();
  input.slice(0, LIMITS.fieldsPerQueue).forEach((raw: unknown, index) => {
    const path = `fields.${index}`;
    if (!isRecord(raw)) {
      issues.add(path, 'Every field must be an object');
      return;
    }
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    if (label.length < LIMITS.fieldLabel.min || label.length > LIMITS.fieldLabel.max) {
      issues.add(`${path}.label`, `label must be ${LIMITS.fieldLabel.min} to ${LIMITS.fieldLabel.max} characters long`);
    } else if (labels.has(label.toLocaleLowerCase())) {
      issues.add(`${path}.label`, 'Two fields of a queue cannot have the same label');
    }
    labels.add(label.toLocaleLowerCase());
    const type = FIELD_TYPES.find((candidate) => candidate === raw.type);
    if (!type) issues.add(`${path}.type`, `type must be one of: ${FIELD_TYPES.join(', ')}`);
    if (raw.required !== undefined && raw.required !== null && typeof raw.required !== 'boolean') issues.add(`${path}.required`, 'required must be true or false');
    let id: string | null = null;
    if (raw.id !== undefined && raw.id !== null) {
      if (typeof raw.id !== 'string' || !FIELD_ID.test(raw.id)) issues.add(`${path}.id`, 'id must be 1 to 40 letters, digits, "-" or "_"');
      else if (parsed.some((other) => other.id === raw.id)) issues.add(`${path}.id`, 'Two fields of a queue cannot have the same id');
      else id = raw.id;
    }
    id ??= ids();
    let options: string[] = [];
    if (type === 'select') {
      const list = Array.isArray(raw.options) ? raw.options : [];
      options = list.filter((option): option is string => typeof option === 'string').map((option) => option.trim());
      const unique = new Set(options.map((option) => option.toLocaleLowerCase()));
      if (options.length < LIMITS.fieldOptions.min || options.length > LIMITS.fieldOptions.max) {
        issues.add(`${path}.options`, `A list field needs ${LIMITS.fieldOptions.min} to ${LIMITS.fieldOptions.max} options`);
      } else if (options.some((option) => option.length < LIMITS.fieldOption.min || option.length > LIMITS.fieldOption.max)) {
        issues.add(`${path}.options`, `Every option must be ${LIMITS.fieldOption.min} to ${LIMITS.fieldOption.max} characters long`);
      } else if (unique.size !== options.length) {
        issues.add(`${path}.options`, 'Options cannot repeat');
      }
    } else if (type && Array.isArray(raw.options) && raw.options.length > 0) {
      issues.add(`${path}.options`, 'Only a list field has options');
    }
    if (type) parsed.push({ id, label, type, required: raw.required === true, options });
  });
  return parsed;
}
/** One answered field of a turn, as stored: the label is kept as it was when the turn was created. */
export interface Answer {
  fieldId: string;
  label: string;
  type: FieldType;
  value: string | number | boolean;
}
const MAX_NUMBER = 1e12;
function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}
/**
 * Checks what was answered against the fields of the queue: every required field answered, every answer of the right type (and, for a
 * list, one of its options), and no answer for a field the queue does not have. Empty optional fields are left out.
 * Problems are added to `issues` under `answers.<fieldId>`.
 */
export function validateAnswers(fields: readonly QueueField[], raw: unknown, issues: Issues): Answer[] {
  const given = raw === undefined || raw === null ? {} : raw;
  if (!isRecord(given)) {
    issues.add('answers', 'answers must be an object of field id and value');
    return [];
  }
  for (const key of Object.keys(given)) {
    if (!fields.some((field) => field.id === key)) issues.add(`answers.${key}`, 'This queue does not ask that field');
  }
  const answers: Answer[] = [];
  for (const field of fields) {
    const path = `answers.${field.id}`;
    const value = given[field.id];
    const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    if (field.type === 'checkbox') {
      if (value !== undefined && value !== null && typeof value !== 'boolean') issues.add(path, `${field.label} must be true or false`);
      else if (field.required && value !== true) issues.add(path, `${field.label} must be accepted`);
      else if (typeof value === 'boolean') answers.push({ fieldId: field.id, label: field.label, type: field.type, value });
      continue;
    }
    if (empty) {
      if (field.required) issues.add(path, `${field.label} is required`);
      continue;
    }
    const text = typeof value === 'string' ? value.trim() : value;
    let stored: string | number | null = null;
    switch (field.type) {
      case 'text':
        if (typeof text !== 'string' || text.length > LIMITS.answerText) issues.add(path, `${field.label} must be text of at most ${LIMITS.answerText} characters`);
        else stored = text;
        break;
      case 'number': {
        const number = typeof text === 'number' ? text : typeof text === 'string' && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
        if (!Number.isFinite(number) || Math.abs(number) > MAX_NUMBER) issues.add(path, `${field.label} must be a number`);
        else stored = number;
        break;
      }
      case 'phone':
        stored = typeof text === 'string' ? normalizePhone(text) : null;
        if (stored === null) issues.add(path, `${field.label} must be a phone number`);
        break;
      case 'email':
        stored = typeof text === 'string' ? normalizeContactEmail(text) : null;
        if (stored === null) issues.add(path, `${field.label} must be an email address`);
        break;
      case 'date':
        if (typeof text !== 'string' || !validDate(text)) issues.add(path, `${field.label} must be a date as YYYY-MM-DD`);
        else stored = text;
        break;
      case 'select':
        if (typeof text !== 'string' || !field.options.includes(text)) issues.add(path, `${field.label} must be one of its options`);
        else stored = text;
        break;
    }
    if (stored !== null) answers.push({ fieldId: field.id, label: field.label, type: field.type, value: stored });
  }
  return answers;
}
