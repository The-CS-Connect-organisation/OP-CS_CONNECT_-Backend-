// Database connection is now handled by Firebase Admin SDK.
// This file manages the Firebase Realtime Database connection lifecycle.

import { db } from './firebase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    // Verify Firebase connectivity with a simple read (with timeout)
    const ref = db.ref('.info/connected');
    
    const connectionPromise = ref.once('value');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout after 5s')), 5000)
    );
    
    const snapshot = await Promise.race([connectionPromise, timeoutPromise]);
    
    if (snapshot.val() === true) {
      logger.info('Firebase Realtime Database connection verified');
    } else {
      throw new Error('Firebase connection check failed - not connected');
    }
  } catch (error) {
    logger.error('Firebase connection check failed', { 
      message: error.message,
      stack: error.stack 
    });
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

