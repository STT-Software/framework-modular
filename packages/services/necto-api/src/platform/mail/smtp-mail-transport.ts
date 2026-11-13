import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { MailSendError, MailTransport, type MailAcceptance, type MailFailureCode, type MailMessage } from './mail-transport';
import type { SmtpConfig } from './mail.config';

const CONNECTION_ERRORS = new Set(['ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'ESOCKET', 'EDNS', 'ENOTFOUND', 'EHOSTUNREACH', 'EAUTH', 'ETLS', 'ECERT']);

/** Maps what nodemailer reports to a code that is safe to store and show. */
export function classifySmtpError(error: unknown): MailFailureCode {
  const { code, responseCode } = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  if (code === 'ETIMEDOUT' || code === 'ECONNTIMEOUT') return 'timeout';
  if (typeof code === 'string' && CONNECTION_ERRORS.has(code)) return 'connection';
  if (typeof responseCode === 'number' && responseCode >= 400) return 'rejected';
  return 'unknown';
}

/**
 * Real SMTP delivery through nodemailer. TLS certificates are always verified (nothing here turns that
 * off). A resolved `send` means the SMTP server accepted the message, not that it reached an inbox.
 */
@Injectable()
export class SmtpMailTransport extends MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    super();
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure && config.requireTls,
      auth: config.user ? { user: config.user, pass: config.password ?? '' } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<MailAcceptance> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      if ((info.rejected?.length ?? 0) > 0 || (info.accepted?.length ?? 0) === 0) {
        throw new MailSendError('rejected');
      }
      return { messageId: typeof info.messageId === 'string' ? info.messageId : null };
    } catch (error) {
      if (error instanceof MailSendError) throw error;
      throw new MailSendError(classifySmtpError(error));
    }
  }
}
