// Database connection is now handled by Firebase Admin SDK.
// This file manages the Firebase Realtime Database connection lifecycle.

import { db } from './firebase.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    // Firebase Admin SDK is already initialized in firebase.js
    // The connection will be established on first use
    logger.info('Firebase Realtime Database ready (connection will be established on first use)');
  } catch (error) {
    logger.error('Firebase initialization error', { 
      message: error.message,
      stack: error.stack 
    });
    throw new Error(`Firebase initialization failed: ${error.message}`);
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

