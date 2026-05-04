import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

export const bootstrapDefaultUsers = async () => {
  const defaults = [
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu',  role: 'admin',   password: 'admin123'   },
  ];

  const usersRef = db.ref('users');

  // First, delete all users except Alicia Morgan
  logger.info('Cleaning up old seeded users...');
  const allUsersSnapshot = await usersRef.once('value');
  const allUsers = allUsersSnapshot.val() || {};
  
  for (const userId in allUsers) {
    const user = allUsers[userId];
    if (user.email !== 'admin@schoolsync.edu') {
      await usersRef.child(userId).remove();
      logger.info(`Deleted ${user.name} (${user.email})`);
    }
  }

  // Then ensure Alicia Morgan exists
  for (const entry of defaults) {
    // Check if user already exists
    const snapshot = await usersRef.orderByChild('email').equalTo(entry.email).once('value');
    
    if (snapshot.exists()) {
      logger.info(`User ${entry.email} already exists, skipping`);
      continue;
    }

    const passwordHash = await hash(entry.password, 12);
    const userId = `${entry.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await usersRef.child(userId).set({
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

  logger.info('Default users bootstrap complete');
};
