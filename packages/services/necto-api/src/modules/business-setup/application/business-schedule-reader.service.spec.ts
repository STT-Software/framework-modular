import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import { defaultWeekSchedule } from '../domain/week-schedule';
import { aWeek, BUSINESS_ID, InMemoryBusinessSetupRepository, NIGHT_SHIFT } from '../fakes.spec';
import { BusinessScheduleReaderService } from './business-schedule-reader.service';

describe('BusinessScheduleReaderService', () => {
  it('returns the default business schedule when no setup has been saved yet', async () => {
    const clock = new FixedClock('2026-03-04T15:00:00.000Z'); // Wednesday 10:00 in America/Bogota
    const repository = new InMemoryBusinessSetupRepository();
    const reader = new BusinessScheduleReaderService(repository, clock);

    const schedule = await reader.forModule(BUSINESS_ID, 'pedidos', 'America/Bogota');
    assert.equal(schedule.timezone, 'America/Bogota');
    assert.equal(schedule.inherit, true);
    assert.equal(schedule.openNow, true);
    assert.deepEqual(schedule.days, defaultWeekSchedule());
  });

  it('honors module override when inherit is false and falls back to base schedule when inherit is true', async () => {
    const clock = new FixedClock('2026-03-04T15:00:00.000Z'); // Wednesday 10:00 in America/Bogota
    const repository = new InMemoryBusinessSetupRepository();
    const now = clock.now();
    await repository.apply(BUSINESS_ID, { baseSchedule: aWeek() }, now);
    await repository.apply(
      BUSINESS_ID,
      { moduleSchedule: { moduleId: 'pedidos', entry: { inherit: false, schedule: aWeek(NIGHT_SHIFT) } } },
      now,
    );

    const reader = new BusinessScheduleReaderService(repository, clock);
    const custom = await reader.forModule(BUSINESS_ID, 'pedidos', 'America/Bogota');
    assert.equal(custom.inherit, false);
    assert.equal(custom.openNow, false);
    assert.deepEqual(custom.days.wed.ranges, NIGHT_SHIFT.ranges);

    await repository.apply(
      BUSINESS_ID,
      { moduleSchedule: { moduleId: 'pedidos', entry: { inherit: true, schedule: aWeek(NIGHT_SHIFT) } } },
      now,
    );
    const inherited = await reader.forModule(BUSINESS_ID, 'pedidos', 'America/Bogota');
    assert.equal(inherited.inherit, true);
    assert.equal(inherited.openNow, true);
    assert.deepEqual(inherited.days.wed.ranges, [{ start: '07:00', end: '16:00' }]);
  });

  it('evaluates openNow in the provided timezone and returns false for an invalid timezone', async () => {
    const clock = new FixedClock('2026-03-04T15:00:00.000Z'); // Thursday 00:00 in Asia/Tokyo
    const repository = new InMemoryBusinessSetupRepository();
    const reader = new BusinessScheduleReaderService(repository, clock);

    assert.equal((await reader.forModule(BUSINESS_ID, 'pedidos', 'Asia/Tokyo')).openNow, false);
    assert.equal((await reader.forModule(BUSINESS_ID, 'pedidos', 'Invalid/Zone')).openNow, false);
  });
});
