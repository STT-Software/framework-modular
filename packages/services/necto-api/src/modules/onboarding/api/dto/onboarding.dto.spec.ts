import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../platform/errors/validation-exception.factory';
import { SavePhoneDto } from './save-phone.dto';
import { SaveSourcesDto } from './save-sources.dto';

/** Runs the same transform and validation the API runs (see main.ts) and returns the dto and the problems by field. */
async function check<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const fields = (validationExceptionFactory(errors).getResponse() as { fields: Record<string, string[]> }).fields;
  return { dto, errors, fields };
}

describe('onboarding request validation', () => {
  describe('phone', () => {
    it('normalizes a valid mobile number to E.164, whatever separators it came with', async () => {
      for (const phone of ['+573001234567', '+57 300 123 4567', ' +57 (300) 123-4567 ', '+57.300.123.4567']) {
        const { dto, errors } = await check(SavePhoneDto, { phone });
        assert.deepEqual(errors, [], phone);
        assert.equal(dto.phone, '+573001234567', phone);
      }
      assert.equal((await check(SavePhoneDto, { phone: '+34 612 34 56 78' })).dto.phone, '+34612345678');
    });

    it('rejects numbers without country code, landlines, junk and other types', async () => {
      for (const phone of ['3001234567', '+5716012345', '+57 300', '+573001234567x', 'llámame', '', 573001234567, null]) {
        assert.ok((await check(SavePhoneDto, { phone })).fields.phone, String(phone));
      }
      assert.ok((await check(SavePhoneDto, {})).fields.phone);
    });

    it('rejects fields it does not declare', async () => {
      assert.ok((await check(SavePhoneDto, { phone: '+573001234567', userId: 'someone-else' })).fields.userId);
    });
  });

  describe('sources', () => {
    it('accepts an empty list ("Skip") and a single option', async () => {
      assert.deepEqual((await check(SaveSourcesDto, { sources: [] })).errors, []);
      assert.deepEqual((await check(SaveSourcesDto, { sources: ['instagram'] })).errors, []);
    });

    it('rejects two options, unknown options and anything that is not a list', async () => {
      assert.ok((await check(SaveSourcesDto, { sources: ['instagram', 'family'] })).fields.sources);
      assert.ok((await check(SaveSourcesDto, { sources: ['instagram', 'instagram'] })).fields.sources);
      assert.ok((await check(SaveSourcesDto, { sources: ['radio'] })).fields.sources);
      assert.ok((await check(SaveSourcesDto, { sources: 'instagram' })).fields.sources);
      assert.ok((await check(SaveSourcesDto, {})).fields.sources);
    });

    it('accepts an optional "other" text up to 80 characters, trimmed', async () => {
      const { dto, errors } = await check(SaveSourcesDto, { sources: ['other'], sourceOther: '  Un amigo  ' });
      assert.deepEqual(errors, []);
      assert.equal(dto.sourceOther, 'Un amigo');
      assert.deepEqual((await check(SaveSourcesDto, { sources: ['other'], sourceOther: null })).errors, []);
      assert.deepEqual((await check(SaveSourcesDto, { sources: ['other'], sourceOther: 'a'.repeat(80) })).errors, []);
      assert.deepEqual(
        (await check(SaveSourcesDto, { sources: ['other'], sourceOther: ` ${'a'.repeat(80)} ` })).errors,
        [],
        'the spaces around do not count',
      );
    });

    it('rejects an "other" text that is too long or not a string', async () => {
      assert.ok((await check(SaveSourcesDto, { sources: ['other'], sourceOther: 'a'.repeat(81) })).fields.sourceOther);
      assert.ok((await check(SaveSourcesDto, { sources: ['other'], sourceOther: 42 })).fields.sourceOther);
    });
  });
});
