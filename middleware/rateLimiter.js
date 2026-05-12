/**
 * Rate Limiting Middleware
 * Provides granular rate limiting for different endpoints
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  // Note: admin skip is intentionally removed — req.user is not populated
  // at the /api middleware level (auth runs per-route). IP-based limiting
  // is the correct approach here and applies equally to all roles.
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
