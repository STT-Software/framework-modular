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
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BUSINESS_MODULE_IDS,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  type BusinessCategoryId,
  type BusinessModuleId,
} from '../../domain/catalog';
import type { BusinessDraft } from '../../domain/business';
import { asEmail, trimmed } from './field-transforms';
import { BusinessContactDto, CategoryField, CategoryOtherField } from './profile-fields.dto';
import { canonicalTimeZone, IsCurrencyCode, IsIanaTimeZone } from './validators';
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
export class BusinessDto extends BusinessContactDto {
  @CategoryField()
  category: BusinessCategoryId;
  /** Required when the category is "other"; ignored for any other category. */
  @CategoryOtherField()
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
