import { Clock } from './clock';

/** A clock the tests move by hand, so expiry and waiting times can be checked without waiting. */
export class FixedClock extends Clock {
  private current: Date;

  constructor(start = '2026-01-01T12:00:00.000Z') {
    super();
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
