import { db } from './firebase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    // Test Firebase connection by reading from users collection
    const usersRef = db.ref('users');
    await usersRef.limitToFirst(1).once('value');
    logger.info('Firebase Realtime Database connected');
  } catch (err) {
    logger.error('Firebase connection error', { message: err.message });
    throw new Error(`Firebase connection failed: ${err.message}`);
  }
};

export const closeDatabase = async () => {
  logger.info('Firebase client released');
};
