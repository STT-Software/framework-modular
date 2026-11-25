/**
 * The calendar day of an instant in a time zone, as `YYYY-MM-DD` ("2026-03-04"). Numbering that restarts each day and the reports
 * by day use it, so "today" is the day of the business and not the day of the server.
 */
export function localDayKey(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type: string) => parts.find((candidate) => candidate.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
/** The hour (0 to 23) of an instant in a time zone. */
export function localHour(at: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).formatToParts(at).find((candidate) => candidate.type === 'hour')!.value;
  return Number(hour);
}
/** True when the name is a time zone this runtime knows. */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}
/**
 * The instant at which a local day starts (00:00 in the time zone). The offset of that day is found by trying: it is the one that makes
 * the local representation of the candidate equal to the day asked.
 */
export function startOfLocalDay(dayKey: string, timeZone: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  // The zone is at most 14 hours from UTC either way: try the offsets around the guess and keep the one whose local day starts here.
  for (let offsetHours = -14; offsetHours <= 14; offsetHours++) {
    for (const minutes of [0, 30, 45]) {
      const candidate = new Date(guess - (offsetHours * 60 + Math.sign(offsetHours || 1) * minutes) * 60_000);
      if (localDayKey(candidate, timeZone) === dayKey && localDayKey(new Date(candidate.getTime() - 1), timeZone) !== dayKey) return candidate;
    }
  }
  return new Date(guess);
}
/** The next day key (`2026-03-04` gives `2026-03-05`). */
export function addDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
