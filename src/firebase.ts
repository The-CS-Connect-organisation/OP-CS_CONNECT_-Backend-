import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://vnthhh-7b829-default-rtdb.asia-southeast1.firebasedatabase.app';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // If a service account is provided via env (as a base64 string or file path)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('{') 
          ? process.env.FIREBASE_SERVICE_ACCOUNT 
          : Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString()
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: DB_URL
      });
    } else {
      // Fallback to application default credentials or public access (if configured in DB rules)
      admin.initializeApp({
        databaseURL: DB_URL
      });
    }
    console.log('[Firebase] Admin SDK initialized successfully');
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
  }
}

const db = admin.database();

export async function getData(path: string): Promise<any> {
  try {
    const snapshot = await db.ref(path).once('value');
    return snapshot.val();
  } catch (err) {
    console.error(`[Firebase] getData(${path}) error:`, (err as Error).message);
    return null;
  }
}

export async function setData(path: string, value: any): Promise<void> {
  try {
    await db.ref(path).set(value);
  } catch (err) {
    console.error(`[Firebase] setData(${path}) error:`, (err as Error).message);
  }
}

export async function updateData(path: string, value: any): Promise<void> {
  try {
    await db.ref(path).update(value);
  } catch (err) {
    console.error(`[Firebase] updateData(${path}) error:`, (err as Error).message);
  }
}

export async function pushData(basePath: string, value: any): Promise<string> {
  try {
    const newRef = db.ref(basePath).push();
    await newRef.set(value);
    return newRef.key || `id_${Date.now()}`;
  } catch (err) {
    console.error(`[Firebase] pushData(${basePath}) error:`, (err as Error).message);
    return `id_${Date.now()}`;
  }
}

export async function removeData(path: string): Promise<void> {
  try {
    await db.ref(path).remove();
  } catch (err) {
    console.error(`[Firebase] removeData(${path}) error:`, (err as Error).message);
  }
}

export function safeUser(u: any) {
  if (!u) return null;
  const { password, ...safe } = u;
  return safe;
}

export function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function listData(path: string): Promise<any[]> {
  const data = await getData(path);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}
