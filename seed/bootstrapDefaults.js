import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import { StreamChat } from 'stream-chat';
import { env } from '../config/env.js';

const BOOTSTRAP_FLAG_PATH = '_meta/bootstrap_done';
const BOOTSTRAP_VERSION = 7; // bump to re-run bootstrap with deterministic IDs

// 18 demo users — 3 of each role, with deterministic IDs
const DEMO_USERS = [
  // Students
  { name: 'Priya Sharma',    email: 'student@schoolsync.edu',   role: 'student',  suffix: '1', password: 'student123' },
  { name: 'Aarav Menon',     email: 'student2@schoolsync.edu',  role: 'student',  suffix: '2', password: 'student123' },
  { name: 'Ishita Kapoor',   email: 'student3@schoolsync.edu',  role: 'student',  suffix: '3', password: 'student123' },
  // Teachers
  { name: 'Rajesh Kumar',    email: 'teacher@schoolsync.edu',   role: 'teacher',  suffix: '1', password: 'teacher123' },
  { name: 'James Anderson',  email: 'teacher2@schoolsync.edu', role: 'teacher',  suffix: '2', password: 'teacher123' },
  { name: 'Emily Chen',      email: 'teacher3@schoolsync.edu', role: 'teacher',  suffix: '3', password: 'teacher123' },
  // Admins
  { name: 'Alicia Morgan',   email: 'admin@schoolsync.edu',     role: 'admin',    suffix: '1', password: 'admin123'   },
  { name: 'Rahul Venkat',    email: 'admin2@schoolsync.edu',    role: 'admin',    suffix: '2', password: 'admin123'   },
  { name: 'Neha Kapoor',     email: 'admin3@schoolsync.edu',    role: 'admin',    suffix: '3', password: 'admin123'   },
  // Drivers
  { name: 'Amit Patel',      email: 'driver@schoolsync.edu',    role: 'driver',   suffix: '1', password: 'driver123'  },
  { name: 'Suresh Singh',    email: 'driver2@schoolsync.edu',  role: 'driver',   suffix: '2', password: 'driver123'  },
  { name: 'Mohan Das',       email: 'driver3@schoolsync.edu',  role: 'driver',   suffix: '3', password: 'driver123'  },
  // Parents
  { name: 'Vikram Singh',    email: 'parent@schoolsync.edu',   role: 'parent',   suffix: '1', password: 'parent123'  },
  { name: 'Priya Menon',     email: 'parent2@schoolsync.edu',  role: 'parent',   suffix: '2', password: 'parent123'  },
  { name: 'Deepak Verma',    email: 'parent3@schoolsync.edu',  role: 'parent',   suffix: '3', password: 'parent123'  },
  // Librarians
  { name: 'Fatima Ansari',   email: 'librarian@schoolsync.edu',   role: 'librarian', suffix: '1', password: 'librarian123' },
  { name: 'Sanjay Reddy',   email: 'librarian2@schoolsync.edu',  role: 'librarian', suffix: '2', password: 'librarian123' },
  { name: 'Nisha Gupta',    email: 'librarian3@schoolsync.edu',  role: 'librarian', suffix: '3', password: 'librarian123' },
];

const provisionStreamUser = async (userId, name, role) => {
  if (!env.STREAM_API_KEY || !env.STREAM_API_SECRET) return;
  try {
    const serverClient = StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
    await serverClient.upsertUser({ id: userId, name, role: role === 'admin' ? 'admin' : 'user' });
  } catch (err) {
    logger.warn(`GetStream upsert failed for ${userId}`, { message: err.message });
  }
};

// Creates the canonical userId: "role-N" e.g. "student-1", "teacher-2"
const makeUserId = (role, suffix) => `${role}-${suffix}`;

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

  logger.info(`Running bootstrap — creating ${DEMO_USERS.length} demo users...`);

  for (const entry of DEMO_USERS) {
    try {
      const userId = makeUserId(entry.role, entry.suffix);
      const expectedEmail = entry.email.toLowerCase();

      // Check by email (handles upgrades from random-ID versions)
      const byEmail = await db.ref('users').orderByChild('email').equalTo(expectedEmail).once('value');
      if (byEmail.exists()) {
        logger.info(`User ${entry.email} already exists, skipping`);
        continue;
      }

      // Check by canonical ID — if exists with wrong email, update it
      const byId = await db.ref(`users/${userId}`).once('value');
      if (byId.exists()) {
        const existing = byId.val();
        if (existing.email === expectedEmail) {
          logger.info(`User ${userId} already correct, skipping`);
          continue;
        }
        // Email mismatch — update to correct email + re-hash password
        const passwordHash = await hash(entry.password, 12);
        await db.ref(`users/${userId}`).update({
          email: expectedEmail,
          password_hash: passwordHash,
          name: entry.name,
          role: entry.role,
          updated_at: new Date().toISOString(),
        });
        logger.info(`Updated user ${userId} to ${entry.email}`);
        const streamUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
        await provisionStreamUser(streamUserId, entry.name, entry.role);
        continue;
      }

      const passwordHash = await hash(entry.password, 12);

      await db.ref(`users/${userId}`).set({
        id: userId,
        name: entry.name,
        email: entry.email.toLowerCase(),
        role: entry.role,
        is_active: true,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const streamUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
      await provisionStreamUser(streamUserId, entry.name, entry.role);

      logger.info(`Created: ${entry.email} (${userId})`);
    } catch (err) {
      logger.warn(`Failed to create user ${entry.email} — skipping`, { message: err.message });
    }
  }

  try {
    await db.ref(BOOTSTRAP_FLAG_PATH).set(BOOTSTRAP_VERSION);
  } catch (err) {
    logger.warn('Could not set bootstrap flag', { message: err.message });
  }
  logger.info('Bootstrap complete!');
};
