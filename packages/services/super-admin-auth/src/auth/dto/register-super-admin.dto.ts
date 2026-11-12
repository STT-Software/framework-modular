import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const toLowerTrimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterSuperAdminDto {
  /**
   * Cannot contain "@": that way, at login, an identifier with "@" is always an
   * email and one without it is always a username.
   */
  @Transform(toLowerTrimmed)
  @IsString()
  @Matches(/^[a-z0-9._-]{3,30}$/, {
    message: 'username must be 3 to 30 characters: letters, numbers, dot, hyphen or underscore',
  })
  username: string;

  @Transform(toLowerTrimmed)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  /** Max 72: bcrypt only considers the first 72 bytes. */
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72, { message: 'password must be at most 72 characters long' })
  password: string;

  /** Dots and spaces are removed (1.032.556.778 becomes 1032556778). */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[.\s]/g, '').toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9-]{5,20}$/, {
    message: 'identityDocument must be 5 to 20 characters: letters, numbers or hyphen',
  })
  identityDocument: string;
}
