import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import Redis from 'ioredis';

let client = null;
let connected = false;

export const initRedis = async () => {
  if (!env.REDIS_URL) {
    logger.info('REDIS_URL not set — in-memory rate limiting active');
    return;
  }

  try {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
    });

    client.on('error', (err) => {
      logger.warn('Redis client error', { message: err.message });
    });

    await client.connect();
    connected = true;
    logger.info('Redis connected — distributed rate limiting active');
  } catch (err) {
    logger.warn('Redis unavailable — falling back to in-memory rate limiting', {
      message: err.message,
    });
  }
};

export const closeRedis = async () => {
  if (client) {
    await client.quit();
    client = null;
    connected = false;
  }
};

/** Returns the Redis client (or null if not connected) */
export const getRedisClient = () => connected ? client : null;

/**
 * Returns a Redis store factory compatible with express-rate-limit.
 * Usage:
 *   store: redisStore({ prefix: 'rl:', windowMs: 900000, max: 50 })
 */
export const redisStore = ({ prefix = 'rl:', windowMs = 900000, max = 50 } = {}) => {
  if (!connected || !client) {
    return undefined; // fall back to default in-memory store
  }

  return {
    async increment(key) {
      const fullKey = `${prefix}${key}`;
      const hits = await client.incr(fullKey);
      if (hits === 1) {
        await client.pexpire(fullKey, windowMs);
      }
      const ttl = await client.pttl(fullKey);
      return {
        totalHits: hits,
        resetTime: new Date(Date.now() + ttl),
      };
    },
    async decrement(key) {
      const fullKey = `${prefix}${key}`;
      await client.decr(fullKey);
    },
    async resetKey(key) {
      const fullKey = `${prefix}${key}`;
      await client.del(fullKey);
    },
  };
};
