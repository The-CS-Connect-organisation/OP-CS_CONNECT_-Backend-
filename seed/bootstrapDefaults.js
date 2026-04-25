import pkg from 'bcryptjs';
const { hash } = pkg;
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

// Default users are only bootstrapped in development mode
// In production, create users via the admin API
export const bootstrapDefaultUsers = async () => {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Skipping default user bootstrap in production');
    return;
  }

  const defaults = [
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu', role: 'admin', password: 'admin123' },
    { name: 'James Anderson', email: 'james@schoolsync.edu', role: 'teacher', password: 'teacher123' },
    { name: 'Aarav Menon', email: 'alex@schoolsync.edu', role: 'student', password: 'student123' },
    { name: 'Priya Menon', email: 'parent@schoolsync.edu', role: 'parent', password: 'parent123' },
  ];

  for (const entry of defaults) {
    const passwordHash = await hash(entry.password, 12);

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', entry.email)
      .maybeSingle();

    if (existing) {
      // Update existing user
      await supabase
        .from('users')
        .update({
          name: entry.name,
          role: entry.role,
          is_active: true,
          password_hash: passwordHash,
        })
        .eq('id', existing.id);
    } else {
      // Insert new user
      await supabase
        .from('users')
        .insert({
          name: entry.name,
          email: entry.email,
          role: entry.role,
          is_active: true,
          password_hash: passwordHash,
        });
    }
  }

  logger.info('Default users bootstrapped');
};
