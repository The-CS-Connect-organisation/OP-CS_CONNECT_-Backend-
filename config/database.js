// Database connection is now handled by the Supabase client (stateless HTTP).
// This file is kept for backward compatibility with server.js imports.
// No connection lifecycle is needed — Supabase JS SDK manages connections automatically.

import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  // Verify Supabase connectivity with a simple query
  const { error } = await supabase.from('users').select('id', { count: 'exact', head: true });
  if (error) {
    logger.error('Supabase connection check failed', { message: error.message });
    throw new Error(`Supabase connection failed: ${error.message}`);
  }
  logger.info('Supabase connection verified');
};

export const closeDatabase = async () => {
  // No-op: Supabase client is stateless
  logger.info('Supabase client cleanup (no-op)');
};
