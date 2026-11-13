import { ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import { PROFILE_SOURCES, type ProfileSource } from '../../domain/profile-sources';

export class SaveSourcesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'sources must contain at least one option' })
  @ArrayUnique()
  @IsIn(PROFILE_SOURCES, {
    each: true,
    message: `each source must be one of: ${PROFILE_SOURCES.join(', ')}`,
  })
  sources: ProfileSource[];
}
