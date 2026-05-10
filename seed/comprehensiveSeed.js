import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

const SEED_VERSION = 4;
const SEED_FLAG_PATH = '_meta/seed_v4_done';

/**
 * Comprehensive seed data for SchoolSync
 * Run AFTER bootstrapDefaults.js has created users
 */
export const seedAllData = async () => {
  const flagSnap = await db.ref(SEED_FLAG_PATH).once('value');
  if (flagSnap.val() === SEED_VERSION) {
    logger.info('Seed data already applied — skipping');
    return;
  }

  logger.info('Running comprehensive seed...');

  try {
    // ── 1. Classrooms (required before assignments) ──
    const classrooms = [
      { id: 'class-10-a', name: '10-A', grade: '10', section: 'A', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'] },
      { id: 'class-10-b', name: '10-B', grade: '10', section: 'B', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'] },
      { id: 'class-9-a', name: '9-A', grade: '9', section: 'A', subjects: ['Mathematics', 'Physics', 'Chemistry', 'English', 'History'] },
      { id: 'class-8-a', name: '8-A', grade: '8', section: 'A', subjects: ['Mathematics', 'Science', 'English', 'Social Studies'] },
    ];

    for (const cls of classrooms) {
      await db.ref(`classrooms/${cls.id}`).update({
        ...cls,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('Classrooms seeded');

    // ── 2. Bus Routes & Live Locations ──
    const routes = [
      {
        id: 'route-route1',
        name: 'Route 1 - Chandanagar Loop',
        description: 'Covers Chandanagar, Hafeezpet, Kondapur areas',
        status: 'active',
        start_time: '07:00',
        end_time: '08:30',
        total_distance: 18.5,
        estimated_duration: 90,
        stops: [
          { name: 'Chandanagar Depot', latitude: 17.4967, longitude: 78.3614, time: '07:00' },
          { name: 'Hafeezpet Junction', latitude: 17.5035, longitude: 78.3652, time: '07:15' },
          { name: 'Kondapur Signal', latitude: 17.5103, longitude: 78.3698, time: '07:30' },
          { name: 'Miyapur Cross Roads', latitude: 17.4891, longitude: 78.3542, time: '07:45' },
          { name: 'Nallagandla', latitude: 17.5145, longitude: 78.3721, time: '08:00' },
          { name: 'School Main Gate', latitude: 17.5192, longitude: 78.3789, time: '08:15' },
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: 'route-route2',
        name: 'Route 2 - Serilingampally Express',
        description: 'Serilingampally, Bhel, Gachibowli corridor',
        status: 'active',
        start_time: '07:15',
        end_time: '08:45',
        total_distance: 22.0,
        estimated_duration: 90,
        stops: [
          { name: 'Serilingampally', latitude: 17.4455, longitude: 78.2758, time: '07:15' },
          { name: 'Bhel Colony', latitude: 17.4523, longitude: 78.2890, time: '07:30' },
          { name: 'Gachibowli', latitude: 17.4402, longitude: 78.3521, time: '07:50' },
          { name: 'University Campus', latitude: 17.4415, longitude: 78.3652, time: '08:05' },
          { name: 'School Main Gate', latitude: 17.5192, longitude: 78.3789, time: '08:30' },
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: 'route-route3',
        name: 'Route 3 - Madinaguda',
        description: 'Madinaguda, Kompally, Dulapally areas',
        status: 'active',
        start_time: '06:50',
        end_time: '08:20',
        total_distance: 15.0,
        estimated_duration: 90,
        stops: [
          { name: 'Madinaguda', latitude: 17.4812, longitude: 78.3256, time: '06:50' },
          { name: 'Kompally', latitude: 17.4932, longitude: 78.3412, time: '07:05' },
          { name: 'Dulapally', latitude: 17.5021, longitude: 78.3567, time: '07:20' },
          { name: 'Bachupally', latitude: 17.5103, longitude: 78.3678, time: '07:35' },
          { name: 'School Main Gate', latitude: 17.5192, longitude: 78.3789, time: '08:05' },
        ],
        created_at: new Date().toISOString(),
      },
      {
        id: 'route-route4',
        name: 'Route 4 - Lingampally',
        description: 'Lingampally, Jayabhereth, Bowrampet',
        status: 'active',
        start_time: '07:00',
        end_time: '08:35',
        total_distance: 20.0,
        estimated_duration: 95,
        stops: [
          { name: 'Lingampally Junction', latitude: 17.4521, longitude: 78.2834, time: '07:00' },
          { name: 'Jayabhereth Enclave', latitude: 17.4623, longitude: 78.2956, time: '07:15' },
          { name: 'Bowrampet', latitude: 17.4756, longitude: 78.3145, time: '07:30' },
          { name: 'Patancheru', latitude: 17.4889, longitude: 78.3289, time: '07:45' },
          { name: 'School Main Gate', latitude: 17.5192, longitude: 78.3789, time: '08:20' },
        ],
        created_at: new Date().toISOString(),
      },
    ];

    for (const route of routes) {
      await db.ref(`routes/${route.id}`).update({
        ...route,
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('Bus routes seeded');

    // Buses with live locations
    const buses = [
      {
        id: 'bus-bus1',
        bus_number: 'AP 28 T 1001',
        license_plate: 'AP28T1001',
        capacity: 45,
        route_id: 'route-route1',
        driver_id: 'driver-1',
        status: 'active',
        current_location: { latitude: 17.5035, longitude: 78.3652, speed: 35, heading: 90, timestamp: new Date().toISOString() },
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: 'bus-bus2',
        bus_number: 'AP 28 T 1002',
        license_plate: 'AP28T1002',
        capacity: 40,
        route_id: 'route-route2',
        driver_id: 'driver-2',
        status: 'active',
        current_location: { latitude: 17.4402, longitude: 78.3521, speed: 42, heading: 45, timestamp: new Date().toISOString() },
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: 'bus-bus3',
        bus_number: 'AP 28 T 1003',
        license_plate: 'AP28T1003',
        capacity: 50,
        route_id: 'route-route3',
        driver_id: 'driver-3',
        status: 'active',
        current_location: { latitude: 17.5021, longitude: 78.3567, speed: 28, heading: 180, timestamp: new Date().toISOString() },
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    for (const bus of buses) {
      await db.ref(`buses/${bus.id}`).update({
        ...bus,
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('Buses with live locations seeded');

    // ── 3. Timetable data (saves via the actual API path) ──
    const timetableEntries = [
      { day: 'Monday', period: 1, subject: 'Mathematics', teacher: 'Rajesh Kumar', room: '101' },
      { day: 'Monday', period: 2, subject: 'Physics', teacher: 'James Anderson', room: 'Lab 1' },
      { day: 'Monday', period: 3, subject: 'English', teacher: 'Emily Chen', room: '202' },
      { day: 'Monday', period: 4, subject: 'Chemistry', teacher: 'Rajesh Kumar', room: 'Lab 2' },
      { day: 'Monday', period: 5, subject: 'History', teacher: 'Emily Chen', room: '203' },
      { day: 'Tuesday', period: 1, subject: 'Physics', teacher: 'James Anderson', room: 'Lab 1' },
      { day: 'Tuesday', period: 2, subject: 'Mathematics', teacher: 'Rajesh Kumar', room: '101' },
      { day: 'Tuesday', period: 3, subject: 'Biology', teacher: 'Emily Chen', room: '204' },
      { day: 'Tuesday', period: 4, subject: 'English', teacher: 'Emily Chen', room: '202' },
      { day: 'Tuesday', period: 5, subject: 'Geography', teacher: 'Rajesh Kumar', room: '205' },
      { day: 'Wednesday', period: 1, subject: 'Chemistry', teacher: 'Rajesh Kumar', room: 'Lab 2' },
      { day: 'Wednesday', period: 2, subject: 'English', teacher: 'Emily Chen', room: '202' },
      { day: 'Wednesday', period: 3, subject: 'Mathematics', teacher: 'Rajesh Kumar', room: '101' },
      { day: 'Wednesday', period: 4, subject: 'Physics', teacher: 'James Anderson', room: 'Lab 1' },
      { day: 'Wednesday', period: 5, subject: 'Physical Education', teacher: 'Emily Chen', room: 'Ground' },
      { day: 'Thursday', period: 1, subject: 'Mathematics', teacher: 'Rajesh Kumar', room: '101' },
      { day: 'Thursday', period: 2, subject: 'Biology', teacher: 'Emily Chen', room: '204' },
      { day: 'Thursday', period: 3, subject: 'Physics', teacher: 'James Anderson', room: 'Lab 1' },
      { day: 'Thursday', period: 4, subject: 'English', teacher: 'Emily Chen', room: '202' },
      { day: 'Thursday', period: 5, subject: 'History', teacher: 'Emily Chen', room: '203' },
      { day: 'Friday', period: 1, subject: 'Chemistry', teacher: 'Rajesh Kumar', room: 'Lab 2' },
      { day: 'Friday', period: 2, subject: 'Mathematics', teacher: 'Rajesh Kumar', room: '101' },
      { day: 'Friday', period: 3, subject: 'English', teacher: 'Emily Chen', room: '202' },
      { day: 'Friday', period: 4, subject: 'Physics', teacher: 'James Anderson', room: 'Lab 1' },
      { day: 'Friday', period: 5, subject: 'Geography', teacher: 'Rajesh Kumar', room: '205' },
    ];

    const timetableData = {
      id: 'class-10-a',
      class_id: 'class-10-a',
      entries: JSON.stringify(timetableEntries),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.ref(`timetables/class-10-a`).update(timetableData);
    logger.info('Timetable seeded for class-10-a');

    // ── 4. Class Notes (teacher notes for /school/notes) ──
    const classNotes = [
      {
        id: 'note-note1',
        title: 'Quadratic Equations - Complete Guide',
        subject: 'Mathematics',
        class: '10-A',
        description: 'Comprehensive notes covering all methods of solving quadratic equations including factorization, completing the square, and quadratic formula.',
        teacherId: 'teacher-1',
        teacherName: 'Rajesh Kumar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'note-note2',
        title: 'Newton\'s Laws of Motion',
        subject: 'Physics',
        class: '10-A',
        description: 'Detailed explanation of all three laws with examples and problem-solving approaches.',
        teacherId: 'teacher-2',
        teacherName: 'James Anderson',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'note-note3',
        title: 'Chemical Bonding Fundamentals',
        subject: 'Chemistry',
        class: '10-A',
        description: 'Ionic, covalent, and metallic bonding explained with electron dot structures and examples.',
        teacherId: 'teacher-1',
        teacherName: 'Rajesh Kumar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'note-note4',
        title: 'English Grammar - Tenses Masterclass',
        subject: 'English',
        class: '10-A',
        description: 'All twelve tenses with formation rules, usage examples, and time expressions.',
        teacherId: 'teacher-3',
        teacherName: 'Emily Chen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'note-note5',
        title: 'Cell Structure and Functions',
        subject: 'Biology',
        class: '10-A',
        description: 'Plant and animal cell organelles with diagrams and functions.',
        teacherId: 'teacher-3',
        teacherName: 'Emily Chen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'note-note6',
        title: 'Indian Freedom Struggle Timeline',
        subject: 'History',
        class: '10-A',
        description: 'Key events from 1857 to 1947 with important dates and personalities.',
        teacherId: 'teacher-3',
        teacherName: 'Emily Chen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const note of classNotes) {
      await db.ref(`class_notes/${note.id}`).update(note);
    }
    logger.info('Class notes seeded');

    // ── 5. Assignments with proper classId references ──
    const assignments = [
      {
        id: 'asgn-1001',
        title: 'Linear Equations Worksheet',
        description: 'Solve 20 linear equations using substitution and elimination methods. Show all steps.',
        subject: 'Mathematics',
        class_id: 'class-10-a',
        class_name: '10-A',
        teacher_id: 'teacher-1',
        teacherName: 'Rajesh Kumar',
        due_date: '2026-05-20',
        max_marks: 50,
        status: 'active',
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'asgn-1002',
        title: 'Motion and Velocity Lab Report',
        description: 'Write a lab report on the velocity-time experiment conducted in class. Include graphs and analysis.',
        subject: 'Physics',
        class_id: 'class-10-a',
        class_name: '10-A',
        teacher_id: 'teacher-2',
        teacherName: 'James Anderson',
        due_date: '2026-05-22',
        max_marks: 30,
        status: 'active',
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'asgn-1003',
        title: 'Chemical Reactions Portfolio',
        description: 'Document 10 chemical reactions with equations, observations, and product identification.',
        subject: 'Chemistry',
        class_id: 'class-10-a',
        class_name: '10-A',
        teacher_id: 'teacher-1',
        teacherName: 'Rajesh Kumar',
        due_date: '2026-05-25',
        max_marks: 40,
        status: 'active',
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'asgn-1004',
        title: 'Essay: Impact of Digital Technology',
        description: 'Write a 500-word essay on how digital technology has transformed education in India.',
        subject: 'English',
        class_id: 'class-10-a',
        class_name: '10-A',
        teacher_id: 'teacher-3',
        teacherName: 'Emily Chen',
        due_date: '2026-05-18',
        max_marks: 25,
        status: 'active',
        attachments: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const asgn of assignments) {
      await db.ref(`assignments/${asgn.id}`).update(asgn);
    }
    logger.info('Assignments with classId references seeded');

    // ── 6. Student Marks for Report Cards ──
    const marks = [
      { id: 'mark-1', student_id: 'student-1', class_id: 'class-10-a', subject: 'Mathematics', score: 85, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-2', student_id: 'student-1', class_id: 'class-10-a', subject: 'Physics', score: 78, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-3', student_id: 'student-1', class_id: 'class-10-a', subject: 'Chemistry', score: 82, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-4', student_id: 'student-1', class_id: 'class-10-a', subject: 'English', score: 88, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-5', student_id: 'student-1', class_id: 'class-10-a', subject: 'Biology', score: 75, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-6', student_id: 'student-1', class_id: 'class-10-a', subject: 'History', score: 70, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-7', student_id: 'student-2', class_id: 'class-10-a', subject: 'Mathematics', score: 92, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-8', student_id: 'student-2', class_id: 'class-10-a', subject: 'Physics', score: 88, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-9', student_id: 'student-2', class_id: 'class-10-a', subject: 'Chemistry', score: 85, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-10', student_id: 'student-2', class_id: 'class-10-a', subject: 'English', score: 90, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-11', student_id: 'student-3', class_id: 'class-10-a', subject: 'Mathematics', score: 65, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-12', student_id: 'student-3', class_id: 'class-10-a', subject: 'Physics', score: 60, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-13', student_id: 'student-3', class_id: 'class-10-a', subject: 'Chemistry', score: 68, term: '1', created_at: new Date().toISOString() },
      { id: 'mark-14', student_id: 'student-3', class_id: 'class-10-a', subject: 'English', score: 72, term: '1', created_at: new Date().toISOString() },
    ];

    for (const mark of marks) {
      await db.ref(`marks/${mark.id}`).update(mark);
    }
    logger.info('Student marks for report cards seeded');

    // ── 7. Teacher Profiles ──
    const teacherProfiles = [
      { id: 'tp-1', user_id: 'teacher-1', subjects: ['Mathematics', 'Chemistry'], phone: '+919876543210', created_at: new Date().toISOString() },
      { id: 'tp-2', user_id: 'teacher-2', subjects: ['Physics'], phone: '+919876543211', created_at: new Date().toISOString() },
      { id: 'tp-3', user_id: 'teacher-3', subjects: ['English', 'Biology', 'History'], phone: '+919876543212', created_at: new Date().toISOString() },
    ];

    for (const tp of teacherProfiles) {
      await db.ref(`teacher_profiles/${tp.id}`).update({
        ...tp,
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('Teacher profiles seeded');

    // ── 8. Student Profiles ──
    const studentProfiles = [
      { id: 'sp-1', user_id: 'student-1', grade: '10', section: 'A', roll_number: '01', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'], attendance_percent: 95, xp: 450, badges: ['Top Scorer', 'Early Bird'], created_at: new Date().toISOString() },
      { id: 'sp-2', user_id: 'student-2', grade: '10', section: 'A', roll_number: '02', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'], attendance_percent: 98, xp: 620, badges: ['Top Scorer', 'Streak Master'], created_at: new Date().toISOString() },
      { id: 'sp-3', user_id: 'student-3', grade: '10', section: 'A', roll_number: '03', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'], attendance_percent: 88, xp: 280, badges: [], created_at: new Date().toISOString() },
    ];

    for (const sp of studentProfiles) {
      await db.ref(`student_profiles/${sp.id}`).update({
        ...sp,
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('Student profiles seeded');

    // ── 9. Exams and Questions ──
    const exams = [
      {
        id: 'exam-101',
        name: 'Mathematics Mid-Term Assessment',
        classId: 'class-10-a',
        class_name: '10-A',
        subject: 'Mathematics',
        createdBy: 'teacher-1',
        teacher_name: 'Rajesh Kumar',
        max_marks: 50,
        duration_minutes: 60,
        status: 'active',
        type: 'written',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'exam-102',
        name: 'Physics Quiz - Chapter 3',
        classId: 'class-10-a',
        class_name: '10-A',
        subject: 'Physics',
        createdBy: 'teacher-2',
        teacher_name: 'James Anderson',
        max_marks: 25,
        duration_minutes: 30,
        status: 'active',
        type: 'mcq',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'exam-103',
        name: 'Chemistry Practical Exam',
        classId: 'class-10-a',
        class_name: '10-A',
        subject: 'Chemistry',
        createdBy: 'teacher-1',
        teacher_name: 'Rajesh Kumar',
        max_marks: 40,
        duration_minutes: 90,
        status: 'active',
        type: 'practical',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'exam-104',
        name: 'English Grammar Test',
        classId: 'class-10-a',
        class_name: '10-A',
        subject: 'English',
        createdBy: 'teacher-3',
        teacher_name: 'Emily Chen',
        max_marks: 30,
        duration_minutes: 45,
        status: 'active',
        type: 'mcq',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'exam-105',
        name: 'Biology - Cell Division Quiz',
        classId: 'class-10-a',
        class_name: '10-A',
        subject: 'Biology',
        createdBy: 'teacher-3',
        teacher_name: 'Emily Chen',
        max_marks: 20,
        duration_minutes: 30,
        status: 'active',
        type: 'mcq',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const exam of exams) {
      await db.ref(`exams/${exam.id}`).update(exam);
    }
    logger.info('Exams seeded');

    const questions = [
      // Mathematics - Quadratic Equations (exam-101)
      { id: 'q-101-1', exam_id: 'exam-101', subject: 'Mathematics', class_name: '10-A', type: 'mcq', text: 'Which of the following is the standard form of a quadratic equation?', options: JSON.stringify(['ax + b = 0', 'ax² + bx + c = 0', 'a + bx + c = 0', 'ax³ + bx² + cx + d = 0']), correct_answer: 'ax² + bx + c = 0', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-101-2', exam_id: 'exam-101', subject: 'Mathematics', class_name: '10-A', type: 'mcq', text: 'Find the roots of x² - 5x + 6 = 0', options: JSON.stringify(['2 and 3', '1 and 6', '-2 and -3', '3 and 4']), correct_answer: '2 and 3', marks: 3, created_at: new Date().toISOString() },
      { id: 'q-101-3', exam_id: 'exam-101', subject: 'Mathematics', class_name: '10-A', type: 'written', text: 'Solve by factorization: x² + 7x + 12 = 0. Show all steps.', correct_answer: 'x = -3, x = -4', marks: 5, created_at: new Date().toISOString() },
      { id: 'q-101-4', exam_id: 'exam-101', subject: 'Mathematics', class_name: '10-A', type: 'mcq', text: 'The discriminant of 2x² - 4x + 2 = 0 is:', options: JSON.stringify(['16', '0', '8', '-8']), correct_answer: '0', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-101-5', exam_id: 'exam-101', subject: 'Mathematics', class_name: '10-A', type: 'written', text: 'Use the quadratic formula to solve: 2x² - 5x + 2 = 0', correct_answer: 'x = 2 or x = 0.5', marks: 5, created_at: new Date().toISOString() },

      // Physics - Laws of Motion (exam-102)
      { id: 'q-102-1', exam_id: 'exam-102', subject: 'Physics', class_name: '10-A', type: 'mcq', text: 'According to Newton\'s First Law, an object at rest will remain at rest unless acted upon by:', options: JSON.stringify(['Gravity', 'An external force', 'Internal forces', 'Friction only']), correct_answer: 'An external force', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-102-2', exam_id: 'exam-102', subject: 'Physics', class_name: '10-A', type: 'mcq', text: 'F = ma is Newton\'s Second Law, where F is force, m is mass, and a is:', options: JSON.stringify(['Area', 'Acceleration', 'Angle', 'Altitude']), correct_answer: 'Acceleration', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-102-3', exam_id: 'exam-102', subject: 'Physics', class_name: '10-A', type: 'mcq', text: 'If a body of mass 5 kg is accelerating at 3 m/s², the force is:', options: JSON.stringify(['15 N', '8 N', '2 N', '18 N']), correct_answer: '15 N', marks: 3, created_at: new Date().toISOString() },
      { id: 'q-102-4', exam_id: 'exam-102', subject: 'Physics', class_name: '10-A', type: 'mcq', text: 'Newton\'s Third Law states that every action has:', options: JSON.stringify(['An equal reaction', 'A greater reaction', 'A smaller reaction', 'No reaction']), correct_answer: 'An equal reaction', marks: 3, created_at: new Date().toISOString() },

      // Chemistry - Chemical Bonding (exam-103)
      { id: 'q-103-1', exam_id: 'exam-103', subject: 'Chemistry', class_name: '10-A', type: 'mcq', text: 'Ionic bonds are formed by:', options: JSON.stringify(['Sharing of electrons', 'Transfer of electrons', 'Proton exchange', 'Neutron sharing']), correct_answer: 'Transfer of electrons', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-103-2', exam_id: 'exam-103', subject: 'Chemistry', class_name: '10-A', type: 'written', text: 'Write the electron dot structure for sodium chloride (NaCl) formation.', correct_answer: 'Na gives electron to Cl, forming Na+ and Cl-', marks: 5, created_at: new Date().toISOString() },
      { id: 'q-103-3', exam_id: 'exam-103', subject: 'Chemistry', class_name: '10-A', type: 'mcq', text: 'Covalent bonds involve:', options: JSON.stringify(['Metal-metallic bonds', 'Sharing of electron pairs', 'Electron transfer', 'Electrostatic attraction']), correct_answer: 'Sharing of electron pairs', marks: 2, created_at: new Date().toISOString() },

      // English - Grammar (exam-104)
      { id: 'q-104-1', exam_id: 'exam-104', subject: 'English', class_name: '10-A', type: 'mcq', text: 'Identify the tense: "She has completed her homework."', options: JSON.stringify(['Simple Present', 'Present Perfect', 'Past Perfect', 'Future Perfect']), correct_answer: 'Present Perfect', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-104-2', exam_id: 'exam-104', subject: 'English', class_name: '10-A', type: 'mcq', text: 'Which sentence uses the correct article? "He is ___ honest man."', options: JSON.stringify(['a', 'an', 'the', 'no article']), correct_answer: 'an', marks: 2, created_at: new Date().toISOString() },

      // Biology - Cell Division (exam-105)
      { id: 'q-105-1', exam_id: 'exam-105', subject: 'Biology', class_name: '10-A', type: 'mcq', text: 'The process by which a cell divides into two identical daughter cells is called:', options: JSON.stringify(['Mitosis', 'Meiosis', 'Binary fission', 'Budding']), correct_answer: 'Mitosis', marks: 2, created_at: new Date().toISOString() },
      { id: 'q-105-2', exam_id: 'exam-105', subject: 'Biology', class_name: '10-A', type: 'mcq', text: 'During which phase of mitosis do chromosomes align at the cell equator?', options: JSON.stringify(['Prophase', 'Metaphase', 'Anaphase', 'Telophase']), correct_answer: 'Metaphase', marks: 2, created_at: new Date().toISOString() },
    ];

    for (const q of questions) {
      await db.ref(`questions/${q.id}`).update(q);
    }
    logger.info('Questions seeded');

    // ── 10. AI Interactions for Admin Dashboard ──
    const features = ['doubt_solver', 'essay_scorer', 'math_tutor', 'language_partner', 'study_planner'];
    const models = ['cerebras', 'groq'];
    const prompts = [
      'Can you explain photosynthesis?',
      'Help me with this quadratic equation: x² - 5x + 6 = 0',
      'Write a short essay on climate change',
      'What is the difference between mitosis and meiosis?',
      'How do I prepare for my math exam?',
      'Explain Newton\'s laws of motion',
      'Help me understand chemical bonding',
      'What are the types of sentences in English grammar?',
    ];

    const interactionSeeds = [];
    for (let i = 0; i < 50; i++) {
      const studentIds = ['student-1', 'student-2', 'student-3'];
      const date = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      interactionSeeds.push({
        id: `ai-int-${i}`,
        user_id: studentIds[i % 3],
        feature: features[i % features.length],
        prompt: prompts[i % prompts.length],
        response: 'Here\'s a detailed explanation based on your question...',
        model: models[i % models.length],
        prompt_tokens: 50 + Math.floor(Math.random() * 200),
        completion_tokens: 100 + Math.floor(Math.random() * 500),
        total_tokens: 150 + Math.floor(Math.random() * 700),
        response_time: 800 + Math.floor(Math.random() * 2000),
        created_at: date.toISOString(),
      });
    }
    for (const interaction of interactionSeeds) {
      await db.ref(`ai_interactions/${interaction.id}`).update(interaction);
    }
    logger.info('AI interactions seeded');

    // ── 11. Communities for NexusHub ──
    const communities = [
      { id: 'club_stem', name: 'STEM Pioneers', type: 'STEM', color: '#6366f1', creator_id: 'admin-1', members: ['student-1', 'student-2', 'student-3', 'teacher-1'], channels: ['general', 'code-share', 'projects'], extensions: ['leaderboard'], created_at: new Date().toISOString() },
      { id: 'club_sports', name: 'Athletics United', type: 'Sports', color: '#10b981', creator_id: 'admin-1', members: ['student-1', 'student-2'], channels: ['general', 'match-discussion'], extensions: [], created_at: new Date().toISOString() },
      { id: 'club_arts', name: 'Creative Collective', type: 'Arts', color: '#f59e0b', creator_id: 'admin-1', members: ['student-3', 'teacher-3'], channels: ['general', 'gallery'], extensions: ['leaderboard'], created_at: new Date().toISOString() },
      { id: 'club_social', name: 'Green Earth Initiative', type: 'Social', color: '#ef4444', creator_id: 'admin-1', members: ['student-1', 'student-3'], channels: ['general', 'volunteer'], extensions: [], created_at: new Date().toISOString() },
    ];
    for (const com of communities) {
      await db.ref(`communities/${com.id}`).update(com);
      await db.ref(`community_activity/${com.id}`).update({ points: Math.floor(Math.random() * 500) });
    }
    logger.info('Communities for NexusHub seeded');

    await db.ref(SEED_FLAG_PATH).set(SEED_VERSION);
  } catch (error) {
    logger.error('Seed failed:', { message: error.message });
    throw error;
  }
};
