import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailTransport } from './mail-transport';
import { readSmtpConfig } from './mail.config';
import { SmtpMailTransport } from './smtp-mail-transport';
import { UnconfiguredMailTransport } from './unconfigured-mail-transport';

/**
 * Outgoing email for the whole backend. With `MAIL_SMTP_HOST` set, messages go out through that SMTP server;
 * without it, every send fails with `not-configured` (it never simulates a send).
 */
@Module({
  providers: [
    {
      provide: MailTransport,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailTransport => {
        const logger = new Logger('Mail');
        const smtp = readSmtpConfig(config);
        if (!smtp) {
          logger.warn('No mail provider configured (MAIL_SMTP_HOST is empty): emails will fail until it is set');
          return new UnconfiguredMailTransport();
        }
        logger.log(`Mail through SMTP ${smtp.host}:${smtp.port} (${smtp.secure ? 'implicit TLS' : smtp.requireTls ? 'STARTTLS required' : 'STARTTLS optional'})`);
        return new SmtpMailTransport(smtp);
      },
    },
  ],
  exports: [MailTransport],
})
export class MailModule {}
