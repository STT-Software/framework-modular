import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { LIMITS, SETUP_STEPS, TURNOS_PROFILE_IDS, type SetupStep, type TurnosProfileId } from '../../domain/catalog';

/*
 * These classes only check the SHAPE of what arrives (types, lists, nested objects, no unknown fields). The rules (lengths,
 * ranges, prefixes, "full above busy", names and emails not repeated...) live in the domain, which reports every problem by
 * field, in the same format, whoever calls it.
 */

export class ChangeProfileDto {
  @IsIn(TURNOS_PROFILE_IDS, { message: `profile must be one of: ${TURNOS_PROFILE_IDS.join(', ')}` })
  profile: TurnosProfileId;

  /** Also add the suggested queues of the new profile (those that do not exist yet). Without it only the profile changes. */
  @IsOptional()
  @IsBoolean({ message: 'addSuggestedQueues must be true or false' })
  addSuggestedQueues?: boolean;
}

/** What a queue overrides of the general rules; a field left out or `null` uses the general value. */
export class QueueOverridesDto {
  @IsOptional()
  @IsString({ message: 'prefix must be text' })
  @MaxLength(40)
  prefix?: string | null;

  @IsOptional()
  @IsInt({ message: 'urgentMinutes must be a whole number' })
  urgentMinutes?: number | null;

  @IsOptional()
  @IsInt({ message: 'busyLimit must be a whole number' })
  busyLimit?: number | null;

  @IsOptional()
  @IsInt({ message: 'fullLimit must be a whole number' })
  fullLimit?: number | null;
}

export class QueueDto {
  @IsString({ message: 'name must be text' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString({ message: 'color must be text' })
  color?: string | null;

  @IsString({ message: 'mode must be text' })
  mode: string;

  @IsInt({ message: 'averageMinutes must be a whole number' })
  averageMinutes: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => QueueOverridesDto)
  overrides?: QueueOverridesDto | null;
}

export class RulesDto {
  @IsString({ message: 'prefixMode must be text' })
  prefixMode: string;

  @IsOptional()
  @IsString({ message: 'fixedPrefix must be text' })
  @MaxLength(40)
  fixedPrefix?: string | null;

  @IsBoolean({ message: 'dailyReset must be true or false' })
  dailyReset: boolean;

  @IsInt({ message: 'urgentMinutes must be a whole number' })
  urgentMinutes: number;

  @IsInt({ message: 'busyLimit must be a whole number' })
  busyLimit: number;

  @IsInt({ message: 'fullLimit must be a whole number' })
  fullLimit: number;
}

export class OperatorDto {
  @IsString({ message: 'name must be text' })
  @MaxLength(200)
  name: string;

  @IsString({ message: 'email must be text' })
  @MaxLength(320)
  email: string;

  @IsOptional()
  @IsString({ message: 'phone must be text' })
  @MaxLength(60)
  phone?: string | null;

  @IsArray({ message: 'queueIds must be a list' })
  @ArrayMaxSize(LIMITS.queuesPerBusiness)
  @IsString({ each: true, message: 'every queue id must be text' })
  queueIds: string[];
}

export class ReassignmentDto {
  @IsString({ message: 'operatorId must be text' })
  @MaxLength(100)
  operatorId: string;

  @IsString({ message: 'queueId must be text' })
  @MaxLength(100)
  queueId: string;
}

/** Deleting a queue: where each operator that would be left without queues goes. Optional when nobody would. */
export class DeleteQueueDto {
  @IsOptional()
  @IsArray({ message: 'reassignments must be a list' })
  @ArrayMaxSize(LIMITS.operatorsPerBusiness)
  @ValidateNested({ each: true })
  @Type(() => ReassignmentDto)
  reassignments?: ReassignmentDto[];
}

export class ProgressDto {
  @IsIn(SETUP_STEPS, { message: `step must be one of: ${SETUP_STEPS.join(', ')}` })
  step: SetupStep;
}
