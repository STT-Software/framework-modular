/** Counts events per key in a time window, shared by every instance because the count lives in the database. */
export abstract class RateLimiter {
  /** Counts one event for `key`. `allowed` is false once the key went over `limit` within the window. */
  abstract hit(key: string, limit: number, windowMs: number, now: Date): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}
