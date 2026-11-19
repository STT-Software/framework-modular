import { Transform } from 'class-transformer';
import { IsMongoId, IsString, Matches } from 'class-validator';

export class VerifyRegistrationDto {
  @IsString()
  @IsMongoId({ message: 'registrationId must be a valid id' })
  registrationId: string;

  /** Spaces are removed, so a code pasted as "123 456" is accepted. */
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '') : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
