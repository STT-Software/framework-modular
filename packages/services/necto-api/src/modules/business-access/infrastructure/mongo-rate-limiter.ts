import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RateLimiter } from '../domain/rate-limiter';
import { RateLimitRecord } from './rate-limit.schema';

/**
 * A fixed-window counter per key, kept in MongoDB so every instance of the backend shares it. The whole
 * "start a new window or add one" decision is a single atomic update, so two requests at once can never both
 * read the same count.
 */
@Injectable()
export class MongoRateLimiter extends RateLimiter {
  constructor(@InjectModel(RateLimitRecord.name) private readonly model: Model<RateLimitRecord>) {
    super();
  }

  async hit(key: string, limit: number, windowMs: number, now: Date): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const cutoff = new Date(now.getTime() - windowMs);
    const windowEnded = { $lt: [{ $ifNull: ['$windowStart', new Date(0)] }, cutoff] };
    const record = await this.model.collection.findOneAndUpdate(
      { _id: key as never },
      [
        {
          $set: {
            count: { $cond: [windowEnded, 1, { $add: ['$count', 1] }] },
            windowStart: { $cond: [windowEnded, now, '$windowStart'] },
            expiresAt: { $cond: [windowEnded, new Date(now.getTime() + windowMs + 60_000), '$expiresAt'] },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    );
    const count = record?.count as number;
    const windowStart = record?.windowStart as Date;
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000)),
    };
  }
}
