import dotenv from 'dotenv';

dotenv.config();

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://vnthhh-7b829-default-rtdb.asia-southeast1.firebasedatabase.app';
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';

export async function getData(path: string): Promise<any> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`);
    if (!res.ok) throw new Error(`Firebase GET ${path} failed: ${res.status} ${res.statusText}`);
    return res.json();
  } catch (err) {
    console.error(`[Firebase REST] getData(${path}) error:`, (err as Error).message);
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
    if (!res.ok) throw new Error(`Firebase PUT ${path} failed: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`[Firebase REST] setData(${path}) error:`, (err as Error).message);
  }
}

export async function updateData(path: string, value: any): Promise<void> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`Firebase PATCH ${path} failed: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`[Firebase REST] updateData(${path}) error:`, (err as Error).message);
  }
}

export async function pushData(basePath: string, value: any): Promise<string> {
  try {
    const res = await fetch(`${DB_URL}/${basePath}.json?auth=${DB_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`Firebase POST ${basePath} failed: ${res.status} ${res.statusText}`);
    const data = await res.json() as any;
    return data.name || `id_${Date.now()}`;
  } catch (err) {
    console.error(`[Firebase REST] pushData(${basePath}) error:`, (err as Error).message);
    return `id_${Date.now()}`;
  }
}

export async function removeData(path: string): Promise<void> {
  try {
    const res = await fetch(`${DB_URL}/${path}.json?auth=${DB_SECRET}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Firebase DELETE ${path} failed: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.error(`[Firebase REST] removeData(${path}) error:`, (err as Error).message);
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

export async function queryData(path: string, orderBy: string, equalTo: string): Promise<any[]> {
  try {
    const url = `${DB_URL}/${path}.json?auth=${DB_SECRET}&orderBy="${orderBy}"&equalTo="${encodeURIComponent(equalTo)}"`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firebase query ${path} failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!data) return [];
    return Object.values(data);
  } catch (err) {
    console.error(`[Firebase REST] queryData(${path}) error:`, (err as Error).message);
    return [];
  }
}
