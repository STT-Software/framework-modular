import type { ConfigService } from '@nestjs/config';

export interface SmtpConfig {
  host: string;
  port: number;
  /** true = implicit TLS from the first byte (usually port 465). false = plain connection upgraded with STARTTLS. */
  secure: boolean;
  /** With `secure: false`, refuse to continue if the server does not offer STARTTLS. */
  requireTls: boolean;
  user: string | null;
  password: string | null;
  from: string;
}

function flag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  return ['1', 'true', 'yes'].includes(raw.trim().toLowerCase());
}

/** The SMTP settings, or null when no SMTP host is configured. Validated at startup by `validateEnv`. */
export function readSmtpConfig(config: ConfigService): SmtpConfig | null {
  const host = config.get<string>('MAIL_SMTP_HOST')?.trim();
  if (!host) return null;
  const secure = flag(config.get<string>('MAIL_SMTP_SECURE'), false);
  const user = config.get<string>('MAIL_SMTP_USER')?.trim() || null;
  return {
    host,
    port: Number(config.get<string>('MAIL_SMTP_PORT') ?? (secure ? 465 : 587)),
    secure,
    requireTls: flag(config.get<string>('MAIL_SMTP_REQUIRE_TLS'), true),
    user,
    password: user ? (config.get<string>('MAIL_SMTP_PASS') ?? '') : null,
    from: config.getOrThrow<string>('MAIL_FROM').trim(),
  };
}
