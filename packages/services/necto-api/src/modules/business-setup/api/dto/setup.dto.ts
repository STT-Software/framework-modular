import { Transform } from 'class-transformer';
import { IsBoolean, IsDefined, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { BusinessContactDto } from '../../../businesses/public';
import { SETUP_STEPS, type SetupStep } from '../../domain/setup-steps';

const blankToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  return text === '' ? null : text;
};

export const DESCRIPTION_MAX_LENGTH = 500;

/**
 * The form of "Datos del negocio": the contact data of the business (validated exactly as the owner's form does) and the
 * description. Currency, time zone, modules and boss are NOT here: a body that sends them is rejected.
 */
export class SaveProfileDto extends BusinessContactDto {
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH, { message: `description must be at most ${DESCRIPTION_MAX_LENGTH} characters long` })
  description?: string | null;
}

/** A full week of hours. Its content (days, ranges, times) is validated by the domain, field by field. */
export class SaveScheduleDto {
  @IsDefined({ message: 'schedule is required' })
  @IsObject({ message: 'schedule must be an object with the seven days of the week' })
  schedule: unknown;
}

export class SaveModuleScheduleDto {
  @IsBoolean({ message: 'inherit must be true or false' })
  inherit: boolean;

  /** Optional: the module's own hours. Content validated by the domain. */
  @IsOptional()
  @IsObject({ message: 'schedule must be an object with the seven days of the week' })
  schedule?: unknown;
}

export class SaveProgressDto {
  @IsIn(SETUP_STEPS, { message: `step must be one of: ${SETUP_STEPS.join(', ')}` })
  step: SetupStep;
}
