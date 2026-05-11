import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;
let auth = null;

try {
  const saPath = resolve(__dirname, '../service-account.json');
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: serviceAccount.database_url || `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });

  db = admin.database();
  auth = admin.auth();

  console.log('Firebase Admin SDK initialized', { projectId: serviceAccount.project_id });
} catch (err) {
  console.warn('Firebase not configured (service-account.json not found or invalid):', err.message);
}

export { db, auth };