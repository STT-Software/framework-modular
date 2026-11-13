import type { ConfigService } from '@nestjs/config';
import { AccessPolicy } from './domain/access-policy';

const MINUTE = 60_000;

/**
 * Builds the access policy from the environment. Defaults are the product's initial values: ten-minute codes,
 * five tries per code, sixty seconds between codes. Every number can be changed in `.env` (see `.env.example`).
 * `validateEnv` already rejected bad values, so reading them here is safe.
 */
export function accessPolicyFromConfig(config: ConfigService): AccessPolicy {
  const number = (key: string, fallback: number): number => {
    const raw = config.get<string>(key);
    return raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  };
  const attemptWindowMs = number('OTP_ATTEMPT_WINDOW_MINUTES', 15) * MINUTE;
  const sendWindowMs = number('OTP_SEND_WINDOW_MINUTES', 60) * MINUTE;
  return {
    secret: config.getOrThrow<string>('OTP_SECRET'),
    ttlMs: number('OTP_TTL_MINUTES', 10) * MINUTE,
    maxAttempts: number('OTP_MAX_ATTEMPTS', 5),
    resendCooldownMs: number('OTP_RESEND_COOLDOWN_SECONDS', 60) * 1000,
    attemptWindowMs,
    contextAttemptLimit: number('OTP_CONTEXT_ATTEMPT_LIMIT', 10),
    ipAttemptLimit: number('OTP_IP_ATTEMPT_LIMIT', 30),
    sendWindowMs,
    contextSendLimit: number('OTP_CONTEXT_SEND_LIMIT', 5),
    ipSendLimit: number('OTP_IP_SEND_LIMIT', 20),
    publicAppUrl: (config.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:6020').trim(),
  };
}
