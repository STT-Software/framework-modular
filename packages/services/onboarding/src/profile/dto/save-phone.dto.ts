import { Matches } from 'class-validator';

export class SavePhoneDto {
  /**
   * E.164: "+", country code (no leading zero) and number, 8 to 15 digits in total.
   * The client sends it already composed (country code + number without spaces).
   */
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be in E.164 format, for example +573001234567',
  })
  phone: string;
}
