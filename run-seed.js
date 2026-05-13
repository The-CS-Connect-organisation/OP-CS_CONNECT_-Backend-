import { seedFirebaseData } from './seed-firebase.js';

console.log('🚀 Starting Firebase seed...');

seedFirebaseData()
  .then(() => {
    console.log('✅ Seed complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
