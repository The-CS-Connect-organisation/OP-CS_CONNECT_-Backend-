import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    // Verify connection with a lightweight ping
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows — that's fine, table exists
      throw new Error(error.message);
    }
    logger.info('Supabase database connected');
  } catch (err) {
    logger.error('Supabase connection error', { message: err.message });
    throw new Error(`Supabase connection failed: ${err.message}`);
  }
};

export const closeDatabase = async () => {
  // Supabase HTTP client — nothing to close
  logger.info('Supabase client released');
};
