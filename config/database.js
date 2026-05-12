import { db } from './firebase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  // Try the RTDB connection with a hard timeout — if it hangs, don't block server startup
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('RTDB connection timed out after 8s')), 8000)
    );
    await Promise.race([
      db.ref('users').limitToFirst(1).once('value'),
      timeout,
    ]);
    logger.info('Firebase Realtime Database connected');
  } catch (err) {
    logger.warn('Firebase RTDB connection deferred — will retry on first request', { message: err.message });
  }
};

export const closeDatabase = async () => {
  logger.info('Firebase client released');
};
