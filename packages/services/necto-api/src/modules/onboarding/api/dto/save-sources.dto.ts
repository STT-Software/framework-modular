import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PROFILE_SOURCES, SOURCE_OTHER_MAX_LENGTH, type ProfileSource } from '../../domain/profile-sources';

export class SaveSourcesDto {
  /**
   * One option, or none: an empty list is "Skip" and completes the profile just the same.
   * Profiles saved before this rule may still hold several options; they are kept until saved again.
   */
  @IsArray()
  @ArrayMaxSize(1, { message: 'sources must contain at most one option' })
  @ArrayUnique()
  @IsIn(PROFILE_SOURCES, {
    each: true,
    message: `each source must be one of: ${PROFILE_SOURCES.join(', ')}`,
  })
  sources: ProfileSource[];

  /**
   * Free text for "other" (trimmed, empty means none). It is only kept when `sources` is `["other"]`;
   * with any other choice the service drops it.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(SOURCE_OTHER_MAX_LENGTH, {
    message: `sourceOther must be at most ${SOURCE_OTHER_MAX_LENGTH} characters long`,
  })
  sourceOther?: string | null;
}
