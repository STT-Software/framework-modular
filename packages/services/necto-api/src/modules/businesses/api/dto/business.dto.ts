import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BUSINESS_CATEGORY_IDS,
  BUSINESS_MODULE_IDS,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  type BusinessCategoryId,
  type BusinessModuleId,
} from '../../domain/catalog';
import type { BusinessDraft } from '../../domain/business';
import { normalizeEmail, optionalText } from '../../../../platform/text/normalize';
import { canonicalTimeZone, IsCurrencyCode, IsIanaTimeZone } from './validators';

/** Trimmed text; an empty string becomes null so "left blank" and "not sent" mean the same. */
const blankToNull = ({ value }: { value: unknown }) => (typeof value === 'string' ? optionalText(value) : value);
const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const asEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);

/** Adds https:// to a website typed without a scheme, so "mishop.co" is accepted. */
const asWebsite = ({ value }: { value: unknown }) => {
  const text = typeof value === 'string' ? optionalText(value) : value;
  return typeof text === 'string' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? `https://${text}` : text;
};

export class BossDto {
  @Transform(trimmed)
  @IsString()
  @MinLength(2, { message: 'boss.name must be at least 2 characters long' })
  @MaxLength(100, { message: 'boss.name must be at most 100 characters long' })
  name: string;

  @Transform(asEmail)
  @IsEmail({}, { message: 'boss.email must be a valid email address' })
  @MaxLength(254)
  email: string;
}

/** The data of a business, for creating one and for editing it (the owner is never part of it: it comes from the session). */
export class BusinessDto {
  @Transform(trimmed)
  @IsString()
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  @MaxLength(120, { message: 'name must be at most 120 characters long' })
  name: string;

  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  legalName?: string | null;

  /** Tax id (NIT): letters, digits, dots and hyphens; spaces are removed. */
  @Transform(({ value }) => (typeof value === 'string' ? optionalText(value.replace(/\s+/g, '')) : value))
  @IsOptional()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9.-]{3,19}$/, { message: 'taxId must be 4 to 20 characters: letters, digits, dots or hyphens' })
  taxId?: string | null;

  /** Dots, spaces, hyphens and parentheses are removed: "+57 (300) 123-4567" is stored as +573001234567. */
  @Transform(({ value }) => (typeof value === 'string' ? optionalText(value.replace(/[\s().-]/g, '')) : value))
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must have 7 to 15 digits, with an optional leading +' })
  phone?: string | null;

  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @Transform(({ value }) => (typeof value === 'string' ? optionalText(normalizeEmail(value)) : value))
  @IsOptional()
  @IsEmail({}, { message: 'supportEmail must be a valid email address' })
  @MaxLength(254)
  supportEmail?: string | null;

  @Transform(asWebsite)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'website must be a valid http or https URL' })
  @MaxLength(200)
  website?: string | null;

  @IsIn(BUSINESS_CATEGORY_IDS, { message: `category must be one of: ${BUSINESS_CATEGORY_IDS.join(', ')}` })
  category: BusinessCategoryId;

  /** Required when the category is "other"; ignored for any other category. */
  @Transform(blankToNull)
  @ValidateIf((dto: BusinessDto) => dto.category === 'other')
  @IsString({ message: 'categoryOther is required when the category is "other"' })
  @MinLength(2, { message: 'categoryOther must be at least 2 characters long' })
  @MaxLength(60, { message: 'categoryOther must be at most 60 characters long' })
  categoryOther?: string | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsCurrencyCode()
  currency?: string;

  @Transform(trimmed)
  @IsOptional()
  @IsIanaTimeZone()
  timezone?: string;

  /** Between zero and six functionalities, each one at most once. */
  @IsArray({ message: 'modules must be a list' })
  @ArrayMaxSize(BUSINESS_MODULE_IDS.length)
  @ArrayUnique({}, { message: 'modules must not repeat a module' })
  @IsIn(BUSINESS_MODULE_IDS, { each: true, message: `each module must be one of: ${BUSINESS_MODULE_IDS.join(', ')}` })
  modules: BusinessModuleId[];

  /** Required: a business is never created or edited without its boss. `ValidateNested` alone lets a missing boss through. */
  @IsDefined({ message: 'boss is required' })
  @ValidateNested()
  @Type(() => BossDto)
  boss: BossDto;
}

/** The validated request as the domain wants it, with the defaults filled in. */
export function toBusinessDraft(dto: BusinessDto): BusinessDraft {
  return {
    profile: {
      name: dto.name,
      legalName: dto.legalName ?? null,
      taxId: dto.taxId ?? null,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      supportEmail: dto.supportEmail ?? null,
      website: dto.website ?? null,
      category: dto.category,
      categoryOther: dto.categoryOther ?? null,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      timezone: canonicalTimeZone(dto.timezone ?? DEFAULT_TIMEZONE) ?? DEFAULT_TIMEZONE,
      modules: dto.modules,
    },
    boss: { name: dto.boss.name, email: dto.boss.email },
  };
}
