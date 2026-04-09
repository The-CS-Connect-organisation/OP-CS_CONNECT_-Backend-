import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../config/supabase.js';

export const notFoundHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (error, req, res, _next) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    details = error.issues;
  } else if (error?.code === '23505') {
    // PostgreSQL unique constraint violation
    statusCode = 409;
    message = 'Duplicate resource';
  } else if (error?.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Referenced resource not found';
  }

  logger.error('Request failed', {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });

  // Log to error_logs table (fire-and-forget)
  supabase
    .from('error_logs')
    .insert({
      path: req.originalUrl,
      method: req.method,
      status_code: statusCode,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      meta: details,
    })
    .then(() => {})
    .catch(() => {});

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
};
