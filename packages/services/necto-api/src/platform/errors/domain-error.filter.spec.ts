import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArgumentsHost } from '@nestjs/common';
import { DomainError } from './domain-error';
import { DomainErrorFilter } from './domain-error.filter';

class Invalid extends DomainError {
  readonly kind = 'invalid';
  override readonly code = 'invalid-thing';
  override readonly fields = { 'schedule.mon.ranges.0.end': ['the closing must be later than the opening of the same day'] };
  constructor() {
    super('Not valid');
  }
}

function answer(error: DomainError) {
  const sent: { status?: number; body?: unknown } = {};
  const response = {
    setHeader: () => undefined,
    status(code: number) {
      sent.status = code;
      return { json: (body: unknown) => (sent.body = body) };
    },
  };
  new DomainErrorFilter().catch(error, { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost);
  return sent;
}

describe('DomainErrorFilter', () => {
  it('answers an invalid error as a 400 shaped like a validation error: message list, code and fields', () => {
    const sent = answer(new Invalid());
    assert.equal(sent.status, 400);
    assert.deepEqual(sent.body, {
      message: ['the closing must be later than the opening of the same day'],
      error: 'Bad Request',
      statusCode: 400,
      code: 'invalid-thing',
      fields: { 'schedule.mon.ranges.0.end': ['the closing must be later than the opening of the same day'] },
    });
  });
});
