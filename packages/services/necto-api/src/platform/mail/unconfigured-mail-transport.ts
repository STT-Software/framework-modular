import { Injectable } from '@nestjs/common';
import { MailSendError, MailTransport, type MailAcceptance } from './mail-transport';

/**
 * Used when no mail provider is configured. It never pretends to send: every attempt fails with
 * `not-configured`, so the caller records a failure and the invitation can be re-sent once mail works.
 */
@Injectable()
export class UnconfiguredMailTransport extends MailTransport {
  async send(): Promise<MailAcceptance> {
    throw new MailSendError('not-configured');
  }
}
