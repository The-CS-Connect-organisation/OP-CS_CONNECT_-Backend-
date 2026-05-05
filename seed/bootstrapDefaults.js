import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

// Bootstrap flag path in Firebase — written once after first successful seed.
// On every subsequent server start we read this single node (cheap) and skip entirely.
const BOOTSTRAP_FLAG_PATH = '_meta/bootstrap_done';

export const bootstrapDefaultUsers = async () => {
  // Single cheap read — if flag exists, we're done. No scanning users collection.
  const flagSnap = await db.ref(BOOTSTRAP_FLAG_PATH).once('value');
  if (flagSnap.val() === true) {
    logger.info('Bootstrap already completed — skipping');
    return;
  }

  const seedUsers = [
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu', role: 'admin', password: 'admin123' },
    { name: 'Rajesh Kumar', email: 'teacher@schoolsync.edu', role: 'teacher', password: 'teacher123' },
    { name: 'Priya Sharma', email: 'student@schoolsync.edu', role: 'student', password: 'student123' },
    { name: 'Vikram Singh', email: 'parent@schoolsync.edu', role: 'parent', password: 'parent123' },
    { name: 'Amit Patel', email: 'driver@schoolsync.edu', role: 'driver', password: 'driver123' },
    { name: 'Deepak Verma', email: 'librarian@schoolsync.edu', role: 'librarian', password: 'librarian123' },
  ];

  logger.info('Running first-time bootstrap — creating default users...');

  for (const entry of seedUsers) {
    // Skip if this email already exists (safe guard for partial runs)
    const existing = await db.ref('users').orderByChild('email').equalTo(entry.email).once('value');
    if (existing.exists()) {
      logger.info(`User ${entry.email} already exists, skipping`);
      continue;
    }

    const passwordHash = await hash(entry.password, 12);
    const userId = `${entry.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await db.ref(`users/${userId}`).set({
      id: userId,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      is_active: true,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    logger.info(`Created default user: ${entry.email}`);
  }

  // Write the flag so this never runs again
  await db.ref(BOOTSTRAP_FLAG_PATH).set(true);
  logger.info('Bootstrap complete — flag written to Firebase');
};
