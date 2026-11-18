import type { ConfigService } from '@nestjs/config';
import { RegistrationPolicy } from './domain/registration-policy';

/** Same `OTP_*` settings and defaults as the business access codes (validated at startup by `validateEnv`). */
export function registrationPolicyFromConfig(config: ConfigService): RegistrationPolicy {
  const number = (key: string, fallback: number): number => {
    const raw = config.get<string>(key);
    return raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  };
  return {
    secret: config.getOrThrow<string>('OTP_SECRET'),
    ttlMs: number('OTP_TTL_MINUTES', 10) * 60_000,
    maxAttempts: number('OTP_MAX_ATTEMPTS', 5),
    resendCooldownMs: number('OTP_RESEND_COOLDOWN_SECONDS', 60) * 1000,
    // Fixed: 5 codes per address every 30 minutes caps the guesses against a mailbox the person may not own.
    maxSendsPerWindow: 5,
    sendWindowMs: 30 * 60_000,
    publicAppUrl: (config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:6020').trim(),
  };
}
