import pkg from 'bcryptjs';
const { hash } = pkg;
import { getRecord, queryRecords, updateRecord } from '../utils/firebaseDb.js';
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
    const existing = await queryRecords('users', (u) => u.email === entry.email);

    if (existing.length > 0) {
      // Update existing user
      const userId = existing[0].id;
      await updateRecord(`users/${userId}`, {
        name: entry.name,
        role: entry.role,
        is_active: true,
        password_hash: passwordHash,
      });
    } else {
      // Insert new user
      const userId = Date.now().toString();
      await updateRecord(`users/${userId}`, {
        id: userId,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        is_active: true,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  logger.info('Default users bootstrapped');
};
