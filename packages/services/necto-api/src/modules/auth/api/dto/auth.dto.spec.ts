import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../platform/errors/validation-exception.factory';
import { RegisterSuperAdminDto } from './register-super-admin.dto';
import { ResendRegistrationCodeDto } from './resend-registration-code.dto';
import { VerifyRegistrationDto } from './verify-registration.dto';

/** Runs the same transform and validation the API runs (see main.ts) and returns the dto and the problems by field. */
async function check<T extends object>(type: ClassConstructor<T>, body: Record<string, unknown>) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const fields =
    errors.length > 0
      ? (validationExceptionFactory(errors).getResponse() as { fields: Record<string, string[]> }).fields
      : {};
  return { dto, errors, fields };
}

const ID = '65a1b2c3d4e5f60718293a4b';

describe('auth request validation', () => {
  it('register normalizes and accepts a valid body', async () => {
    const { dto, errors } = await check(RegisterSuperAdminDto, {
      username: ' Admin.Root ',
      email: ' ADMIN@Company.com ',
      password: 'correct-horse',
      identityDocumentType: 'cc',
      identityDocument: '1.032.556.778',
      acceptTerms: true,
    });
    assert.deepEqual(errors, []);
    assert.equal(dto.username, 'admin.root');
    assert.equal(dto.email, 'admin@company.com');
    assert.equal(dto.identityDocumentType, 'CC');
    assert.equal(dto.identityDocument, '1032556778');
  });

  it('register rejects terms not accepted and a username with "@"', async () => {
    const { fields } = await check(RegisterSuperAdminDto, {
      username: 'a@b',
      email: 'admin@company.com',
      password: 'correct-horse',
      identityDocumentType: 'CC',
      identityDocument: '1032556778',
      acceptTerms: false,
    });
    assert.ok(fields.username);
    assert.ok(fields.acceptTerms);
  });

  it('verify accepts a 6-digit code (spaces removed) and a valid id', async () => {
    const { dto, errors } = await check(VerifyRegistrationDto, { registrationId: ID, code: ' 012 345 ' });
    assert.deepEqual(errors, []);
    assert.equal(dto.code, '012345');
  });

  it('verify rejects bad codes, bad ids and extra fields', async () => {
    for (const code of ['12345', '1234567', 'abcdef', 123456, null]) {
      assert.ok((await check(VerifyRegistrationDto, { registrationId: ID, code })).fields.code, String(code));
    }
    assert.ok((await check(VerifyRegistrationDto, { registrationId: 'nope', code: '123456' })).fields.registrationId);
    assert.ok((await check(VerifyRegistrationDto, { registrationId: ID, code: '123456', extra: 1 })).errors.length > 0);
  });

  it('resend needs a valid registration id', async () => {
    assert.deepEqual((await check(ResendRegistrationCodeDto, { registrationId: ID })).errors, []);
    assert.ok((await check(ResendRegistrationCodeDto, { registrationId: '' })).fields.registrationId);
  });
});
