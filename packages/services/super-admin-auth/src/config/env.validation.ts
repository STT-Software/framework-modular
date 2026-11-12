/**
 * Validates the environment variables on startup. If a required one is missing or
 * the JWT secret is weak, the app does not start (better to fail at startup than
 * to run with an insecure configuration).
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if ((config.JWT_SECRET as string).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  return config;
}
