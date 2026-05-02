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
    // 1. USERS
    // ═══════════════════════════════════════════
    console.log('👥 Creating users...');

    const adminUsers = [
      { name: 'Alicia Morgan',       email: 'admin@schoolsync.edu',  role: 'admin' },
      { name: 'Rahul Venkataraman',  email: 'admin2@schoolsync.edu', role: 'admin' },
      { name: 'Neha Kapoor',         email: 'admin3@schoolsync.edu', role: 'admin' },
    ];

    const teacherUsers = [
      { name: 'James Anderson',  email: 'james@schoolsync.edu',    role: 'teacher' },
      { name: 'Emily Chen',      email: 'teacher2@schoolsync.edu', role: 'teacher' },
      { name: 'Arjun Mehta',     email: 'teacher3@schoolsync.edu', role: 'teacher' },
      { name: 'Sara Iqbal',      email: 'teacher4@schoolsync.edu', role: 'teacher' },
      { name: 'David Roy',       email: 'teacher5@schoolsync.edu', role: 'teacher' },
      { name: 'Priyanka Menon',  email: 'teacher6@schoolsync.edu', role: 'teacher' },
      { name: 'Rajesh Kumar',    email: 'teacher7@schoolsync.edu', role: 'teacher' },
      { name: 'Priya Sharma',    email: 'teacher8@schoolsync.edu', role: 'teacher' },
      { name: 'Vikram Nair',     email: 'teacher9@schoolsync.edu', role: 'teacher' },
      { name: 'Ananya Bose',     email: 'teacher10@schoolsync.edu',role: 'teacher' },
    ];

    const studentUsers = [
      { name: 'Aarav Menon',      email: 'alex@schoolsync.edu',     role: 'student' },
      { name: 'Ishita Kapoor',    email: 'student2@schoolsync.edu', role: 'student' },
      { name: 'Vivaan Joshi',     email: 'student3@schoolsync.edu', role: 'student' },
      { name: 'Diya Malhotra',    email: 'student4@schoolsync.edu', role: 'student' },
      { name: 'Aditya Rao',       email: 'student5@schoolsync.edu', role: 'student' },
      { name: 'Kavya Reddy',      email: 'student6@schoolsync.edu', role: 'student' },
      { name: 'Rohan Gupta',      email: 'student7@schoolsync.edu', role: 'student' },
      { name: 'Ananya Singh',     email: 'student8@schoolsync.edu', role: 'student' },
      { name: 'Aryan Patel',      email: 'student9@schoolsync.edu', role: 'student' },
      { name: 'Meera Iyer',       email: 'student10@schoolsync.edu',role: 'student' },
      { name: 'Siddharth Nair',   email: 'student11@schoolsync.edu',role: 'student' },
      { name: 'Pooja Verma',      email: 'student12@schoolsync.edu',role: 'student' },
      { name: 'Karan Sharma',     email: 'student13@schoolsync.edu',role: 'student' },
      { name: 'Riya Desai',       email: 'student14@schoolsync.edu',role: 'student' },
      { name: 'Nikhil Bhat',      email: 'student15@schoolsync.edu',role: 'student' },
      { name: 'Tanvi Kulkarni',   email: 'student16@schoolsync.edu',role: 'student' },
      { name: 'Harsh Agarwal',    email: 'student17@schoolsync.edu',role: 'student' },
      { name: 'Sneha Pillai',     email: 'student18@schoolsync.edu',role: 'student' },
      { name: 'Rahul Mishra',     email: 'student19@schoolsync.edu',role: 'student' },
      { name: 'Prachi Jain',      email: 'student20@schoolsync.edu',role: 'student' },
    ];

    const parentNames = [
      'Priya Menon','Sunita Kapoor','Ramesh Joshi','Anita Malhotra','Suresh Rao',
      'Lakshmi Reddy','Vijay Gupta','Rekha Singh','Mohan Patel','Usha Iyer',
      'Ganesh Nair','Savita Verma','Deepak Sharma','Nirmala Desai','Sunil Bhat',
      'Kavitha Kulkarni','Rajiv Agarwal','Meena Pillai','Ashok Mishra','Geeta Jain',
    ];
    const parentUsers = parentNames.map((name, i) => ({
      name,
      email: `parent${i + 1}@schoolsync.edu`,
      role: 'parent'
    }));

    const driverUsers = [
      { name: 'Rajesh Kumar',  email: 'driver@schoolsync.edu',  role: 'driver' },
      { name: 'Suresh Patel',  email: 'driver2@schoolsync.edu', role: 'driver' },
      { name: 'Mohan Singh',   email: 'driver3@schoolsync.edu', role: 'driver' },
    ];

    // Create all users
    const allUsers = [...adminUsers, ...teacherUsers, ...studentUsers, ...parentUsers, ...driverUsers];
    const usersData = {};

    for (const user of allUsers) {
      const password = user.role === 'admin' ? 'admin123' : 
                       user.role === 'teacher' ? 'teacher123' :
                       user.role === 'student' ? 'student123' :
                       user.role === 'parent' ? 'parent123' :
                       user.role === 'driver' ? 'driver123' : 'password123';
      
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
    console.log(`   ✓ ${adminUsers.length} admins, ${teacherUsers.length} teachers, ${studentUsers.length} students, ${parentUsers.length} parents, ${driverUsers.length} drivers`);

    console.log('\n✅ Seed complete!\n');
    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│  LOGIN CREDENTIALS                                       │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log('│  Admin:    admin@schoolsync.edu       / admin123         │');
    console.log('│  Teachers: james@schoolsync.edu       / teacher123       │');
    console.log('│            teacher2-10@schoolsync.edu / teacher123       │');
    console.log('│  Students: alex@schoolsync.edu        / student123       │');
    console.log('│            student2-20@schoolsync.edu / student123       │');
    console.log('│  Parents:  parent1-20@schoolsync.edu  / parent123        │');
    console.log('│  Drivers:  driver@schoolsync.edu      / driver123        │');
    console.log('│            driver2@schoolsync.edu     / driver123        │');
    console.log('│            driver3@schoolsync.edu     / driver123        │');
    console.log('└──────────────────────────────────────────────────────────┘');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
