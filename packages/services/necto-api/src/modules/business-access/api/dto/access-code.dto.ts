import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../../../platform/text/normalize';

const asEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);

export class RequestCodeDto {
  /** Id of the business whose access page the person opened (it comes in the link of the email). */
  @Matches(/^[a-f0-9]{24}$/, { message: 'businessId is not valid' })
  businessId: string;

  @Transform(asEmail)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;
}

export class VerifyCodeDto extends RequestCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
