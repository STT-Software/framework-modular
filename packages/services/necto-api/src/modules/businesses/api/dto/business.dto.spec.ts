import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../platform/errors/validation-exception.factory';
import { BusinessDto, toBusinessDraft } from './business.dto';

const valid = {
  name: 'Café Central',
  category: 'gastronomy',
  modules: ['reservas', 'turnos', 'agendamiento', 'referidos', 'inventario', 'pedidos'],
  boss: { name: 'Ana Gómez', email: 'Ana@CafeCentral.co' },
};

/** Runs the same validation the API runs and returns the dto and the problems by field. */
async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(BusinessDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const fields = (validationExceptionFactory(errors).getResponse() as { fields: Record<string, string[]> }).fields;
  return { dto, errors, fields };
}

describe('business request validation', () => {
  it('accepts the minimum and fills in the defaults', async () => {
    const { errors, dto } = await check({ ...valid, modules: [] });
    assert.deepEqual(errors, []);
    const draft = toBusinessDraft(dto);
    assert.equal(draft.profile.currency, 'COP');
    assert.equal(draft.profile.timezone, 'America/Bogota');
    assert.equal(draft.boss.email, 'ana@cafecentral.co');
  });

  it('accepts from zero to six modules, and rejects unknown, repeated or malformed selections', async () => {
    assert.deepEqual((await check(valid)).errors, []);
    assert.deepEqual((await check({ ...valid, modules: [] })).errors, []);
    assert.deepEqual((await check({ ...valid, modules: ['reservas', 'agendamiento'] })).errors, [], 'reservas and agendamiento are different modules');
    assert.ok((await check({ ...valid, modules: ['reservas', 'facturacion'] })).fields.modules);
    assert.ok((await check({ ...valid, modules: ['reservas', 'reservas'] })).fields.modules);
    assert.ok((await check({ ...valid, modules: 'reservas' })).fields.modules);
    assert.ok((await check({ ...valid, modules: undefined })).fields.modules);
  });

  it('requires the name, the category and a valid boss, reporting each problem on its own field', async () => {
    assert.ok((await check({ ...valid, name: ' ' })).fields.name);
    assert.ok((await check({ ...valid, name: undefined })).fields.name);
    assert.ok((await check({ ...valid, category: undefined })).fields.category);
    assert.ok((await check({ ...valid, category: 'invented' })).fields.category);
    assert.ok((await check({ ...valid, boss: undefined })).fields.boss);
    assert.ok((await check({ ...valid, boss: { name: 'A', email: 'ana@x.co' } })).fields['boss.name']);
    assert.ok((await check({ ...valid, boss: { name: 'Ana', email: 'not-an-email' } })).fields['boss.email']);
    assert.ok((await check({ ...valid, boss: { name: 'Ana' } })).fields['boss.email']);
  });

  it('requires a text of its own for the category "other" and ignores it for the rest', async () => {
    assert.ok((await check({ ...valid, category: 'other' })).fields.categoryOther);
    assert.ok((await check({ ...valid, category: 'other', categoryOther: ' ' })).fields.categoryOther);
    assert.deepEqual((await check({ ...valid, category: 'other', categoryOther: 'Floristería' })).errors, []);
    assert.deepEqual((await check({ ...valid, category: 'retail', categoryOther: 'lo que sea' })).errors, []);
  });

  it('treats blank optional fields as not sent, and validates them when they have content', async () => {
    const blanks = await check({ ...valid, legalName: ' ', taxId: '', phone: '  ', address: '', supportEmail: '', website: '' });
    assert.deepEqual(blanks.errors, []);
    assert.equal(toBusinessDraft(blanks.dto).profile.phone, null);

    assert.ok((await check({ ...valid, supportEmail: 'nope' })).fields.supportEmail);
    assert.ok((await check({ ...valid, phone: '12' })).fields.phone);
    assert.ok((await check({ ...valid, phone: 'abcdefghij' })).fields.phone);
    assert.ok((await check({ ...valid, taxId: '#!' })).fields.taxId);
    assert.ok((await check({ ...valid, website: 'ftp://x.co' })).fields.website);
  });

  it('normalizes the phone, the tax id and the website', async () => {
    const { dto } = await check({ ...valid, phone: '+57 (300) 123-4567', taxId: '900.123.456-7', website: 'cafecentral.co' });
    const profile = toBusinessDraft(dto).profile;
    assert.equal(profile.phone, '+573001234567');
    assert.equal(profile.taxId, '900.123.456-7');
    assert.equal(profile.website, 'https://cafecentral.co');
  });

  it('accepts a valid currency and time zone and rejects invalid ones', async () => {
    assert.deepEqual((await check({ ...valid, currency: 'usd', timezone: 'Europe/Madrid' })).errors, []);
    assert.ok((await check({ ...valid, currency: 'ZZZ' })).fields.currency);
    assert.ok((await check({ ...valid, currency: 'peso' })).fields.currency);
    assert.ok((await check({ ...valid, timezone: 'Mars/Olympus' })).fields.timezone);
    assert.ok((await check({ ...valid, timezone: '+05:00' })).fields.timezone);
    assert.equal(toBusinessDraft((await check({ ...valid, currency: 'usd' })).dto).profile.currency, 'USD');
  });

  it('rejects an owner or any other field the client has no business sending', async () => {
    assert.ok((await check({ ...valid, ownerId: 'someone-else' })).fields.ownerId);
    assert.ok((await check({ ...valid, status: 'paused' })).fields.status);
    assert.ok((await check({ ...valid, role: 'superadmin' })).fields.role);
    assert.ok((await check({ ...valid, boss: { ...valid.boss, assignmentId: 'x' } })).fields['boss.assignmentId']);
  });
});
