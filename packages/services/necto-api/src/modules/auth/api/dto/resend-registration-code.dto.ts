import { IsMongoId, IsString } from 'class-validator';

export class ResendRegistrationCodeDto {
  @IsString()
  @IsMongoId({ message: 'registrationId must be a valid id' })
  registrationId: string;
}
