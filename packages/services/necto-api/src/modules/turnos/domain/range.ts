import { addDays, localDayKey, startOfLocalDay } from './local-day';
import { TurnosInvalidError } from './errors';
export const RANGE_PRESETS = ['today', 'yesterday', '7d', '30d'] as const;
/** The longest span a report or a chart may cover, in days. */
export const MAX_RANGE_DAYS = 92;
/** A span of whole days of the business, from its first day at 00:00 to the start of the day after the last one (excluded). */
export interface DayRange {
  fromDay: string;
  toDay: string;
  from: Date;
  to: Date;
  days: number;
}
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function validDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export interface RangeQuery {
  preset?: string;
  from?: string;
  to?: string;
}
/**
 * The days a request asks about, in the time zone of the business: a preset (`today`, `yesterday`, `7d`, `30d`, the last ones ending
 * today) or `from` and `to` as `YYYY-MM-DD` days, both included. Nothing asked means today.
 *
 * @throws TurnosInvalidError (`invalid-filter`) for a day that does not exist, a span reversed or longer than 92 days, or an unknown preset.
 */
export function resolveRange(query: RangeQuery, now: Date, timeZone: string): DayRange {
  const today = localDayKey(now, timeZone);
  let fromDay = today;
  let toDay = today;
  if (query.from !== undefined || query.to !== undefined) {
    const fields: Record<string, string[]> = {};
    if (query.from === undefined || !validDay(query.from)) fields.from = ['from must be a day as YYYY-MM-DD'];
    if (query.to === undefined || !validDay(query.to)) fields.to = ['to must be a day as YYYY-MM-DD'];
    if (Object.keys(fields).length > 0) throw new TurnosInvalidError('invalid-filter', fields);
    fromDay = query.from!;
    toDay = query.to!;
  } else if (query.preset !== undefined) {
    if (!RANGE_PRESETS.some((preset) => preset === query.preset)) {
      throw new TurnosInvalidError('invalid-filter', { range: [`range must be one of: ${RANGE_PRESETS.join(', ')}`] });
    }
    if (query.preset === 'yesterday') fromDay = toDay = addDays(today, -1);
    else if (query.preset === '7d') fromDay = addDays(today, -6);
    else if (query.preset === '30d') fromDay = addDays(today, -29);
  }
  if (fromDay > toDay) throw new TurnosInvalidError('invalid-filter', { to: ['to must not be before from'] });
  const days = daysBetween(fromDay, toDay) + 1;
  if (days > MAX_RANGE_DAYS) throw new TurnosInvalidError('invalid-filter', { to: [`The range cannot be longer than ${MAX_RANGE_DAYS} days`] });
  return { fromDay, toDay, from: startOfLocalDay(fromDay, timeZone), to: startOfLocalDay(addDays(toDay, 1), timeZone), days };
}
export function daysBetween(fromDay: string, toDay: string): number {
  const parse = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return Math.round((parse(toDay) - parse(fromDay)) / 86_400_000);
}
/** Every day of the range, in order. */
export function daysOf(range: Pick<DayRange, 'fromDay' | 'days'>): string[] {
  return Array.from({ length: range.days }, (_, index) => addDays(range.fromDay, index));
}
