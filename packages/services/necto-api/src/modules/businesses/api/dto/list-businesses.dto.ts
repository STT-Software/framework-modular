import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { BUSINESS_CATEGORY_IDS, type BusinessCategoryId } from '../../domain/catalog';
import type { BusinessStatus } from '../../domain/business';

/** Filters shared by the list and the CSV export. */
export class BusinessFiltersDto {
  /** Text to look for in the business name, the boss name or email, and the address. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(BUSINESS_CATEGORY_IDS, { message: `category must be one of: ${BUSINESS_CATEGORY_IDS.join(', ')}` })
  category?: BusinessCategoryId;

  @IsOptional()
  @IsIn(['active', 'paused'], { message: 'status must be active or paused' })
  status?: BusinessStatus;
}

export class ListBusinessesDto extends BusinessFiltersDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
