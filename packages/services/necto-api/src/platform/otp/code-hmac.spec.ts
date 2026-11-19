import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateCode, hmacCode, sameHmac } from './code-hmac';

describe('code-hmac', () => {
  it('generates six digits, keeping leading zeros', () => {
    for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/);
  });

  it('binds the HMAC to the secret, the id, the email, the purpose and the code', () => {
    const binding = { challengeId: 'c1', email: 'a@b.co', purpose: 'login' };
    const base = hmacCode('k'.repeat(40), binding, '123456');
    assert.match(base, /^[0-9a-f]{64}$/);
    assert.ok(sameHmac(base, hmacCode('k'.repeat(40), binding, '123456')));
    for (const changed of [
      hmacCode('K'.repeat(40), binding, '123456'),
      hmacCode('k'.repeat(40), { ...binding, challengeId: 'c2' }, '123456'),
      hmacCode('k'.repeat(40), { ...binding, email: 'z@y.co' }, '123456'),
      hmacCode('k'.repeat(40), { ...binding, purpose: 'other' }, '123456'),
      hmacCode('k'.repeat(40), binding, '123457'),
    ]) {
      assert.ok(!sameHmac(base, changed));
    }
  });

  it('never matches empty or malformed values', () => {
    assert.ok(!sameHmac('', ''));
    assert.ok(!sameHmac('ab', 'abcd'));
  });
});
