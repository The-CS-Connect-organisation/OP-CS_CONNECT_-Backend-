import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { StreamChat } from 'stream-chat';
import { env } from '../config/env.js';

const BOOTSTRAP_FLAG_PATH = '_meta/bootstrap_done';
const BOOTSTRAP_VERSION = 3; // bump to re-run bootstrap with new users

const DEMO_USERS = [
  // Students
  { name: 'Priya Sharma',    email: 'student@schoolsync.edu',  role: 'student', password: 'student123' },
  { name: 'Aarav Menon',     email: 'student2@schoolsync.edu', role: 'student', password: 'student123' },
  { name: 'Ishita Kapoor',   email: 'student3@schoolsync.edu', role: 'student', password: 'student123' },
  // Teachers
  { name: 'Rajesh Kumar',    email: 'teacher@schoolsync.edu',  role: 'teacher', password: 'teacher123' },
  { name: 'James Anderson',  email: 'teacher2@schoolsync.edu', role: 'teacher', password: 'teacher123' },
  { name: 'Emily Chen',      email: 'teacher3@schoolsync.edu', role: 'teacher', password: 'teacher123' },
  // Admins
  { name: 'Alicia Morgan',   email: 'admin@schoolsync.edu',    role: 'admin',   password: 'admin123'   },
  { name: 'Rahul Venkat',    email: 'admin2@schoolsync.edu',   role: 'admin',   password: 'admin123'   },
  { name: 'Neha Kapoor',     email: 'admin3@schoolsync.edu',   role: 'admin',   password: 'admin123'   },
  // Drivers
  { name: 'Amit Patel',      email: 'driver@schoolsync.edu',   role: 'driver',  password: 'driver123'  },
  { name: 'Suresh Singh',    email: 'driver2@schoolsync.edu',  role: 'driver',  password: 'driver123'  },
  { name: 'Mohan Das',       email: 'driver3@schoolsync.edu',  role: 'driver',  password: 'driver123'  },
  // Parents
  { name: 'Vikram Singh',    email: 'parent@schoolsync.edu',   role: 'parent',  password: 'parent123'  },
  { name: 'Priya Menon',     email: 'parent2@schoolsync.edu',  role: 'parent',  password: 'parent123'  },
  { name: 'Deepak Verma',    email: 'parent3@schoolsync.edu',  role: 'parent',  password: 'parent123'  },
];

/**
 * Provision a user in GetStream so they can connect to chat.
 */
const provisionStreamUser = async (userId, name, role) => {
  if (!env.STREAM_API_KEY || !env.STREAM_API_SECRET) return;
  try {
    const serverClient = StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
    await serverClient.upsertUser({ id: userId, name, role: role === 'admin' ? 'admin' : 'user' });
  } catch (err) {
    logger.warn(`GetStream upsert failed for ${userId}`, { message: err.message });
  }
};

export const bootstrapDefaultUsers = async () => {
  let alreadyDone = false;
  try {
    const flagSnap = await db.ref(BOOTSTRAP_FLAG_PATH).once('value');
    if (flagSnap.val() === BOOTSTRAP_VERSION) {
      alreadyDone = true;
      logger.info('Bootstrap already completed — skipping');
    }
  } catch (err) {
    logger.warn('Bootstrap check failed — proceeding to ensure all users exist', { message: err.message });
  }

  if (alreadyDone) return;

  logger.info('Running first-time bootstrap — creating 15 demo users...');

  for (const entry of DEMO_USERS) {
    try {
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

      const streamUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
      await provisionStreamUser(streamUserId, entry.name, entry.role);

      logger.info(`Created demo user: ${entry.email}`);
    } catch (err) {
      logger.warn(`Failed to create user ${entry.email} — skipping`, { message: err.message });
    }
  }

  try {
    await db.ref(BOOTSTRAP_FLAG_PATH).set(BOOTSTRAP_VERSION);
  } catch (err) {
    logger.warn('Could not set bootstrap flag', { message: err.message });
  }
  logger.info('Bootstrap complete — 15 demo users created and provisioned in GetStream');
};
