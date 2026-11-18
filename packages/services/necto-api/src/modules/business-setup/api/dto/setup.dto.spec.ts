import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../platform/errors/validation-exception.factory';
import { BusinessCategoryDto } from '../../../businesses/public';
import { SaveModuleScheduleDto, SaveProfileDto, SaveProgressDto, SaveScheduleDto } from './setup.dto';

/** Runs the same validation the API runs (global ValidationPipe options) and returns the instance and the problems by field. */
async function check<T extends object>(type: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(type, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const fields = (validationExceptionFactory(errors).getResponse() as { fields: Record<string, string[]> }).fields;
  return { dto, errors, fields };
}

describe('setup: the form of business data', () => {
  const valid = { name: 'Café Central', description: 'Cocina de temporada.' };

  it('accepts the minimum (only the name) and normalizes like the owner\'s form does', async () => {
    const { errors, dto } = await check(SaveProfileDto, {
      name: '  Café Central  ',
      phone: '+57 (300) 123-4567',
      supportEmail: ' Hola@CafeCentral.co ',
      website: 'cafecentral.co',
      taxId: '900 123 456-7',
      legalName: '   ',
    });
    assert.deepEqual(errors, []);
    assert.equal(dto.name, 'Café Central');
    assert.equal(dto.phone, '+573001234567');
    assert.equal(dto.supportEmail, 'hola@cafecentral.co');
    assert.equal(dto.website, 'https://cafecentral.co');
    assert.equal(dto.taxId, '900123456-7');
    assert.equal(dto.legalName, null);
  });

  it('applies the same rules as the owner\'s form: name, phone, email and website', async () => {
    const { fields } = await check(SaveProfileDto, { name: 'A', phone: '123', supportEmail: 'no-es-correo', website: 'ftp://x.co', taxId: '1' });
    assert.deepEqual(Object.keys(fields).sort(), ['name', 'phone', 'supportEmail', 'taxId', 'website']);
    assert.ok((await check(SaveProfileDto, {})).fields.name, 'the name is required');
  });

  it('limits and cleans the description', async () => {
    assert.equal((await check(SaveProfileDto, { ...valid, description: '  Hola  ' })).dto.description, 'Hola');
    assert.equal((await check(SaveProfileDto, { ...valid, description: '   ' })).dto.description, null);
    assert.deepEqual((await check(SaveProfileDto, { ...valid, description: 'x'.repeat(500) })).errors, []);
    assert.ok((await check(SaveProfileDto, { ...valid, description: 'x'.repeat(501) })).fields.description);
    assert.ok((await check(SaveProfileDto, { ...valid, description: 42 })).fields.description);
  });

  it('refuses everything the administrator may not change: modules, boss, currency, time zone, category, status, owner', async () => {
    for (const forbidden of ['modules', 'boss', 'currency', 'timezone', 'category', 'status', 'ownerId', 'id']) {
      const { errors } = await check(SaveProfileDto, { ...valid, [forbidden]: forbidden === 'modules' ? ['reservas'] : 'x' });
      assert.ok(errors.some((error) => error.property === forbidden), `${forbidden} must be rejected`);
    }
  });
});

describe('setup: the type of business', () => {
  it('accepts a known category and rejects an unknown one', async () => {
    assert.deepEqual((await check(BusinessCategoryDto, { category: 'retail' })).errors, []);
    assert.ok((await check(BusinessCategoryDto, { category: 'bakery' })).fields.category);
    assert.ok((await check(BusinessCategoryDto, {})).fields.category);
  });

  it('requires the description when the type is "other", and ignores it for the others', async () => {
    assert.ok((await check(BusinessCategoryDto, { category: 'other' })).fields.categoryOther);
    assert.ok((await check(BusinessCategoryDto, { category: 'other', categoryOther: '   ' })).fields.categoryOther);
    assert.ok((await check(BusinessCategoryDto, { category: 'other', categoryOther: 'a' })).fields.categoryOther);
    assert.equal((await check(BusinessCategoryDto, { category: 'other', categoryOther: ' Estudio de tatuajes ' })).dto.categoryOther, 'Estudio de tatuajes');
    assert.deepEqual((await check(BusinessCategoryDto, { category: 'retail' })).errors, []);
  });

  it('refuses any other field', async () => {
    assert.ok((await check(BusinessCategoryDto, { category: 'retail', modules: ['turnos'] })).errors.length > 0);
  });
});

describe('setup: schedule and progress bodies', () => {
  it('require the schedule as an object (its content is checked by the domain)', async () => {
    assert.deepEqual((await check(SaveScheduleDto, { schedule: { mon: {} } })).errors, []);
    assert.ok((await check(SaveScheduleDto, {})).fields.schedule);
    assert.ok((await check(SaveScheduleDto, { schedule: 'lunes' })).fields.schedule);
    assert.ok((await check(SaveScheduleDto, { schedule: [] })).fields.schedule);
    assert.ok((await check(SaveScheduleDto, { schedule: {}, extra: 1 })).errors.length > 0);
  });

  it('need a boolean "inherit" for a module and take its own schedule only as an object', async () => {
    assert.deepEqual((await check(SaveModuleScheduleDto, { inherit: true })).errors, []);
    assert.deepEqual((await check(SaveModuleScheduleDto, { inherit: false, schedule: {} })).errors, []);
    assert.ok((await check(SaveModuleScheduleDto, {})).fields.inherit);
    assert.ok((await check(SaveModuleScheduleDto, { inherit: 'yes' })).fields.inherit);
    assert.ok((await check(SaveModuleScheduleDto, { inherit: true, schedule: 'x' })).fields.schedule);
  });

  it('accept only the four known steps', async () => {
    for (const step of ['data', 'schedule', 'category', 'review']) assert.deepEqual((await check(SaveProgressDto, { step })).errors, []);
    assert.ok((await check(SaveProgressDto, { step: 'payments' })).fields.step);
    assert.ok((await check(SaveProgressDto, {})).fields.step);
  });
});
