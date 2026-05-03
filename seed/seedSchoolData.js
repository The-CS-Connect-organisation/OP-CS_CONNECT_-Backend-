import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';

const seed = async () => {
  console.log('🚀 Seeding Cornerstone School data to Firebase...\n');

  try {
    // ── Clear old data ──
    console.log('🧹 Clearing old users...');
    await db.ref('users').remove();
    console.log('   ✓ Cleared users');

    // ═══════════════════════════════════════════
    // 1. USERS - ONLY ALICIA MORGAN (ADMIN)
    // ═══════════════════════════════════════════
    console.log('👥 Creating admin user...');

    const adminUsers = [
      { name: 'Alicia Morgan', email: 'admin@schoolsync.edu', role: 'admin' },
    ];

    // Create all users
    const allUsers = [...adminUsers];
    const usersData = {};

    for (const user of allUsers) {
      const password = 'admin123';
      const passwordHash = await hash(password, 12);
      const userId = `${user.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      usersData[userId] = {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: true,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    await db.ref('users').set(usersData);
    console.log(`   ✓ 1 admin created`);

    console.log('\n✅ Seed complete!\n');
    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│  LOGIN CREDENTIALS                                       │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log('│  Admin:    admin@schoolsync.edu       / admin123         │');
    console.log('│                                                          │');
    console.log('│  Use the Create Account feature to add new users         │');
    console.log('└──────────────────────────────────────────────────────────┘');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
