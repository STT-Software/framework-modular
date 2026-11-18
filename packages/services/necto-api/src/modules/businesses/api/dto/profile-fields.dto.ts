import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, IsEmail, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { BUSINESS_CATEGORY_IDS, type BusinessCategoryId } from '../../domain/catalog';
import { normalizeEmail, optionalText } from '../../../../platform/text/normalize';
import { asWebsite, blankToNull, trimmed } from './field-transforms';

/** The contact and identity fields of a business: what its owner types when creating it and what its administrator may correct. */
export class BusinessContactDto {
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

}

/** `category` of a business. Shared by the owner's form and the administrator's "type of business" step. */
export const CategoryField = () =>
  applyDecorators(IsIn(BUSINESS_CATEGORY_IDS, { message: `category must be one of: ${BUSINESS_CATEGORY_IDS.join(', ')}` }));

/** Required when the category is "other"; ignored for any other category. */
export const CategoryOtherField = () =>
  applyDecorators(
    Transform(blankToNull),
    ValidateIf((dto: { category?: unknown }) => dto.category === 'other'),
    IsString({ message: 'categoryOther is required when the category is "other"' }),
    MinLength(2, { message: 'categoryOther must be at least 2 characters long' }),
    MaxLength(60, { message: 'categoryOther must be at most 60 characters long' }),
  );

/** The type of a business. Choosing "other" requires its description. */
export class BusinessCategoryDto {
  @CategoryField()
  category: BusinessCategoryId;
  @CategoryOtherField()
  categoryOther?: string | null;
}
