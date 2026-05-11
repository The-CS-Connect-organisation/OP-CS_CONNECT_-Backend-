import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;
let auth = null;

async function initFirebase() {
  const saPath = resolve(__dirname, '../service-account.json');

  // Try local file first, then download from env var (base64 encoded)
  let serviceAccount = null;

  if (existsSync(saPath)) {
    try {
      serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
    } catch {}
  }

  // Fallback: decode from SERVICE_ACCOUNT_B64 env var
  if (!serviceAccount && process.env.SERVICE_ACCOUNT_B64) {
    try {
      serviceAccount = JSON.parse(Buffer.from(process.env.SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
    } catch {}
  }

  if (!serviceAccount) {
    console.warn('Firebase not configured: no service-account.json or SERVICE_ACCOUNT_B64 env var');
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: serviceAccount.database_url || `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  });

  db = admin.database();
  auth = admin.auth();

  console.log('Firebase Admin SDK initialized', { projectId: serviceAccount.project_id });
}

initFirebase().catch(err => console.warn('Firebase init failed:', err.message));

export { db, auth };