import pkg from 'bcryptjs';
const { hash } = pkg;
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export const bootstrapDefaultUsers = async () => {
  const defaults = [
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu',  role: 'admin',   password: 'admin123'   },
    { name: 'James Anderson', email: 'james@schoolsync.edu', role: 'teacher', password: 'teacher123' },
    { name: 'Aarav Menon',    email: 'alex@schoolsync.edu',  role: 'student', password: 'student123' },
    { name: 'Priya Menon',    email: 'parent@schoolsync.edu',role: 'parent',  password: 'parent123'  },
  ];

  for (const entry of defaults) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', entry.email)
      .maybeSingle();

    if (existing) {
      logger.info(`User ${entry.email} already exists, skipping`);
      continue;
    }

    const passwordHash = await hash(entry.password, 12);
    const { error } = await supabase.from('users').insert({
      name: entry.name,
      email: entry.email,
      role: entry.role,
      is_active: true,
      password_hash: passwordHash,
    });

    if (error) {
      logger.error(`Failed to create default user ${entry.email}`, { error: error.message });
    } else {
      logger.info(`Created default user: ${entry.email}`);
    }
  }

  logger.info('Default users bootstrap complete');
};
