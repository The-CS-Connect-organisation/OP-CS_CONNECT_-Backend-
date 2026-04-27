import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

logger.info('Supabase client initialized', { url: env.SUPABASE_URL });
