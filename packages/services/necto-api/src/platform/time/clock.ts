import { Injectable } from '@nestjs/common';

/** The current time, behind an abstraction so rules that depend on it (expiry, cooldowns) can be tested. */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
