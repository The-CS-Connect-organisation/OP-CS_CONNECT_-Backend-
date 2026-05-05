import pkg from 'bcryptjs';
const { hash } = pkg;
import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

export const bootstrapDefaultUsers = async () => {
  const seedUsers = [
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu', role: 'admin', password: 'admin123' },
    { name: 'Rajesh Kumar', email: 'teacher@schoolsync.edu', role: 'teacher', password: 'teacher123' },
    { name: 'Priya Sharma', email: 'student@schoolsync.edu', role: 'student', password: 'student123' },
    { name: 'Vikram Singh', email: 'parent@schoolsync.edu', role: 'parent', password: 'parent123' },
    { name: 'Amit Patel', email: 'driver@schoolsync.edu', role: 'driver', password: 'driver123' },
    { name: 'Deepak Verma', email: 'librarian@schoolsync.edu', role: 'librarian', password: 'librarian123' },
  ];

  const usersRef = db.ref('users');

  // Check if any seeded users already exist
  logger.info('Checking for existing seeded users...');
  const allUsersSnapshot = await usersRef.once('value');
  const allUsers = allUsersSnapshot.val() || {};
  
  // Get list of existing seeded user emails
  const existingSeededEmails = new Set();
  for (const userId in allUsers) {
    const user = allUsers[userId];
    const isSeededUser = seedUsers.some(su => su.email === user.email);
    if (isSeededUser) {
      existingSeededEmails.add(user.email);
    }
  }

  // If all seeded users exist, skip bootstrap
  if (existingSeededEmails.size === seedUsers.length) {
    logger.info('All seeded users already exist, skipping bootstrap');
    return;
  }

  // Create missing seeded users
  logger.info('Creating seeded users...');
  for (const entry of seedUsers) {
    // Check if user already exists
    const snapshot = await usersRef.orderByChild('email').equalTo(entry.email).once('value');
    
    if (snapshot.exists()) {
      logger.info(`User ${entry.email} already exists, skipping`);
      continue;
    }

    const passwordHash = await hash(entry.password, 12);
    const userId = `${entry.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await usersRef.child(userId).set({
      id: userId,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      is_active: true,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create role-specific profile
    if (entry.role === 'student') {
      await db.ref(`student_profiles/${userId}`).set({
        userId: userId,
        parentEmail: 'parent@schoolsync.edu', // Link to parent by email
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
      });
    } else if (entry.role === 'teacher') {
      await db.ref(`teacher_profiles/${userId}`).set({
        userId: userId,
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
      });
    } else if (entry.role === 'parent') {
      await db.ref(`parent_profiles/${userId}`).set({
        userId: userId,
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
      });
    } else if (entry.role === 'driver') {
      await db.ref(`driver_profiles/${userId}`).set({
        userId: userId,
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
      });
    } else if (entry.role === 'librarian') {
      await db.ref(`librarian_profiles/${userId}`).set({
        userId: userId,
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
      });
    } else if (entry.role === 'admin') {
      await db.ref(`admin_profiles/${userId}`).set({
        userId: userId,
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
      });
    }

    logger.info(`Created seeded user: ${entry.email}`);
  }

  logger.info('Seeded users bootstrap complete');
};
