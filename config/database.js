// Database connection is now handled by Firebase Admin SDK.
// This file manages the Firebase Realtime Database connection lifecycle.

import { db } from './firebase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    // Verify Firebase connectivity with a simple read
    const ref = db.ref('.info/connected');
    const snapshot = await ref.once('value');
    
    if (snapshot.val() === true) {
      logger.info('Firebase Realtime Database connection verified');
    } else {
      throw new Error('Firebase connection check failed');
    }
  } catch (error) {
    logger.error('Firebase connection check failed', { message: error.message });
    throw new Error(`Firebase connection failed: ${error.message}`);
  }
};

export const closeDatabase = async () => {
  try {
    await db.goOffline();
    logger.info('Firebase database connection closed');
  } catch (error) {
    logger.error('Error closing Firebase connection', { message: error.message });
  }
};

