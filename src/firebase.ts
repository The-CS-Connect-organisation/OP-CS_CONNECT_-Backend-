import dotenv from 'dotenv';
dotenv.config();

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://vnthhh-7b829-default-rtdb.asia-southeast1.firebasedatabase.app';
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';

export async function getData(path: string): Promise<any> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`);
    if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error(`[Firebase] getData(${path}):`, (err as Error).message);
    return null;
  }
}

export async function setData(path: string, value: any): Promise<void> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status}`);
  } catch (err) {
    console.error(`[Firebase] setData(${path}):`, (err as Error).message);
  }
}

export async function pushData(basePath: string, value: any): Promise<string> {
  try {
    const res = await fetch(`${DB_URL}/${basePath}.json?auth=${DB_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`Firebase POST ${basePath} failed: ${res.status}`);
    const data: any = await res.json();
    return data.name;
  } catch (err) {
    console.error(`[Firebase] pushData(${basePath}):`, (err as Error).message);
    return `id_${Date.now()}`;
  }
}

export async function removeData(path: string): Promise<void> {
  try {
    await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, { method: 'DELETE' });
  } catch (err) {
    console.error(`[Firebase] removeData(${path}):`, (err as Error).message);
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
