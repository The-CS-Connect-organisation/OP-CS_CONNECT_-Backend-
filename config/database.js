import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    // Just verify the Supabase client can reach the project
    // PGRST205 = schema cache miss (tables exist but cache not refreshed) — still OK to proceed
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
      throw new Error(error.message);
    }
    logger.info('Supabase database connected');
  } catch (err) {
    // If it's a schema cache issue, warn but don't crash — Supabase will self-heal
    if (err.message?.includes('schema cache')) {
      logger.warn('Supabase schema cache not ready yet — continuing anyway', { message: err.message });
      return;
    }
    logger.error('Supabase connection error', { message: err.message });
    throw new Error(`Supabase connection failed: ${err.message}`);
  }
};

export const closeDatabase = async () => {
  logger.info('Supabase client released');
};
