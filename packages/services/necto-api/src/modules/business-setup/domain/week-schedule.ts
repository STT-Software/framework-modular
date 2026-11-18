import { InvalidScheduleError } from './errors';

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

/** A range of one day, in the LOCAL time of the business ("HH:mm", 24 hours). It never crosses midnight. */
export interface TimeRange {
  start: string;
  end: string;
}

export interface DaySchedule {
  open: boolean;
  /** Sorted by start time. Always empty when the day is closed. */
  ranges: TimeRange[];
}

export type WeekSchedule = Record<WeekDay, DaySchedule>;

/** More than this many ranges in one day is almost certainly a mistake (and keeps the stored document small). */
export const MAX_RANGES_PER_DAY = 6;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** What a business gets before anyone edits its schedule: Monday to Friday 08:00-18:00, Saturday 09:00-13:00, Sunday closed. */
export function defaultWeekSchedule(): WeekSchedule {
  const workday = (): DaySchedule => ({ open: true, ranges: [{ start: '08:00', end: '18:00' }] });
  return {
    mon: workday(),
    tue: workday(),
    wed: workday(),
    thu: workday(),
    fri: workday(),
    sat: { open: true, ranges: [{ start: '09:00', end: '13:00' }] },
    sun: { open: false, ranges: [] },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: Record<string, string[]>): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) add(issues, `${path}.${key}`, `${key} is not a known field`);
  }
}

function add(issues: Record<string, string[]>, path: string, message: string): void {
  (issues[path] ??= []).push(message);
}

/**
 * Validates and normalizes a week of opening hours received from outside. Every problem is reported with the path of the
 * field that has it (`schedule.mon.ranges.1.end`), so a form can show it where the person typed it.
 *
 * Rules: all seven days are present; an open day has between one and `MAX_RANGES_PER_DAY` ranges; every range has BOTH an
 * opening and a closing in "HH:mm"; the closing is later than the opening on the same day; ranges of one day do not overlap
 * (one may start exactly when another ends). A closed day keeps no ranges.
 *
 * The times are wall-clock times of the business's own time zone, never UTC or the server's: that is why nothing here
 * converts them. The time zone only matters when a moment is compared against them (see `isOpenAt`).
 *
 * @throws InvalidScheduleError with every issue found.
 */
export function parseWeekSchedule(input: unknown, path = 'schedule'): WeekSchedule {
  const issues: Record<string, string[]> = {};
  const result = {} as WeekSchedule;
  if (!isRecord(input)) {
    throw new InvalidScheduleError({ [path]: ['schedule must be an object with the seven days of the week'] });
  }
  onlyKeys(input, WEEK_DAYS, path, issues);
  for (const day of WEEK_DAYS) {
    const dayPath = `${path}.${day}`;
    const value = input[day];
    if (!isRecord(value)) {
      add(issues, dayPath, `${day} is required: { "open": boolean, "ranges": [...] }`);
      continue;
    }
    onlyKeys(value, ['open', 'ranges'], dayPath, issues);
    if (typeof value.open !== 'boolean') {
      add(issues, `${dayPath}.open`, 'open must be true or false');
      continue;
    }
    if (!value.open) {
      result[day] = { open: false, ranges: [] };
      continue;
    }
    const rawRanges = value.ranges;
    if (!Array.isArray(rawRanges) || rawRanges.length === 0) {
      add(issues, `${dayPath}.ranges`, 'an open day needs at least one range');
      continue;
    }
    if (rawRanges.length > MAX_RANGES_PER_DAY) {
      add(issues, `${dayPath}.ranges`, `a day can have at most ${MAX_RANGES_PER_DAY} ranges`);
      continue;
    }
    const valid: Array<TimeRange & { index: number }> = [];
    rawRanges.forEach((range: unknown, index) => {
      const rangePath = `${dayPath}.ranges.${index}`;
      if (!isRecord(range)) {
        add(issues, rangePath, 'a range needs an opening and a closing time');
        return;
      }
      onlyKeys(range, ['start', 'end'], rangePath, issues);
      const start = range.start;
      const end = range.end;
      let complete = true;
      if (typeof start !== 'string' || !TIME.test(start)) {
        add(issues, `${rangePath}.start`, 'the opening must be a time like 08:00 (24 hours)');
        complete = false;
      }
      if (typeof end !== 'string' || !TIME.test(end)) {
        add(issues, `${rangePath}.end`, 'the closing must be a time like 18:00 (24 hours)');
        complete = false;
      }
      if (!complete) return;
      if (minutesOf(end as string) <= minutesOf(start as string)) {
        add(issues, `${rangePath}.end`, 'the closing must be later than the opening of the same day');
        return;
      }
      valid.push({ start: start as string, end: end as string, index });
    });
    const sorted = [...valid].sort((a, b) => minutesOf(a.start) - minutesOf(b.start) || minutesOf(a.end) - minutesOf(b.end));
    for (let i = 1; i < sorted.length; i++) {
      if (minutesOf(sorted[i].start) < minutesOf(sorted[i - 1].end)) {
        add(issues, `${dayPath}.ranges.${sorted[i].index}.start`, 'the ranges of this day overlap');
      }
    }
    result[day] = { open: true, ranges: sorted.map(({ start, end }) => ({ start, end })) };
  }
  if (Object.keys(issues).length > 0) throw new InvalidScheduleError(issues);
  return result;
}

const WEEKDAY_BY_NAME: Record<string, WeekDay> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

/**
 * Is the business open at this instant? The instant is converted to the business's time zone first, and only then compared
 * with the wall-clock ranges. A range includes its opening and excludes its closing. `null` if the zone is not usable.
 */
export function isOpenAt(schedule: WeekSchedule, timeZone: string, instant: Date): boolean | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  } catch {
    return null;
  }
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const day = WEEKDAY_BY_NAME[value('weekday')];
  const now = Number(value('hour')) * 60 + Number(value('minute'));
  if (!day || Number.isNaN(now)) return null;
  const today = schedule[day];
  return today.open && today.ranges.some((range) => minutesOf(range.start) <= now && now < minutesOf(range.end));
}
