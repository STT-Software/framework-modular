import { Transform } from 'class-transformer';
import { ValidateBy } from 'class-validator';
import { normalizePhoneNumber } from '../../domain/phone-number';

/** Valid when the transform below could turn the input into a canonical E.164 mobile number. */
function IsCanonicalMobilePhone() {
  return ValidateBy({
    name: 'isCanonicalMobilePhone',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && normalizePhoneNumber(value) === value,
      defaultMessage: () =>
        'phone must be a mobile number with its country code, in E.164 format, for example +573001234567',
    },
  });
}

export class SavePhoneDto {
  /**
   * A mobile number with its country code. It is normalized to E.164 before it is validated ("+57 300 123 4567"
   * becomes "+573001234567"), so the same number always reaches the service written the same way. Anything that is
   * not a valid mobile number of its country is left as is and rejected with a 400.
   */
  @Transform(({ value }) => normalizePhoneNumber(value) ?? value)
  @IsCanonicalMobilePhone()
  phone: string;
}
