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
      { id: 'sub-eng', name: 'English', code: 'ENG', color: '#3b82f6', teachers: ['teacher-2'] },
      { id: 'sub-science', name: 'Science', code: 'SCI', color: '#10b981', teachers: ['teacher-1'] },
      { id: 'sub-social', name: 'Social Studies', code: 'SST', color: '#8b5cf6', teachers: ['teacher-2'] },
    ];
    for (const subject of subjects) await db.ref(`subjects/${subject.id}`).set({ ...subject, created_at: now() });
    logger.info('Subjects seeded (4 total)');

    // ── CLASSES ───────────────────────────────────────────────────────────────
    const classes = [
      { id: 'class-10-a', name: '10-A', grade: '10', section: 'A', class_teacher_id: 'teacher-1', student_count: 2 },
      { id: 'class-10-b', name: '10-B', grade: '10', section: 'B', class_teacher_id: 'teacher-2', student_count: 2 },
    ];
    for (const cls of classes) await db.ref(`class_rooms/${cls.id}`).set({ ...cls, created_at: now() });
    logger.info('Classes seeded (2 total)');

    // ── STUDENT PROFILES ───────────────────────────────────────────────────
    const studentProfiles = [
      { id: 'student-1', user_id: 'student-1', name: 'Priya Sharma', grade: '10', section: 'A', class_id: 'class-10-a', class: '10-A', roll_number: '01', subjects: ['Mathematics', 'English', 'Science', 'Social Studies'], attendance_percent: 95, xp: 450, badges: ['Top Scorer', 'Early Bird'], admission_no: 'ADM-2022-001', blood_group: 'O+', father_id: 'father-1', mother_id: 'mother-1', created_at: now(), updated_at: now() },
      { id: 'student-2', user_id: 'student-2', name: 'Aarav Menon', grade: '10', section: 'A', class_id: 'class-10-a', class: '10-A', roll_number: '02', subjects: ['Mathematics', 'English', 'Science', 'Social Studies'], attendance_percent: 98, xp: 620, badges: ['Top Scorer', 'Streak Master'], admission_no: 'ADM-2022-002', blood_group: 'B+', father_id: 'father-2', mother_id: 'mother-2', created_at: now(), updated_at: now() },
      { id: 'student-3', user_id: 'student-3', name: 'Ishita Kapoor', grade: '10', section: 'B', class_id: 'class-10-b', class: '10-B', roll_number: '01', subjects: ['Mathematics', 'English', 'Science', 'Social Studies'], attendance_percent: 88, xp: 280, badges: [], admission_no: 'ADM-2022-003', blood_group: 'A+', father_id: 'father-3', mother_id: 'mother-3', created_at: now(), updated_at: now() },
      { id: 'student-4', user_id: 'student-4', name: 'Kabir Verma', grade: '10', section: 'B', class_id: 'class-10-b', class: '10-B', roll_number: '02', subjects: ['Mathematics', 'English', 'Science', 'Social Studies'], attendance_percent: 92, xp: 350, badges: ['Early Bird'], admission_no: 'ADM-2022-004', blood_group: 'AB+', father_id: 'father-4', mother_id: 'mother-4', created_at: now(), updated_at: now() },
    ];
    for (const sp of studentProfiles) await db.ref(`student_profiles/${sp.id}`).set(sp);
    logger.info('Student profiles seeded (4 total)');

    // ── PARENT PROFILES ───────────────────────────────────────────────────────
    const parents = [
      { id: 'father-1', user_id: 'father-1', student_id: 'student-1', full_name: 'Rajesh Sharma', phone: '+919876543210', relation: 'father', email: 'rajesh.sharma@gmail.com', house_name: 'Sharma Residence', address: '123, Main Street, Hyderabad', created_at: now() },
      { id: 'mother-1', user_id: 'mother-1', student_id: 'student-1', full_name: 'Priya Sharma', phone: '+919876543211', relation: 'mother', email: 'priya.sharma@gmail.com', house_name: 'Sharma Residence', address: '123, Main Street, Hyderabad', created_at: now() },
      { id: 'father-2', user_id: 'father-2', student_id: 'student-2', full_name: 'Amit Menon', phone: '+919876543212', relation: 'father', email: 'amit.menon@gmail.com', created_at: now() },
      { id: 'mother-2', user_id: 'mother-2', student_id: 'student-2', full_name: 'Neha Menon', phone: '+919876543213', relation: 'mother', email: 'neha.menon@gmail.com', created_at: now() },
      { id: 'father-3', user_id: 'father-3', student_id: 'student-3', full_name: 'Sanjay Kapoor', phone: '+919876543214', relation: 'father', email: 'sanjay.kapoor@gmail.com', created_at: now() },
      { id: 'mother-3', user_id: 'mother-3', student_id: 'student-3', full_name: 'Meera Kapoor', phone: '+919876543215', relation: 'mother', email: 'meera.kapoor@gmail.com', created_at: now() },
    ];
    for (const p of parents) await db.ref(`parents/${p.id}`).set(p);
    logger.info('Parent profiles seeded');

    // ── TEACHER SUBJECTS ─────────────────────────────────────────────────────
    const teacherSubjects = [
      { teacher_id: 'teacher-1', subjects: ['Mathematics', 'Science'], class_ids: ['class-10-a', 'class-10-b'] },
      { teacher_id: 'teacher-2', subjects: ['English', 'Social Studies'], class_ids: ['class-10-a', 'class-10-b'] },
    ];
    for (const ts of teacherSubjects) await db.ref(`teacher_subjects/${ts.teacher_id}`).set({ ...ts, updated_at: now() });
    logger.info('Teacher-subject mappings seeded');

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
          teacher_id: subject.teachers[0], due_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          due_time: '23:59', total_marks: 30, status: 'active', type: ['homework','project','lab','test'][i % 4],
          created_at: now(), updated_at: now()
        });
      }
    }
    for (const a of assignments) await db.ref(`assignments/${a.id}`).set(a);
    logger.info(`Assignments seeded (${assignments.length} total)`);

    // ── SUBMISSIONS ───────────────────────────────────────────────────────────
    const submissions = [
      { id: 'sub-1', assignment_id: 'asgn-class-10-a-0', student_id: 'student-1', content: 'Completed worksheet', submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'graded', marks: 28 },
      { id: 'sub-2', assignment_id: 'asgn-class-10-a-1', student_id: 'student-1', content: 'Lab report submitted', submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'graded', marks: 25 },
      { id: 'sub-3', assignment_id: 'asgn-class-10-b-2', student_id: 'student-3', content: 'Essay submitted', submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'submitted' },
    ];
    for (const s of submissions) await db.ref(`submissions/${s.id}`).set({ ...s, created_at: now(), updated_at: now() });
    logger.info('Submissions seeded (3 total)');

    // ── MARKS ─────────────────────────────────────────────────────────────────
    const marks = [
      { id: 'mark-1', student_id: 'student-1', class_id: 'class-10-a', subject: 'Mathematics', score: 85, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-2', student_id: 'student-1', class_id: 'class-10-a', subject: 'English', score: 88, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-3', student_id: 'student-2', class_id: 'class-10-a', subject: 'Mathematics', score: 92, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-4', student_id: 'student-3', class_id: 'class-10-b', subject: 'English', score: 72, max_marks: 100, term: '1', created_at: now() },
      { id: 'mark-5', student_id: 'student-4', class_id: 'class-10-b', subject: 'Science', score: 78, max_marks: 100, term: '1', created_at: now() },
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
      { id: 'book-1', title: 'Introduction to Algorithms', author: 'Cormen', isbn: '978-0262033848', category: 'Technology', status: 'available', created_at: now() },
      { id: 'book-2', title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '978-0061120084', category: 'Literature', status: 'issued', borrower: { id: 'student-1', name: 'Priya Sharma', class: '10-A' }, issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_at: now() },
      { id: 'book-3', title: 'NCERT Mathematics Class 10', author: 'NCERT', isbn: '978-8174506313', category: 'Mathematics', status: 'available', created_at: now() },
    ];
    for (const book of books) await db.ref(`library_books/${book.id}`).set(book);
    logger.info('Library books seeded (3 total)');

    // ── LIBRARY TRANSACTIONS ──────────────────────────────────────────────────
    const transactions = [
      { id: 'ltx-1', bookId: 'book-2', bookTitle: 'To Kill a Mockingbird', studentId: 'student-1', studentName: 'Priya Sharma', studentClass: '10-A', issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'issued' },
      { id: 'ltx-2', bookId: 'book-1', bookTitle: 'Introduction to Algorithms', studentId: 'student-2', studentName: 'Aarav Menon', studentClass: '10-A', issueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'returned', returnDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), fine: 0 },
    ];
    for (const tx of transactions) await db.ref(`library_transactions/${tx.id}`).set(tx);
    logger.info('Library transactions seeded (2 total)');

    // ── ANNOUNCEMENTS ───────────────────────────────────────────────────────────
    const announcements = [
      { id: 'ann-1', title: 'Exam Schedule Released', body: 'Mid-term exams begin June 1st', category: 'exam', scope: 'all', created_by: 'admin-1', pinned: true, priority: 'high', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: now() },
      { id: 'ann-2', title: 'Library Books Due', body: 'Please return borrowed books by due date', category: 'reminder', scope: 'all', created_by: 'librarian-1', pinned: false, priority: 'medium', created_at: now(), updated_at: now() },
    ];
    for (const ann of announcements) await db.ref(`announcements/${ann.id}`).set(ann);
    logger.info('Announcements seeded (2 total)');

    // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    const notifications = [
      { id: 'notif-1', userId: 'student-1', target_users: ['student-1'], message: 'Your Physics assignment has been graded - 28/30', type: 'grade', read: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { id: 'notif-2', userId: 'student-1', target_users: ['student-1'], message: 'Library book due reminder', type: 'reminder', read: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
      { id: 'notif-3', userId: 'student-2', target_users: ['student-2'], message: 'Fee payment pending', type: 'payment', read: false, createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
    ];
    for (const n of notifications) await db.ref(`notifications/${n.id}`).set(n);
    logger.info('Notifications seeded (3 total)');

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