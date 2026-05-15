import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import pkg from 'bcryptjs';
const { hash } = pkg;

const SEED_VERSION = 2026;
const SEED_FLAG_PATH = '_meta/seed_mass_done';

/**
 * Mass seed for School ERP demo
 * - 1 Admin, 1 Manager, 2 Librarians
 * - 4 Students (2 per class: 10-A, 10-B)
 * - 2 Teachers (each with 2 subjects)
 * - 4 Subjects
 * - 2 periods per subject per day
 * - Library books borrowed
 * - Fees with payment status
 */
export const seedMassData = async () => {
  const flagSnap = await db.ref(SEED_FLAG_PATH).once('value');
  if (flagSnap.val() === SEED_VERSION) {
    logger.info('Mass seed already applied — skipping');
    return;
  }

  logger.info('Running mass seed for demo...');

  try {
    const now = () => new Date().toISOString();
    const pwHash = await hash('student123', 12);
    const tHash = await hash('teacher123', 12);
    const aHash = await hash('admin123', 12);
    const lHash = await hash('librarian123', 12);

    // ── USERS ───────────────────────────────────────────────────────────────
    const users = [
      // Admin
      { id: 'admin-1', name: 'Super Admin', email: 'admin@schoolsync.edu', role: 'admin', password_hash: aHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', created_at: now(), updated_at: now() },
      // Managers
      { id: 'manager-1', name: 'System Manager', email: 'manager@schoolsync.edu', role: 'manager', password_hash: aHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager', created_at: now(), updated_at: now() },
      // Librarians
      { id: 'librarian-1', name: 'Fatima Ansari', email: 'librarian@schoolsync.edu', role: 'librarian', password_hash: lHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fatima', created_at: now(), updated_at: now() },
      { id: 'librarian-2', name: 'Sanjay Reddy', email: 'librarian2@schoolsync.edu', role: 'librarian', password_hash: lHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sanjay', created_at: now(), updated_at: now() },
      // Teachers
      { id: 'teacher-1', name: 'Rajesh Kumar', email: 'teacher@schoolsync.edu', role: 'teacher', password_hash: tHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rajesh', created_at: now(), updated_at: now() },
      { id: 'teacher-2', name: 'Emily Chen', email: 'teacher2@schoolsync.edu', role: 'teacher', password_hash: tHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emily', created_at: now(), updated_at: now() },
      // Students
      { id: 'student-1', name: 'Priya Sharma', email: 'student@schoolsync.edu', role: 'student', password_hash: pwHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya', created_at: now(), updated_at: now() },
      { id: 'student-2', name: 'Aarav Menon', email: 'student2@schoolsync.edu', role: 'student', password_hash: pwHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aarav', created_at: now(), updated_at: now() },
      { id: 'student-3', name: 'Ishita Kapoor', email: 'student3@schoolsync.edu', role: 'student', password_hash: pwHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ishita', created_at: now(), updated_at: now() },
      { id: 'student-4', name: 'Kabir Verma', email: 'student4@schoolsync.edu', role: 'student', password_hash: pwHash, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kabir', created_at: now(), updated_at: now() },
    ];

    for (const user of users) await db.ref(`users/${user.id}`).set(user);
    logger.info('Users seeded (10 total)');

    // ── SUBJECTS ─────────────────────────────────────────────────────────────
    const subjects = [
      { id: 'sub-math', name: 'Mathematics', code: 'MATH', color: '#ef4444', teachers: ['teacher-1'] },
      { id: 'sub-physics', name: 'Physics', code: 'PHY', color: '#06b6d4', teachers: ['teacher-1'] },
      { id: 'sub-eng', name: 'English', code: 'ENG', color: '#3b82f6', teachers: ['teacher-2'] },
      { id: 'sub-chem', name: 'Chemistry', code: 'CHEM', color: '#a855f7', teachers: ['teacher-2'] },
    ];
    for (const subject of subjects) await db.ref(`subjects/${subject.id}`).set({ ...subject, created_at: now() });
    logger.info('Subjects seeded (4 total)');

    // ── CLASSES ───────────────────────────────────────────────────────────────
    const classes = [
      { id: 'class-10-a', name: '10-A', grade: '10', section: 'A', class_teacher_id: 'teacher-1', student_count: 2 },
      { id: 'class-10-b', name: '10-B', grade: '10', section: 'B', class_teacher_id: 'teacher-2', student_count: 2 },
    ];
    for (const cls of classes) {
      const data = { ...cls, created_at: now(), updated_at: now() };
      await db.ref(`class_rooms/${cls.id}`).set(data);
      await db.ref(`classrooms/${cls.id}`).set(data); // Dual-path for compatibility
    }
    logger.info('Classes seeded (2 total, dual-path)');

    // ── STUDENT PROFILES ───────────────────────────────────────────────────
    const studentProfiles = [
      { id: 'student-1', user_id: 'student-1', name: 'Priya Sharma', grade: '10', section: 'A', class_id: 'class-10-a', class: '10-A', roll_number: '01', subjects: ['Mathematics', 'Physics', 'English', 'Chemistry'], attendance_percent: 95, xp: 450, badges: ['Top Scorer', 'Early Bird'], admission_no: 'ADM-2022-001', blood_group: 'O+', father_id: 'father-1', mother_id: 'mother-1', created_at: now(), updated_at: now() },
      { id: 'student-2', user_id: 'student-2', name: 'Aarav Menon', grade: '10', section: 'A', class_id: 'class-10-a', class: '10-A', roll_number: '02', subjects: ['Mathematics', 'Physics', 'English', 'Chemistry'], attendance_percent: 98, xp: 620, badges: ['Top Scorer', 'Streak Master'], admission_no: 'ADM-2022-002', blood_group: 'B+', father_id: 'father-2', mother_id: 'mother-2', created_at: now(), updated_at: now() },
      { id: 'student-3', user_id: 'student-3', name: 'Ishita Kapoor', grade: '10', section: 'B', class_id: 'class-10-b', class: '10-B', roll_number: '01', subjects: ['Mathematics', 'Physics', 'English', 'Chemistry'], attendance_percent: 88, xp: 280, badges: [], admission_no: 'ADM-2022-003', blood_group: 'A+', father_id: 'father-3', mother_id: 'mother-3', created_at: now(), updated_at: now() },
      { id: 'student-4', user_id: 'student-4', name: 'Kabir Verma', grade: '10', section: 'B', class_id: 'class-10-b', class: '10-B', roll_number: '02', subjects: ['Mathematics', 'Physics', 'English', 'Chemistry'], attendance_percent: 92, xp: 350, badges: ['Early Bird'], admission_no: 'ADM-2022-004', blood_group: 'AB+', father_id: 'father-4', mother_id: 'mother-4', created_at: now(), updated_at: now() },
    ];
    for (const sp of studentProfiles) await db.ref(`student_profiles/${sp.id}`).set(sp);
    logger.info('Student profiles seeded (4 total)');

    // ── PARENT PROFILES (with child_ids for auth enrichment) ─────────────────
    const parentProfiles = [
      { id: 'parent-1', user_id: 'parent-1', child_ids: ['student-1'], phone: '+919876543220', email: 'parent@schoolsync.edu', created_at: now(), updated_at: now() },
      { id: 'parent-2', user_id: 'parent-2', child_ids: ['student-2'], phone: '+919876543221', email: 'parent2@schoolsync.edu', created_at: now(), updated_at: now() },
      { id: 'parent-3', user_id: 'parent-3', child_ids: ['student-3'], phone: '+919876543222', email: 'parent3@schoolsync.edu', created_at: now(), updated_at: now() },
      { id: 'parent-4', user_id: 'parent-4', child_ids: ['student-4'], phone: '+919876543223', email: 'parent4@schoolsync.edu', created_at: now(), updated_at: now() },
    ];
    for (const pp of parentProfiles) await db.ref(`parent_profiles/${pp.id}`).set(pp);
    logger.info('Parent profiles seeded (4 total, with child_ids)');

    // ── PARENT CONTACTS (detailed info) ───────────────────────────────────────
    const parentContacts = [
      { id: 'father-1', user_id: 'parent-1', student_id: 'student-1', full_name: 'Rajesh Sharma', phone: '+919876543220', relation: 'father', email: 'rajesh.sharma@gmail.com', address: '123, Main Street, Hyderabad', created_at: now() },
      { id: 'mother-1', user_id: 'parent-1', student_id: 'student-1', full_name: 'Sunita Sharma', phone: '+919876543221', relation: 'mother', email: 'sunita.sharma@gmail.com', address: '123, Main Street, Hyderabad', created_at: now() },
      { id: 'father-2', user_id: 'parent-2', student_id: 'student-2', full_name: 'Amit Menon', phone: '+919876543222', relation: 'father', email: 'amit.menon@gmail.com', created_at: now() },
      { id: 'father-3', user_id: 'parent-3', student_id: 'student-3', full_name: 'Harpreet Singh', phone: '+919876543224', relation: 'father', email: 'harpreet.singh@gmail.com', created_at: now() },
      { id: 'father-4', user_id: 'parent-4', student_id: 'student-4', full_name: 'Deepak Gupta', phone: '+919876543226', relation: 'father', email: 'deepak.gupta@gmail.com', created_at: now() },
    ];
    for (const p of parentContacts) await db.ref(`parents/${p.id}`).set(p);
    logger.info('Parent contacts seeded');

    // ── TEACHER PROFILES ─────────────────────────────────────────────────────
    const teacherProfiles = [
      { id: 'teacher-1', user_id: 'teacher-1', subjects: ['Mathematics', 'Physics'], phone: '+919876543210', class_ids: ['class-10-a', 'class-10-b'], created_at: now(), updated_at: now() },
      { id: 'teacher-2', user_id: 'teacher-2', subjects: ['English', 'Chemistry'], phone: '+919876543211', class_ids: ['class-10-a', 'class-10-b'], created_at: now(), updated_at: now() },
    ];
    for (const tp of teacherProfiles) await db.ref(`teacher_profiles/${tp.id}`).set(tp);
    logger.info('Teacher profiles seeded (2 total)');

    // ── TEACHER SUBJECTS ─────────────────────────────────────────────────────
    const teacherSubjects = [
      { teacher_id: 'teacher-1', subjects: ['Mathematics', 'Physics'], class_ids: ['class-10-a', 'class-10-b'] },
      { teacher_id: 'teacher-2', subjects: ['English', 'Chemistry'], class_ids: ['class-10-a', 'class-10-b'] },
    ];
    for (const ts of teacherSubjects) await db.ref(`teacher_subjects/${ts.teacher_id}`).set({ ...ts, updated_at: now() });
    logger.info('Teacher-subject mappings seeded');

    // ── CLASSROOM TEACHERS ───────────────────────────────────────────────────
    const classroomTeachers = [
      { id: 'ct-1', classroom_id: 'class-10-a', teacher_id: 'teacher-1', role: 'subject_teacher', subjects: ['Mathematics', 'Physics'] },
      { id: 'ct-2', classroom_id: 'class-10-a', teacher_id: 'teacher-2', role: 'subject_teacher', subjects: ['English', 'Chemistry'] },
      { id: 'ct-3', classroom_id: 'class-10-b', teacher_id: 'teacher-1', role: 'subject_teacher', subjects: ['Mathematics', 'Physics'] },
      { id: 'ct-4', classroom_id: 'class-10-b', teacher_id: 'teacher-2', role: 'subject_teacher', subjects: ['English', 'Chemistry'] },
    ];
    for (const ct of classroomTeachers) await db.ref(`classroom_teachers/${ct.id}`).set({ ...ct, created_at: now() });
    logger.info('Classroom-teacher mappings seeded (4 total)');

    // ── DRIVER PROFILE + BUS + ROUTE ─────────────────────────────────────────
    const driverProfile = {
      id: 'driver-1', user_id: 'driver-1', bus_number: 'AP 28 T 1001', license_plate: 'AP28T1001',
      phone: '+919876543230', route_id: 'route-1', bus_id: 'bus-1',
      created_at: now(), updated_at: now()
    };
    await db.ref(`driver_profiles/driver-1`).set(driverProfile);

    const route1 = {
      id: 'route-1', name: 'Chandanagar Loop', description: 'Covers Chandanagar, Hafeezpet, Kondapur',
      status: 'active', start_time: '07:00', end_time: '08:30', total_distance: 18.5, estimated_duration: 90,
      stops: [
        { name: 'Chandanagar Depot', latitude: 17.4967, longitude: 78.3614, time: '07:00' },
        { name: 'Hafeezpet Junction', latitude: 17.5035, longitude: 78.3652, time: '07:15' },
        { name: 'Kondapur Signal', latitude: 17.5103, longitude: 78.3698, time: '07:30' },
        { name: 'School Main Gate', latitude: 17.5192, longitude: 78.3789, time: '08:15' },
      ],
      created_at: now(), updated_at: now()
    };
    await db.ref(`routes/route-1`).set(route1);

    const bus1 = {
      id: 'bus-1', bus_number: 'AP 28 T 1001', license_plate: 'AP28T1001', capacity: 45,
      route_id: 'route-1', driver_id: 'driver-1', status: 'active',
      current_location: { latitude: 17.5035, longitude: 78.3652, speed: 35, heading: 90, timestamp: now() },
      last_updated: now(), created_at: now(), updated_at: now()
    };
    await db.ref(`buses/bus-1`).set(bus1);
    logger.info('Driver profile, bus, and route seeded');

    // ── TIMETABLE (2 periods per subject per day) ────────────────────────────
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periodTimings = [
      { period: 1, start: '08:00', end: '08:45' }, { period: 2, start: '08:45', end: '09:30' },
      { period: 3, start: '09:30', end: '10:15' }, { period: 4, start: '10:15', end: '11:00' },
      { period: 5, start: '11:00', end: '11:45' }, { period: 6, start: '11:45', end: '12:30' },
    ];

    for (const classId of ['class-10-a', 'class-10-b']) {
      const entries = [];
      let period = 1;
      for (let day = 0; day < 5; day++) {
        for (const subject of subjects) {
          if (period > 6) break;
          entries.push({
            day: days[day], period: String(period), subject_id: subject.id, subject_name: subject.name,
            teacher_id: subject.teachers[0], room: `Room ${100 + period}`, startTime: periodTimings[period-1].start, endTime: periodTimings[period-1].end
          });
          period++;
          if (period > 6) { period = 1; break; }
        }
        if (period === 1) period = 1;
        if (period > 6) period = 1;
      }
      await db.ref(`timetables/${classId}`).set({ id: classId, classId, entries, updated_at: now() });
    }
    logger.info('Timetables seeded (2 classes, 2 periods per subject)');

    // ── ASSIGNMENTS (6 per class) ───────────────────────────────────────────
    const assignmentTitles = ['Worksheet', 'Lab Report', 'Essay', 'Project', 'Quiz', 'Homework'];
    const assignments = [];
    for (const classId of ['class-10-a', 'class-10-b']) {
      for (let i = 0; i < 6; i++) {
        const subject = subjects[i % subjects.length];
        assignments.push({
          id: `asgn-${classId}-${i}`, title: `${subject.name} ${assignmentTitles[i]}`,
          subject: subject.name, subject_id: subject.id, class_id: classId,
          teacher_id: subject.teachers[0], teacherName: subject.teachers[0] === 'teacher-1' ? 'Rajesh Kumar' : 'Emily Chen', class_name: classId === 'class-10-a' ? '10-A' : '10-B', due_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          due_time: '23:59', max_marks: 30, total_marks: 30, status: 'active', type: ['homework','project','lab','test'][i % 4],
          created_at: now(), updated_at: now()
        });
      }
    }
    for (const a of assignments) await db.ref(`assignments/${a.id}`).set(a);
    logger.info(`Assignments seeded (${assignments.length} total)`);

    // ── SUBMISSIONS ───────────────────────────────────────────────────────────
    const submissions = [
      // 10-A: student-1 submitted first 3, student-2 submitted first 2
      { id: 'sub-s1-a0', assignment_id: 'asgn-class-10-a-0', student_id: 'student-1', content: 'Completed worksheet', submitted_at: new Date(Date.now() - 2 * 24*60*60*1000).toISOString(), status: 'graded', marks: 28, created_at: now(), updated_at: now() },
      { id: 'sub-s1-a1', assignment_id: 'asgn-class-10-a-1', student_id: 'student-1', content: 'Lab report submitted', submitted_at: new Date(Date.now() - 1 * 24*60*60*1000).toISOString(), status: 'graded', marks: 25, created_at: now(), updated_at: now() },
      { id: 'sub-s1-a2', assignment_id: 'asgn-class-10-a-2', student_id: 'student-1', content: 'Essay on digital technology', submitted_at: new Date(Date.now() - 3 * 24*60*60*1000).toISOString(), status: 'submitted', created_at: now(), updated_at: now() },
      { id: 'sub-s2-a0', assignment_id: 'asgn-class-10-a-0', student_id: 'student-2', content: 'Worksheet done', submitted_at: new Date(Date.now() - 1 * 24*60*60*1000).toISOString(), status: 'graded', marks: 27, created_at: now(), updated_at: now() },
      { id: 'sub-s2-a1', assignment_id: 'asgn-class-10-a-1', student_id: 'student-2', content: 'Lab report complete', submitted_at: new Date().toISOString(), status: 'submitted', created_at: now(), updated_at: now() },
      // 10-B: student-3 submitted first 2, student-4 submitted first 1
      { id: 'sub-s3-b0', assignment_id: 'asgn-class-10-b-0', student_id: 'student-3', content: 'Algebra homework', submitted_at: new Date(Date.now() - 2 * 24*60*60*1000).toISOString(), status: 'graded', marks: 24, created_at: now(), updated_at: now() },
      { id: 'sub-s3-b1', assignment_id: 'asgn-class-10-b-1', student_id: 'student-3', content: 'Forces assignment', submitted_at: new Date(Date.now() - 1 * 24*60*60*1000).toISOString(), status: 'submitted', created_at: now(), updated_at: now() },
      { id: 'sub-s4-b0', assignment_id: 'asgn-class-10-b-0', student_id: 'student-4', content: 'Algebra done', submitted_at: new Date(Date.now() - 1 * 24*60*60*1000).toISOString(), status: 'graded', marks: 26, created_at: now(), updated_at: now() },
    ];
    for (const s of submissions) await db.ref(`submissions/${s.id}`).set(s);
    logger.info(`Submissions seeded (${submissions.length} total)`);

    // ── MARKS (every student x every subject = 16 records) ────────────────────
    const marks = [
      // student-1 (10-A) — strong student
      { id: 'mark-s1-math', student_id: 'student-1', class_id: 'class-10-a', subject: 'Mathematics', score: 85, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s1-phy',  student_id: 'student-1', class_id: 'class-10-a', subject: 'Physics', score: 78, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s1-eng',  student_id: 'student-1', class_id: 'class-10-a', subject: 'English', score: 88, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s1-chem', student_id: 'student-1', class_id: 'class-10-a', subject: 'Chemistry', score: 72, max_marks: 100, term: '1', created_at: now() },
      // student-2 (10-A) — top student
      { id: 'mark-s2-math', student_id: 'student-2', class_id: 'class-10-a', subject: 'Mathematics', score: 92, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s2-phy',  student_id: 'student-2', class_id: 'class-10-a', subject: 'Physics', score: 88, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s2-eng',  student_id: 'student-2', class_id: 'class-10-a', subject: 'English', score: 95, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s2-chem', student_id: 'student-2', class_id: 'class-10-a', subject: 'Chemistry', score: 85, max_marks: 100, term: '1', created_at: now() },
      // student-3 (10-B) — average student
      { id: 'mark-s3-math', student_id: 'student-3', class_id: 'class-10-b', subject: 'Mathematics', score: 65, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s3-phy',  student_id: 'student-3', class_id: 'class-10-b', subject: 'Physics', score: 60, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s3-eng',  student_id: 'student-3', class_id: 'class-10-b', subject: 'English', score: 72, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s3-chem', student_id: 'student-3', class_id: 'class-10-b', subject: 'Chemistry', score: 68, max_marks: 100, term: '1', created_at: now() },
      // student-4 (10-B) — good student
      { id: 'mark-s4-math', student_id: 'student-4', class_id: 'class-10-b', subject: 'Mathematics', score: 78, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s4-phy',  student_id: 'student-4', class_id: 'class-10-b', subject: 'Physics', score: 82, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s4-eng',  student_id: 'student-4', class_id: 'class-10-b', subject: 'English', score: 70, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-s4-chem', student_id: 'student-4', class_id: 'class-10-b', subject: 'Chemistry', score: 75, max_marks: 100, term: '1', created_at: now() },
    ];
    for (const m of marks) await db.ref(`marks/${m.id}`).set(m);
    logger.info(`Marks seeded (${marks.length} total)`);

    // ── ATTENDANCE (30 days per student) ────────────────────────────────────
    const attendanceRecords = [];
    for (const student of studentProfiles) {
      for (let i = 0; i < 30; i++) {
        attendanceRecords.push({
          id: `att-${student.id}-${i}`, student_id: student.id, class_id: student.class_id,
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: Math.random() > 0.15 ? 'present' : (Math.random() > 0.05 ? 'late' : 'absent'),
          created_at: now(), updated_at: now()
        });
      }
    }
    for (const a of attendanceRecords) await db.ref(`attendance_records/${a.id}`).set(a);
    logger.info(`Attendance seeded (${attendanceRecords.length} total)`);

    // ── FEES (with payment status) ───────────────────────────────────────────
    const fees = [
      { id: 'fee-1', student_id: 'student-1', student_name: 'Priya Sharma', term: 'Term 1', amount: 15000, due_date: '2026-06-15', status: 'paid', paid_at: '2026-06-10', created_at: now(), updated_at: now() },
      { id: 'fee-2', student_id: 'student-2', student_name: 'Aarav Menon', term: 'Term 1', amount: 15000, due_date: '2026-06-15', status: 'pending', created_at: now(), updated_at: now() },
      { id: 'fee-3', student_id: 'student-3', student_name: 'Ishita Kapoor', term: 'Term 1', amount: 15000, due_date: '2026-06-15', status: 'paid', paid_at: '2026-06-08', created_at: now(), updated_at: now() },
      { id: 'fee-4', student_id: 'student-4', student_name: 'Kabir Verma', term: 'Term 1', amount: 15000, due_date: '2026-06-15', status: 'overdue', created_at: now(), updated_at: now() },
    ];
    for (const f of fees) await db.ref(`fees/${f.id}`).set(f);
    logger.info(`Fees seeded (${fees.length} total)`);

    // ── LIBRARY BOOKS ─────────────────────────────────────────────────────────
    const books = [
      { id: 'book-1', title: 'Introduction to Algorithms', author: 'Cormen', isbn: '978-0262033848', category: 'Technology', status: 'available', total_copies: 3, available_copies: 2, created_at: now() },
      { id: 'book-2', title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '978-0061120084', category: 'Literature', status: 'issued', total_copies: 2, available_copies: 1, created_at: now() },
      { id: 'book-3', title: 'NCERT Mathematics Class 10', author: 'NCERT', isbn: '978-8174506313', category: 'Mathematics', status: 'available', total_copies: 5, available_copies: 4, created_at: now() },
      { id: 'book-4', title: 'Concepts of Physics - H.C. Verma', author: 'H.C. Verma', isbn: '978-8177091878', category: 'Physics', status: 'issued', total_copies: 3, available_copies: 2, created_at: now() },
      { id: 'book-5', title: 'NCERT Chemistry Class 10', author: 'NCERT', isbn: '978-8174506320', category: 'Chemistry', status: 'available', total_copies: 5, available_copies: 5, created_at: now() },
      { id: 'book-6', title: 'English Grammar in Use', author: 'Raymond Murphy', isbn: '978-0521537629', category: 'English', status: 'issued', total_copies: 2, available_copies: 0, created_at: now() },
    ];
    for (const book of books) await db.ref(`library_books/${book.id}`).set(book);
    logger.info('Library books seeded (6 total)');

    // ── LIBRARY TRANSACTIONS ──────────────────────────────────────────────────
    const transactions = [
      { id: 'ltx-1', bookId: 'book-2', bookTitle: 'To Kill a Mockingbird', studentId: 'student-1', studentName: 'Priya Sharma', studentClass: '10-A', borrowerType: 'student', issueDate: new Date(Date.now() - 7*24*60*60*1000).toISOString(), dueDate: new Date(Date.now() + 7*24*60*60*1000).toISOString(), status: 'issued', created_at: now() },
      { id: 'ltx-2', bookId: 'book-1', bookTitle: 'Introduction to Algorithms', studentId: 'student-2', studentName: 'Aarav Menon', studentClass: '10-A', borrowerType: 'student', issueDate: new Date(Date.now() - 15*24*60*60*1000).toISOString(), dueDate: new Date(Date.now() - 1*24*60*60*1000).toISOString(), status: 'returned', returnDate: new Date(Date.now() - 2*24*60*60*1000).toISOString(), fine: 0, created_at: now() },
      { id: 'ltx-3', bookId: 'book-4', bookTitle: 'Concepts of Physics - H.C. Verma', studentId: 'student-3', studentName: 'Ishita Kapoor', studentClass: '10-B', borrowerType: 'student', issueDate: new Date(Date.now() - 5*24*60*60*1000).toISOString(), dueDate: new Date(Date.now() + 9*24*60*60*1000).toISOString(), status: 'issued', created_at: now() },
      { id: 'ltx-4', bookId: 'book-6', bookTitle: 'English Grammar in Use', studentId: 'teacher-2', studentName: 'Emily Chen', studentClass: 'Teacher', borrowerType: 'teacher', issueDate: new Date(Date.now() - 10*24*60*60*1000).toISOString(), dueDate: new Date(Date.now() + 4*24*60*60*1000).toISOString(), status: 'issued', created_at: now() },
      { id: 'ltx-5', bookId: 'book-1', bookTitle: 'Introduction to Algorithms', studentId: 'teacher-1', studentName: 'Rajesh Kumar', studentClass: 'Teacher', borrowerType: 'teacher', issueDate: new Date(Date.now() - 20*24*60*60*1000).toISOString(), dueDate: new Date(Date.now() - 6*24*60*60*1000).toISOString(), status: 'returned', returnDate: new Date(Date.now() - 7*24*60*60*1000).toISOString(), fine: 0, created_at: now() },
    ];
    for (const tx of transactions) await db.ref(`library_transactions/${tx.id}`).set(tx);
    logger.info('Library transactions seeded (5 total, includes teacher borrows)');

    // ── ANNOUNCEMENTS ───────────────────────────────────────────────────────────
    const announcements = [
      { id: 'ann-1', title: 'Exam Schedule Released', body: 'Mid-term exams begin June 1st', category: 'exam', scope: 'all', created_by: 'admin-1', pinned: true, priority: 'high', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: now() },
      { id: 'ann-2', title: 'Library Books Due', body: 'Please return borrowed books by due date', category: 'reminder', scope: 'all', created_by: 'librarian-1', pinned: false, priority: 'medium', created_at: now(), updated_at: now() },
    ];
    for (const ann of announcements) await db.ref(`announcements/${ann.id}`).set(ann);
    logger.info('Announcements seeded (2 total)');

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    const notifications = [
      { id: 'notif-1', userId: 'student-1', user_id: 'student-1', target_users: ['student-1'], message: 'Your Physics assignment has been graded - 28/30', type: 'grade', read: false, created_at: new Date(Date.now() - 2*60*60*1000).toISOString() },
      { id: 'notif-2', userId: 'student-1', user_id: 'student-1', target_users: ['student-1'], message: 'Library book due reminder', type: 'reminder', read: true, created_at: new Date(Date.now() - 24*60*60*1000).toISOString() },
      { id: 'notif-3', userId: 'student-2', user_id: 'student-2', target_users: ['student-2'], message: 'Fee payment pending', type: 'payment', read: false, created_at: new Date(Date.now() - 12*60*60*1000).toISOString() },
      { id: 'notif-4', userId: 'student-3', user_id: 'student-3', target_users: ['student-3'], message: 'New Physics assignment posted', type: 'assignment', read: false, created_at: new Date(Date.now() - 6*60*60*1000).toISOString() },
      { id: 'notif-5', userId: 'student-4', user_id: 'student-4', target_users: ['student-4'], message: 'Your Chemistry marks have been uploaded', type: 'grade', read: false, created_at: new Date(Date.now() - 1*60*60*1000).toISOString() },
      { id: 'notif-6', userId: 'parent-1', user_id: 'parent-1', target_users: ['parent-1'], message: 'Your child Priya scored 85% in Mathematics', type: 'grade', read: false, created_at: new Date(Date.now() - 3*60*60*1000).toISOString() },
      { id: 'notif-7', userId: 'parent-2', user_id: 'parent-2', target_users: ['parent-2'], message: 'Fee payment reminder - due June 15', type: 'payment', read: false, created_at: new Date(Date.now() - 8*60*60*1000).toISOString() },
      { id: 'notif-8', userId: 'teacher-1', user_id: 'teacher-1', target_users: ['teacher-1'], message: 'New submission from Aarav Menon', type: 'submission', read: false, created_at: new Date(Date.now() - 30*60*1000).toISOString() },
      { id: 'notif-9', userId: 'teacher-2', user_id: 'teacher-2', target_users: ['teacher-2'], message: 'New submission from Ishita Kapoor', type: 'submission', read: true, created_at: new Date(Date.now() - 2*60*60*1000).toISOString() },
      { id: 'notif-10', userId: 'driver-1', user_id: 'driver-1', target_users: ['driver-1'], message: 'Route updated for tomorrow', type: 'route', read: false, created_at: new Date(Date.now() - 4*60*60*1000).toISOString() },
    ];
    for (const n of notifications) await db.ref(`notifications/${n.id}`).set(n);
    logger.info('Notifications seeded (10 total, all roles)');

    // ── GOALS ───────────────────────────────────────────────────────────────────
    const goals = [
      { id: 'goal-1', student_id: 'student-1', subject: 'Mathematics', target: 90, current: 85, progress: 94 },
      { id: 'goal-2', student_id: 'student-1', subject: 'Physics', target: 85, current: 78, progress: 92 },
      { id: 'goal-3', student_id: 'student-2', subject: 'Mathematics', target: 95, current: 90, progress: 95 },
    ];
    for (const g of goals) await db.ref(`goals/${g.id}`).set({ ...g, created_at: now() });
    logger.info('Goals seeded');

    // ── CLASSROOM ENROLLMENTS ───────────────────────────────────────────────
    const enrollments = [
      { id: 'enroll-1', classroom_id: 'class-10-a', student_id: 'student-1', enrolled_at: now() },
      { id: 'enroll-2', classroom_id: 'class-10-a', student_id: 'student-2', enrolled_at: now() },
      { id: 'enroll-3', classroom_id: 'class-10-b', student_id: 'student-3', enrolled_at: now() },
      { id: 'enroll-4', classroom_id: 'class-10-b', student_id: 'student-4', enrolled_at: now() },
    ];
    for (const e of enrollments) await db.ref(`classroom_students/${e.id}`).set(e);
    logger.info('Classroom enrollments seeded');

    await db.ref(SEED_FLAG_PATH).set(SEED_VERSION);
    logger.info('Mass seed complete!');
  } catch (error) {
    logger.error('Mass seed failed:', { message: error.message });
    throw error;
  }
};