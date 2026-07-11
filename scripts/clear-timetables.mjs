const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://vnthhh-7b829-default-rtdb.asia-southeast1.firebasedatabase.app';
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || '';

const res = await fetch(`${DB_URL}/timetable.json?auth=${DB_SECRET}`, { method: 'DELETE' });
if (res.ok) {
  console.log('All timetables cleared from Firebase');
} else {
  console.error('Failed:', res.status, res.statusText);
}
