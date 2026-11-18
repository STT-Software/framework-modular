import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidScheduleError } from './errors';
import { defaultWeekSchedule, isOpenAt, parseWeekSchedule, type WeekSchedule } from './week-schedule';

const closed = { open: false, ranges: [] };
function week(mon: unknown): Record<string, unknown> {
  return { mon, tue: closed, wed: closed, thu: closed, fri: closed, sat: closed, sun: closed };
}
function issuesOf(input: unknown): Record<string, string[]> {
  try {
    parseWeekSchedule(input);
  } catch (error) {
    if (error instanceof InvalidScheduleError) return error.fields;
    throw error;
  }
  return {};
}

describe('week schedule validation', () => {
  it('accepts open and closed days, and several ranges in one day, sorted by opening', () => {
    const parsed = parseWeekSchedule(
      week({ open: true, ranges: [{ start: '14:00', end: '18:00' }, { start: '08:00', end: '12:00' }] }),
    );
    assert.deepEqual(parsed.mon.ranges, [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }]);
    assert.deepEqual(parsed.sun, { open: false, ranges: [] });
  });

  it('lets one range start exactly when the previous one ends, but not before', () => {
    assert.deepEqual(issuesOf(week({ open: true, ranges: [{ start: '08:00', end: '12:00' }, { start: '12:00', end: '18:00' }] })), {});
    const issues = issuesOf(week({ open: true, ranges: [{ start: '08:00', end: '12:01' }, { start: '12:00', end: '18:00' }] }));
    assert.deepEqual(Object.keys(issues), ['schedule.mon.ranges.1.start']);
  });

  it('rejects incomplete ranges and says which side is missing', () => {
    const issues = issuesOf(week({ open: true, ranges: [{ start: '08:00' }, { start: '', end: '10:00' }] }));
    assert.ok(issues['schedule.mon.ranges.0.end']);
    assert.ok(issues['schedule.mon.ranges.1.start']);
  });

  it('rejects a closing that is not later than the opening, including equal times and overnight ranges', () => {
    assert.ok(issuesOf(week({ open: true, ranges: [{ start: '10:00', end: '10:00' }] }))['schedule.mon.ranges.0.end']);
    assert.ok(issuesOf(week({ open: true, ranges: [{ start: '22:00', end: '02:00' }] }))['schedule.mon.ranges.0.end']);
  });

  it('rejects malformed times (no leading zero, 24:00, seconds, text)', () => {
    for (const bad of ['8:00', '24:00', '12:60', '08:00:00', 'noon', 800]) {
      assert.ok(issuesOf(week({ open: true, ranges: [{ start: bad, end: '23:59' }] }))['schedule.mon.ranges.0.start'], String(bad));
    }
  });

  it('rejects overlaps even when the ranges are sent out of order, and a day that is open without ranges', () => {
    const issues = issuesOf(week({ open: true, ranges: [{ start: '13:00', end: '18:00' }, { start: '08:00', end: '14:00' }] }));
    assert.ok(issues['schedule.mon.ranges.0.start'], 'the later range is the one that overlaps');
    assert.ok(issuesOf(week({ open: true, ranges: [] }))['schedule.mon.ranges']);
    assert.ok(issuesOf(week({ open: true }))['schedule.mon.ranges']);
  });

  it('requires the seven days and refuses days or fields it does not know', () => {
    const { sun: _sun, ...sixDays } = week(closed);
    assert.ok(issuesOf(sixDays)['schedule.sun']);
    assert.ok(issuesOf({ ...week(closed), funday: closed })['schedule.funday']);
    assert.ok(issuesOf(week({ open: true, ranges: [{ start: '08:00', end: '09:00', note: 'x' }] }))['schedule.mon.ranges.0.note']);
    assert.ok(issuesOf(week({ open: 'yes', ranges: [] }))['schedule.mon.open']);
    assert.ok(issuesOf('Monday')['schedule']);
    assert.ok(issuesOf(null)['schedule']);
  });

  it('drops the ranges of a closed day and caps the number of ranges of an open one', () => {
    assert.deepEqual(parseWeekSchedule(week({ open: false, ranges: [{ start: '08:00', end: '09:00' }] })).mon, { open: false, ranges: [] });
    const many = Array.from({ length: 7 }, (_, index) => ({ start: `0${index}:00`, end: `0${index}:30` }));
    assert.ok(issuesOf(week({ open: true, ranges: many }))['schedule.mon.ranges']);
  });

  it('reports every problem of the week at once, with the path of each field', () => {
    const issues = issuesOf({ ...week({ open: true, ranges: [{ start: '09:00', end: '08:00' }] }), tue: { open: true, ranges: [] } });
    assert.deepEqual(Object.keys(issues).sort(), ['schedule.mon.ranges.0.end', 'schedule.tue.ranges']);
  });

  it('does not share its result with the default (editing one never changes the other)', () => {
    const a = defaultWeekSchedule();
    a.mon.open = false;
    assert.equal(defaultWeekSchedule().mon.open, true);
  });
});

describe('isOpenAt (the time zone of the business decides)', () => {
  const schedule: WeekSchedule = {
    ...defaultWeekSchedule(),
    wed: { open: true, ranges: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  };

  it('compares the instant with the hours in the business time zone, not in UTC', () => {
    // 2026-03-04 is a Wednesday. 15:00 UTC is 10:00 on Wednesday in Bogotá (UTC-5) and 00:00 on Thursday in Tokyo (UTC+9).
    const instant = new Date('2026-03-04T15:00:00Z');
    assert.equal(isOpenAt(schedule, 'America/Bogota', instant), true);
    assert.equal(isOpenAt(schedule, 'Asia/Tokyo', instant), false);
    // 15:00 UTC is 16:00 in Madrid (UTC+1): Wednesday afternoon, open again.
    assert.equal(isOpenAt(schedule, 'Europe/Madrid', instant), true);
  });

  it('uses the local weekday, which can differ from the UTC one', () => {
    const sundayInBogota = new Date('2026-03-09T03:00:00Z'); // Monday 03:00 UTC = Sunday 22:00 in Bogotá
    assert.equal(isOpenAt(schedule, 'America/Bogota', sundayInBogota), false);
    const mondayEveningUtc = new Date('2026-03-02T14:00:00Z'); // Monday 09:00 in Bogotá
    assert.equal(isOpenAt(schedule, 'America/Bogota', mondayEveningUtc), true);
  });

  it('includes the opening minute, excludes the closing minute and respects breaks', () => {
    const at = (utc: string) => isOpenAt(schedule, 'America/Bogota', new Date(utc));
    assert.equal(at('2026-03-04T13:00:00Z'), true, '08:00');
    assert.equal(at('2026-03-04T16:59:00Z'), true, '11:59');
    assert.equal(at('2026-03-04T17:00:00Z'), false, '12:00');
    assert.equal(at('2026-03-04T18:30:00Z'), false, '13:30, break');
    assert.equal(at('2026-03-04T19:00:00Z'), true, '14:00');
  });

  it('answers null for a time zone it cannot use', () => {
    assert.equal(isOpenAt(schedule, 'Not/AZone', new Date()), null);
  });
});
