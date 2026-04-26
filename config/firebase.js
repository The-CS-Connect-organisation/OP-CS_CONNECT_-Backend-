import admin from 'firebase-admin';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: 'service_account',
  project_id: env.FIREBASE_PROJECT_ID,
  private_key_id: 'key-id',
  private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: env.FIREBASE_CLIENT_EMAIL,
  client_id: 'client-id',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: env.FIREBASE_DATABASE_URL.trim(),
});

export const db = admin.database();
export const auth = admin.auth();

logger.info('Firebase Admin SDK initialized', {
  projectId: env.FIREBASE_PROJECT_ID,
  databaseUrl: env.FIREBASE_DATABASE_URL,
});
