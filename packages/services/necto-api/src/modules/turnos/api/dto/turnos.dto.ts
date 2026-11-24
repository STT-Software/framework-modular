import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
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

/** An extra thing a queue asks when a turn is created. The rules (labels, types, options) are checked by the domain. */
export class QueueFieldDto {
  @IsOptional()
  @IsString({ message: 'id must be text' })
  @MaxLength(60)
  id?: string | null;
  @IsString({ message: 'label must be text' })
  @MaxLength(200)
  label: string;
  @IsString({ message: 'type must be text' })
  @MaxLength(40)
  type: string;
  @IsOptional()
  @IsBoolean({ message: 'required must be true or false' })
  required?: boolean | null;
  @IsOptional()
  @IsArray({ message: 'options must be a list' })
  @ArrayMaxSize(50)
  @IsString({ each: true, message: 'every option must be text' })
  options?: string[] | null;
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
  /** Left out, the queue keeps the extra fields it has. */
  @IsOptional()
  @IsArray({ message: 'fields must be a list' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QueueFieldDto)
  fields?: QueueFieldDto[] | null;
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
  /** The views of the workspace the operator may use. Left out, they keep theirs (every view for a new operator). */
  @IsOptional()
  @IsArray({ message: 'views must be a list' })
  @ArrayMaxSize(20)
  @IsString({ each: true, message: 'every view must be text' })
  views?: string[] | null;
  /** `active` or `inactive`. Left out, they keep theirs (a new operator is `pending` until their first sign-in). */
  @IsOptional()
  @IsString({ message: 'status must be text' })
  @MaxLength(20)
  status?: string | null;
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
