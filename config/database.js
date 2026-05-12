import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  // Firebase Admin SDK was already initialized when config/firebase.js was imported.
  // The RTDB connection opens lazily on first actual API request.
  // Nothing to do here — server startup must NOT be blocked.
  logger.info('Firebase connection check skipped at startup (lazy init)');
};

export const closeDatabase = async () => {
  logger.info('Firebase client released');
};
