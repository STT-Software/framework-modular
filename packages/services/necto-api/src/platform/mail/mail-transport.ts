export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * What the provider told us when it took the message. This is acceptance by the provider (for SMTP, the
 * server answered 250 to the message), NOT proof that the recipient received it: a message can still
 * bounce, be filtered or sit in a queue afterwards. Do not present it as "delivered".
 */
export interface MailAcceptance {
  messageId: string | null;
}

/** Why a message could not be handed to the provider. Never carries credentials, addresses or the message. */
export type MailFailureCode = 'not-configured' | 'rejected' | 'timeout' | 'connection' | 'unknown';

export class MailSendError extends Error {
  constructor(readonly code: MailFailureCode) {
    super(`Mail could not be sent: ${code}`);
    this.name = 'MailSendError';
  }
}

/** Sends an email. The only place that knows about SMTP or any provider is the implementation. */
export abstract class MailTransport {
  /** @throws MailSendError when the provider did not accept the message. */
  abstract send(message: MailMessage): Promise<MailAcceptance>;
}
