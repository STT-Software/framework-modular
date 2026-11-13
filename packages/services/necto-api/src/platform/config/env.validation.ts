/**
 * Validates the environment variables on startup. If a required one is missing or weak, the app does
 * not start (better to fail at startup than to run with an insecure configuration).
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const text = (key: string): string => {
    const value = config[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  const required = ['MONGODB_URI', 'JWT_SECRET', 'OTP_SECRET'];
  const missing = required.filter((key) => text(key) === '');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (text('JWT_SECRET').length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  if (text('OTP_SECRET').length < 32) {
    throw new Error('OTP_SECRET must be at least 32 characters long');
  }
  if (text('OTP_SECRET') === text('JWT_SECRET')) {
    throw new Error('OTP_SECRET must be different from JWT_SECRET');
  }

  // Mail is optional, but if an SMTP host is set the rest has to make sense.
  if (text('MAIL_SMTP_HOST') !== '') {
    if (text('MAIL_FROM') === '') {
      throw new Error('MAIL_FROM is required when MAIL_SMTP_HOST is set');
    }
    const port = text('MAIL_SMTP_PORT');
    if (port !== '' && !(Number.isInteger(Number(port)) && Number(port) > 0 && Number(port) < 65536)) {
      throw new Error('MAIL_SMTP_PORT must be a valid port number');
    }
    if (text('MAIL_SMTP_USER') !== '' && text('MAIL_SMTP_PASS') === '') {
      throw new Error('MAIL_SMTP_PASS is required when MAIL_SMTP_USER is set');
    }
  }

  // Numeric knobs of the one-time-code policy: when present they must be positive integers.
  for (const key of [
    'OTP_TTL_MINUTES',
    'OTP_MAX_ATTEMPTS',
    'OTP_RESEND_COOLDOWN_SECONDS',
    'OTP_ATTEMPT_WINDOW_MINUTES',
    'OTP_CONTEXT_ATTEMPT_LIMIT',
    'OTP_IP_ATTEMPT_LIMIT',
    'OTP_SEND_WINDOW_MINUTES',
    'OTP_CONTEXT_SEND_LIMIT',
    'OTP_IP_SEND_LIMIT',
  ]) {
    const raw = text(key);
    if (raw !== '' && !(Number.isInteger(Number(raw)) && Number(raw) > 0)) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  return config;
}
