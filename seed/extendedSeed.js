import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

const SEED_VERSION = 5;
const SEED_FLAG_PATH = '_meta/seed_v5_done';

/**
 * Extended seed data for SchoolSync
 * Adds: student profiles with real data, attendance, announcements, notifications
 * Run AFTER bootstrapDefaults.js and comprehensiveSeed.js
 */
export const seedExtendedData = async () => {
  const flagSnap = await db.ref(SEED_FLAG_PATH).once('value');
  if (flagSnap.val() === SEED_VERSION) {
    logger.info('Extended seed already applied — skipping');
    return;
  }

  logger.info('Running extended seed...');

  try {
    // ── 1. Create/Update Student Profile (linked to student-1) ──
    const studentProfile1 = {
      id: 'sp-1',
      user_id: 'student-1',
      grade: '10',
      section: 'A',
      roll_number: '01',
      admission_no: 'ADM-2022-001847',
      date_of_birth: '2008-03-15',
      blood_group: 'O+',
      religion: 'Hindu',
      nationality: 'Indian',
      mother_id: 'mother-1',
      father_id: 'father-1',
      aadhar_number: 'XXXX-XXXX-9012',
      pen: 'PEN-2022-847562',
      apaar_id: 'APAAR-2022-847562-IN',
      subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'],
      attendance_percent: 95,
      xp: 450,
      badges: ['Top Scorer', 'Early Bird'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref(`student_profiles/sp-1`).update(studentProfile1);
    logger.info('Student profile sp-1 updated');

    // ── 2. Create Parent Records ──
    const mother = {
      id: 'mother-1',
      student_id: 'student-1',
      full_name: 'Priya Menon',
      phone: '+919876543211',
      relation: 'mother',
      email: 'priya.menon@gmail.com',
      house_name: 'Menon Residence',
      house_location: 'Near Central Park',
      address: '42, Maple Street, Green Valley Colony, Hyderabad - 500032',
      created_at: new Date().toISOString(),
    };
    await db.ref(`parents/mother-1`).update(mother);

    const father = {
      id: 'father-1',
      student_id: 'student-1',
      full_name: 'Rajesh Menon',
      phone: '+919876543212',
      relation: 'father',
      email: 'rajesh.menon@gmail.com',
      house_name: 'Menon Residence',
      house_location: 'Near Central Park',
      address: '42, Maple Street, Green Valley Colony, Hyderabad - 500032',
      created_at: new Date().toISOString(),
    };
    await db.ref(`parents/father-1`).update(father);
    logger.info('Parent records created');

    // ── 3. Attendance Records for the past 30 days ──
    const now = new Date();
    const attendanceRecords = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Random attendance status (mostly present)
      const rand = Math.random();
      const status = rand > 0.15 ? 'present' : (rand > 0.05 ? 'late' : 'absent');

      attendanceRecords.push({
        id: `att-10a-s1-${dateStr}`,
        class_id: 'class-10-a',
        student_id: 'student-1',
        teacher_id: 'teacher-1',
        date: dateStr,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      attendanceRecords.push({
        id: `att-10a-s2-${dateStr}`,
        class_id: 'class-10-a',
        student_id: 'student-2',
        teacher_id: 'teacher-1',
        date: dateStr,
        status: rand > 0.1 ? 'present' : (rand > 0.03 ? 'late' : 'absent'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      attendanceRecords.push({
        id: `att-10a-s3-${dateStr}`,
        class_id: 'class-10-a',
        student_id: 'student-3',
        teacher_id: 'teacher-1',
        date: dateStr,
        status: rand > 0.2 ? 'present' : (rand > 0.05 ? 'late' : 'absent'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    for (const att of attendanceRecords) {
      await db.ref(`attendance_records/${att.id}`).update(att);
    }
    logger.info('Attendance records seeded');

    // ── 4. Announcements ──
    const announcements = [
      {
        id: 'ann-1',
        title: 'Mid-Term Examination Schedule Released',
        body: 'The mid-term examination schedule has been published. Please check the exam portal for detailed timings and seating arrangements. All students must carry their school ID cards.',
        category: 'exam',
        scope: 'all',
        class_id: null,
        created_by: 'admin-1',
        pinned: true,
        priority: 'high',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ann-2',
        title: 'Annual Sports Day - Registrations Open',
        body: 'Annual Sports Day will be held on May 25th. Students can register for various events including athletics, team sports, and creative activities. Last date for registration is May 18th.',
        category: 'event',
        scope: 'all',
        class_id: null,
        created_by: 'admin-1',
        pinned: true,
        priority: 'medium',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ann-3',
        title: 'Chemistry Lab Safety Guidelines Updated',
        body: 'Updated safety guidelines for chemistry practicals have been posted. All students must review these before attending the upcoming practical examination.',
        category: 'academic',
        scope: 'class',
        class_id: 'class-10-a',
        created_by: 'teacher-1',
        pinned: false,
        priority: 'low',
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ann-4',
        title: 'Fee Payment Reminder - Final Due Date',
        body: 'This is a reminder that the second term fee payment is due by May 15th. Parents who have not yet paid can use the online payment portal or visit the school office.',
        category: 'administrative',
        scope: 'all',
        class_id: null,
        created_by: 'admin-1',
        pinned: false,
        priority: 'high',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const ann of announcements) {
      await db.ref(`announcements/${ann.id}`).update(ann);
    }
    logger.info('Announcements seeded');

    // ── 5. Notifications for student-1 ──
    const notifications = [
      {
        id: 'notif-1',
        userId: 'student-1',
        message: 'Your Physics assignment "Motion and Velocity Lab Report" has been graded - 28/30',
        type: 'grade',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-2',
        userId: 'student-1',
        message: 'New announcement: Annual Sports Day - Registrations Open',
        type: 'announcement',
        read: false,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-3',
        userId: 'student-1',
        message: 'Reminder: Mathematics assignment due in 2 days',
        type: 'reminder',
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-4',
        userId: 'student-1',
        message: 'Congratulations! You earned the "Top Scorer" badge for scoring 95% in Physics',
        type: 'achievement',
        read: true,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'notif-5',
        userId: 'student-1',
        message: 'Your essay "Impact of Digital Technology" has been submitted successfully',
        type: 'submission',
        read: true,
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      },
    ];

    for (const notif of notifications) {
      await db.ref(`notifications/${notif.id}`).update(notif);
    }
    logger.info('Notifications seeded');

    // ── 6. Submissions for assignments ──
    const submissions = [
      {
        id: 'sub-1',
        assignment_id: 'asgn-1004',
        student_id: 'student-1',
        content: 'Essay submitted on time. Topics covered: digital transformation in education, benefits of technology in classrooms, challenges and future prospects.',
        marks: 22,
        feedback: 'Well-structured essay with good examples. Work on conclusion paragraph.',
        status: 'graded',
        submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        graded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'sub-2',
        assignment_id: 'asgn-1002',
        student_id: 'student-1',
        content: 'Lab report covering velocity-time experiment with graphs and analysis.',
        marks: 28,
        feedback: 'Excellent lab technique and detailed analysis.',
        status: 'graded',
        submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        graded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    for (const sub of submissions) {
      await db.ref(`submissions/${sub.id}`).update(sub);
    }
    logger.info('Submissions seeded');

    // ── 7. Update user records with proper names ──
    const users = [
      { id: 'student-1', name: 'Aarav Menon', email: 'alex@schoolsync.edu', phone: '+919876543210', class: '10-A' },
      { id: 'student-2', name: 'Priya Sharma', email: 'priya@schoolsync.edu', phone: '+919876543220', class: '10-A' },
      { id: 'student-3', name: 'Arjun Patel', email: 'arjun@schoolsync.edu', phone: '+919876543230', class: '10-A' },
      { id: 'teacher-1', name: 'Rajesh Kumar', email: 'james@schoolsync.edu', phone: '+919876543240', department: 'Mathematics', subjects: ['Mathematics', 'Chemistry'] },
      { id: 'teacher-2', name: 'James Anderson', email: 'james.anderson@schoolsync.edu', phone: '+919876543250', department: 'Physics', subjects: ['Physics'] },
      { id: 'teacher-3', name: 'Emily Chen', email: 'emily@schoolsync.edu', phone: '+919876543260', department: 'Languages', subjects: ['English', 'Biology', 'History'] },
      { id: 'parent-1', name: 'Priya Menon', email: 'parent@schoolsync.edu', phone: '+919876543211' },
      { id: 'admin-1', name: 'Admin User', email: 'admin@schoolsync.edu', phone: '+919876543299' },
      { id: 'driver-1', name: 'Ramesh Driver', email: 'driver@schoolsync.edu', phone: '+919876543280' },
    ];

    for (const user of users) {
      await db.ref(`users/${user.id}`).update({
        ...user,
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('User records updated with proper names');

    // ── 8. Goals for student-1 ──
    const goals = [
      { id: 'goal-1', student_id: 'student-1', subject: 'Mathematics', target: 90, current: 85, progress: 94, created_at: new Date().toISOString() },
      { id: 'goal-2', student_id: 'student-1', subject: 'Physics', target: 85, current: 78, progress: 92, created_at: new Date().toISOString() },
      { id: 'goal-3', student_id: 'student-1', subject: 'English', target: 90, current: 88, progress: 98, created_at: new Date().toISOString() },
    ];

    for (const goal of goals) {
      await db.ref(`goals/${goal.id}`).update(goal);
    }
    logger.info('Goals seeded');

    // ── 9. Classroom enrollments ──
    const enrollments = [
      { id: 'enroll-1', classroom_id: 'class-10-a', student_id: 'student-1', enrolled_at: new Date().toISOString() },
      { id: 'enroll-2', classroom_id: 'class-10-a', student_id: 'student-2', enrolled_at: new Date().toISOString() },
      { id: 'enroll-3', classroom_id: 'class-10-a', student_id: 'student-3', enrolled_at: new Date().toISOString() },
    ];

    for (const enroll of enrollments) {
      await db.ref(`classroom_students/${enroll.id}`).update(enroll);
    }
    logger.info('Classroom enrollments seeded');

    // ── 10. Study activity for student-1 ──
    const studyActivity = {
      student_id: 'student-1',
      total_hours: 45,
      assignments_completed: 12,
      tests_taken: 5,
      streak_days: 7,
      last_active: new Date().toISOString(),
      subject_hours: {
        Mathematics: 12,
        Physics: 8,
        Chemistry: 7,
        English: 10,
        Biology: 5,
        History: 3,
      },
      weekly_progress: [
        { week: 'W1', hours: 8 },
        { week: 'W2', hours: 10 },
        { week: 'W3', hours: 7 },
        { week: 'W4', hours: 12 },
        { week: 'W5', hours: 8 },
      ],
    };
    await db.ref(`study_activity/student-1`).update(studyActivity);
    logger.info('Study activity seeded');

    await db.ref(SEED_FLAG_PATH).set(SEED_VERSION);
    logger.info('Extended seed complete!');
  } catch (error) {
    logger.error('Extended seed failed:', { message: error.message });
    throw error;
  }
};