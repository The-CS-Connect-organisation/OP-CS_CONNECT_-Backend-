import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';

const seed = async () => {
  console.log('🚀 Seeding Cornerstone School data to Firebase...\n');

  try {
    // ── Check if admin already exists ──
    console.log('🧹 Checking for existing admin user...');
    
    const snapshot = await db.ref('users').orderByChild('email').equalTo('admin@schoolsync.edu').once('value');
    const existingAdmins = snapshot.val() || {};
    
    if (Object.keys(existingAdmins).length > 0) {
      console.log('   ✓ Admin user already exists, skipping seed');
      process.exit(0);
    }

    // ═══════════════════════════════════════════
    // 1. USERS - ONE FOR EACH PROFILE TYPE
    // ═══════════════════════════════════════════
    console.log('👥 Creating seeded users for all profile types...');

    const seedUsers = [
      { name: 'Alicia Morgan', email: 'admin@schoolsync.edu', role: 'admin', password: 'admin123' },
      { name: 'Rajesh Kumar', email: 'teacher@schoolsync.edu', role: 'teacher', password: 'teacher123' },
      { name: 'Priya Sharma', email: 'student@schoolsync.edu', role: 'student', password: 'student123' },
      { name: 'Vikram Singh', email: 'parent@schoolsync.edu', role: 'parent', password: 'parent123' },
      { name: 'Amit Patel', email: 'driver@schoolsync.edu', role: 'driver', password: 'driver123' },
      { name: 'Deepak Verma', email: 'librarian@schoolsync.edu', role: 'librarian', password: 'librarian123' },
    ];

    // Create all users
    const usersData = {};
    const userIds = {};

    for (const user of seedUsers) {
      const passwordHash = await hash(user.password, 12);
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
      
      userIds[user.role] = userId;
    }

    await db.ref('users').update(usersData);
    console.log(`   ✓ ${seedUsers.length} users created`);

    // ═══════════════════════════════════════════
    // 2. ROLE-SPECIFIC PROFILES
    // ═══════════════════════════════════════════
    console.log('📋 Creating role-specific profiles...');

    // Student Profile
    const studentProfilesData = {};
    studentProfilesData[userIds.student] = {
      userId: userIds.student,
      admissionNumber: 'ADM2024001',
      rollNumber: '1',
      class: '10',
      section: 'A',
      stream: 'Science',
      medium: 'English',
      fatherName: 'Rajesh Sharma',
      fatherPhone: '+91 9876543210',
      fatherEmail: 'rajesh.sharma@email.com',
      fatherOccupation: 'Engineer',
      fatherAadhaar: '123456789012',
      motherName: 'Anjali Sharma',
      motherPhone: '+91 9876543211',
      motherEmail: 'anjali.sharma@email.com',
      motherOccupation: 'Doctor',
      motherAadhaar: '123456789013',
      emergencyContactPerson: 'Uncle Vikram',
      emergencyContact: '+91 9876543212',
      previousSchool: 'Delhi Public School',
      transferCertificateNumber: 'TC2024001',
      dateOfBirth: '15/05/2009',
      gender: 'Female',
      bloodGroup: 'O+',
      nationality: 'Indian',
      religion: 'Hindu',
      caste: 'General',
      motherTongue: 'Hindi',
      aadhaarNumber: '123456789014',
      houseNumber: '42',
      street: 'Main Street',
      area: 'Area A',
      landmark: 'Near Park',
      city: 'Delhi',
      district: 'Delhi District',
      state: 'Delhi',
      pinCode: '110001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref('student_profiles').update(studentProfilesData);
    console.log('   ✓ Student profile created');

    // Teacher Profile
    const teacherProfilesData = {};
    teacherProfilesData[userIds.teacher] = {
      userId: userIds.teacher,
      employeeId: 'TCH2024001',
      designation: 'Senior Teacher',
      department: 'Science',
      subjects: 'Physics, Chemistry',
      qualification: 'M.Sc, B.Ed',
      experience: '8',
      joiningDate: '2016-06-15',
      dateOfBirth: '20/03/1985',
      gender: 'Male',
      bloodGroup: 'A+',
      nationality: 'Indian',
      religion: 'Hindu',
      caste: 'General',
      motherTongue: 'Hindi',
      aadhaarNumber: '123456789015',
      houseNumber: '25',
      street: 'Park Road',
      area: 'Area B',
      landmark: 'Near Temple',
      city: 'Mumbai',
      district: 'Mumbai District',
      state: 'Maharashtra',
      pinCode: '400001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref('teacher_profiles').update(teacherProfilesData);
    console.log('   ✓ Teacher profile created');

    // Parent Profile
    const parentProfilesData = {};
    parentProfilesData[userIds.parent] = {
      userId: userIds.parent,
      guardianName: 'Vikram Singh',
      guardianRelation: 'Father',
      guardianPhone: '+91 9876543220',
      children: 'Arjun Singh, Neha Singh',
      dateOfBirth: '10/07/1980',
      gender: 'Male',
      bloodGroup: 'B+',
      nationality: 'Indian',
      religion: 'Sikh',
      caste: 'General',
      motherTongue: 'Punjabi',
      aadhaarNumber: '123456789016',
      houseNumber: '15',
      street: 'Market Lane',
      area: 'Area C',
      landmark: 'Near School',
      city: 'Bangalore',
      district: 'Bangalore District',
      state: 'Karnataka',
      pinCode: '560001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref('parent_profiles').update(parentProfilesData);
    console.log('   ✓ Parent profile created');

    // Driver Profile
    const driverProfilesData = {};
    driverProfilesData[userIds.driver] = {
      userId: userIds.driver,
      licenseNumber: 'DL1234567890',
      vehicleNumber: 'MH01AB1234',
      routeNumber: 'Route 5',
      dateOfBirth: '05/12/1978',
      gender: 'Male',
      bloodGroup: 'O+',
      nationality: 'Indian',
      religion: 'Hindu',
      caste: 'OBC',
      motherTongue: 'Marathi',
      aadhaarNumber: '123456789017',
      houseNumber: '88',
      street: 'School Road',
      area: 'Area D',
      landmark: 'Near Hospital',
      city: 'Pune',
      district: 'Pune District',
      state: 'Maharashtra',
      pinCode: '411001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref('driver_profiles').update(driverProfilesData);
    console.log('   ✓ Driver profile created');

    // Librarian Profile
    const librarianProfilesData = {};
    librarianProfilesData[userIds.librarian] = {
      userId: userIds.librarian,
      employeeId: 'LIB2024001',
      librarySection: 'Main Library',
      qualification: 'M.Lib.Sc',
      experience: '5',
      dateOfBirth: '18/08/1990',
      gender: 'Male',
      bloodGroup: 'AB+',
      nationality: 'Indian',
      religion: 'Christian',
      caste: 'General',
      motherTongue: 'English',
      aadhaarNumber: '123456789018',
      houseNumber: '72',
      street: 'Temple Street',
      area: 'Area E',
      landmark: 'Near Market',
      city: 'Hyderabad',
      district: 'Hyderabad District',
      state: 'Telangana',
      pinCode: '500001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref('librarian_profiles').update(librarianProfilesData);
    console.log('   ✓ Librarian profile created');

    // Admin Profile
    const adminProfilesData = {};
    adminProfilesData[userIds.admin] = {
      userId: userIds.admin,
      accessLevel: 'Super Admin',
      department: 'Administration',
      dateOfBirth: '12/01/1975',
      gender: 'Female',
      bloodGroup: 'A-',
      nationality: 'Indian',
      religion: 'Hindu',
      caste: 'General',
      motherTongue: 'Hindi',
      aadhaarNumber: '123456789019',
      houseNumber: '99',
      street: 'Garden Avenue',
      area: 'Area F',
      landmark: 'Near Park',
      city: 'Chennai',
      district: 'Chennai District',
      state: 'Tamil Nadu',
      pinCode: '600001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref('admin_profiles').update(adminProfilesData);
    console.log('   ✓ Admin profile created');

    console.log('\n✅ Seed complete!\n');
    console.log('┌────────────────────────────────────────────────────────────────┐');
    console.log('│  LOGIN CREDENTIALS FOR ALL PROFILES                            │');
    console.log('├────────────────────────────────────────────────────────────────┤');
    console.log('│  Admin:      admin@schoolsync.edu          / admin123          │');
    console.log('│  Teacher:    teacher@schoolsync.edu        / teacher123        │');
    console.log('│  Student:    student@schoolsync.edu        / student123        │');
    console.log('│  Parent:     parent@schoolsync.edu         / parent123         │');
    console.log('│  Driver:     driver@schoolsync.edu         / driver123         │');
    console.log('│  Librarian:  librarian@schoolsync.edu      / librarian123      │');
    console.log('└────────────────────────────────────────────────────────────────┘');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
