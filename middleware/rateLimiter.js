/**
 * Rate Limiting Middleware
 * Provides granular rate limiting for different endpoints
 * Uses Redis when available, falls back to in-memory
 */

import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';

/**
 * Returns a Redis-compatible store for express-rate-limit
 */
const makeRedisStore = (prefix) => {
  const client = getRedisClient();
  if (!client) return undefined;

  return {
    async increment(key) {
      const k = `${prefix}${key}`;
      const hits = await client.incr(k);
      if (hits === 1) await client.pexpire(k, 900000);
      const ttl = await client.pttl(k);
      return { totalHits: hits, resetTime: new Date(Date.now() + ttl) };
    },
    async decrement(key) {
      const k = `${prefix}${key}`;
      const hits = await client.decr(k);
      if (hits < 0) await client.set(k, '0', 'PX', 900000);
    },
    async resetKey(key) { await client.del(`${prefix}${key}`); },
  };
};

/**
 * General API rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  store: makeRedisStore('rl:general:'),
});

/**
 * Authentication rate limiter (stricter)
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50, // 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.',
  store: makeRedisStore('rl:auth:'),
});

/**
 * Attendance marking rate limiter
 */
export const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id}-attendance`,
  message: 'Too many attendance marking requests, please slow down.',
});

/**
 * Grading rate limiter
 */
export const gradingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id}-grading`,
  message: 'Too many grading requests, please slow down.',
});

/**
 * Messaging rate limiter
 */
export const messagingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id}-messaging`,
  message: 'Too many messages, please slow down.',
});

/**
 * Export rate limiter
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id}-export`,
  message: 'Too many exports, please try again later.',
});

export default {
  generalLimiter,
  authLimiter,
  attendanceLimiter,
  gradingLimiter,
  messagingLimiter,
  exportLimiter,
};
