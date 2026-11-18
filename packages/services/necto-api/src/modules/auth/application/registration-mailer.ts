import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { MailSendError, MailTransport } from '../../../platform/mail/mail-transport';
import { RegistrationPolicy } from '../domain/registration-policy';
import { buildRegistrationEmail } from './registration-email';

export interface RegistrationMailJob {
  registrationId: string;
  username: string;
  email: string;
  code: string;
}

/**
 * Sends the registration code in the background, like the business access emails: the request does not wait for
 * the mail provider. A failure is logged with the registration id and a failure code only (never the address or the code).
 */
@Injectable()
export class RegistrationMailer implements OnApplicationShutdown {
  private readonly logger = new Logger(RegistrationMailer.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly transport: MailTransport,
    private readonly policy: RegistrationPolicy,
  ) {}

  dispatch(job: RegistrationMailJob): void {
    const task: Promise<void> = this.deliver(job).finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  onApplicationShutdown(): Promise<void> {
    return this.drain();
  }

  private async deliver(job: RegistrationMailJob): Promise<void> {
    try {
      const email = buildRegistrationEmail({
        username: job.username,
        code: job.code,
        ttlMinutes: Math.round(this.policy.ttlMs / 60_000),
        registerUrl: new URL('/super/register', this.policy.publicAppUrl).toString(),
      });
      await this.transport.send({ to: job.email, ...email });
    } catch (error) {
      const failureCode = error instanceof MailSendError ? error.code : 'unknown';
      this.logger.warn(`Registration email not sent (registration ${job.registrationId}): ${failureCode}`);
    }
  }
}
