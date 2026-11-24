import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
/*
 * Like the configuration DTOs, these only check the SHAPE of what arrives. The rules (lengths, types of each extra field, required
 * answers, ranges of dates...) live in the domain, which reports every problem by field.
 */
export class CreateTicketDto {
  @IsOptional()
  @IsString({ message: 'customerName must be text' })
  @MaxLength(200)
  customerName?: string | null;
  @IsOptional()
  @IsString({ message: 'customerPhone must be text' })
  @MaxLength(60)
  customerPhone?: string | null;
  @IsOptional()
  @IsString({ message: 'customerEmail must be text' })
  @MaxLength(320)
  customerEmail?: string | null;
  @IsOptional()
  @IsString({ message: 'note must be text' })
  @MaxLength(1000)
  note?: string | null;
  /** The answers to the extra fields of the queue, by field id. */
  @IsOptional()
  @IsObject({ message: 'answers must be an object of field id and value' })
  answers?: Record<string, unknown> | null;
  /** Chosen by the page for each attempt: sending the same one twice creates the turn once. */
  @IsOptional()
  @IsString({ message: 'clientRequestId must be text' })
  @MaxLength(100)
  clientRequestId?: string | null;
}
export class CancelTicketDto {
  @IsOptional()
  @IsString({ message: 'reason must be text' })
  @MaxLength(1000)
  reason?: string | null;
}
const toNumber = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value);
const toList = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(',').map((item) => item.trim()) : value);
const toBoolean = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
/** The range every dashboard and report takes: a `range` preset (today, yesterday, 7d, 30d) or `from` and `to` days. */
export class RangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  range?: string;
  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;
  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;
}
export class TicketListQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  queueId?: string;
  /** One or several (comma separated): waiting, attending, completed, cancelled, no-show. */
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  status?: string[];
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  operatorId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(20)
  order?: string;
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}
export class ActivityQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
export class SurveyQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  queueId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  operatorId?: string;
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  rating?: number;
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}
export class RoomScreenDto {
  @IsBoolean({ message: 'enabled must be true or false' })
  enabled: boolean;
  @IsOptional()
  @IsArray({ message: 'queueIds must be a list' })
  @ArrayMaxSize(100)
  @IsString({ each: true, message: 'every queue id must be text' })
  queueIds?: string[] | null;
  @IsString({ message: 'customerName must be text' })
  @MaxLength(20)
  customerName: string;
  @IsBoolean({ message: 'playSound must be true or false' })
  playSound: boolean;
  @IsInt({ message: 'recentCalls must be a whole number' })
  recentCalls: number;
  @IsOptional()
  @IsString({ message: 'message must be text' })
  @MaxLength(1000)
  message?: string | null;
}
export class SurveyChannelsDto {
  @IsBoolean({ message: 'channels.email must be true or false' })
  email: boolean;
  @IsBoolean({ message: 'channels.whatsapp must be true or false' })
  whatsapp: boolean;
}
export class SurveyConfigDto {
  @IsBoolean({ message: 'enabled must be true or false' })
  enabled: boolean;
  @ValidateNested()
  @Type(() => SurveyChannelsDto)
  channels: SurveyChannelsDto;
  @IsString({ message: 'question must be text' })
  @MaxLength(1000)
  question: string;
  @IsBoolean({ message: 'allowComment must be true or false' })
  allowComment: boolean;
  @IsOptional()
  @IsString({ message: 'thanksMessage must be text' })
  @MaxLength(1000)
  thanksMessage?: string | null;
  @IsInt({ message: 'validHours must be a whole number' })
  validHours: number;
  @IsOptional()
  @IsArray({ message: 'queueIds must be a list' })
  @ArrayMaxSize(100)
  @IsString({ each: true, message: 'every queue id must be text' })
  queueIds?: string[] | null;
}
/** What the customer answers at the link of the survey. */
export class SurveyAnswerDto {
  @IsInt({ message: 'rating must be a whole number from 1 to 5' })
  rating: number;
  @IsOptional()
  @IsString({ message: 'comment must be text' })
  @MaxLength(2000)
  comment?: string | null;
}
