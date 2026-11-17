import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../../../platform/text/normalize';

const asEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);

export class RequestCodeDto {
  @Transform(asEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;
}

export class VerifyCodeDto extends RequestCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  /** The person's explicit choice to keep this device signed in for up to 30 days. Off unless sent as true. */
  @IsOptional()
  @IsBoolean({ message: 'remember must be true or false' })
  remember?: boolean;
}

export class ReverifyDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
