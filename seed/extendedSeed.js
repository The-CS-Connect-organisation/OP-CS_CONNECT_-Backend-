import { db } from '../config/firebase.js';
import { logger } from '../utils/logger.js';

const SEED_VERSION = 8;
const SEED_FLAG_PATH = '_meta/seed_v8_done';

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
    // ── 1. Create/Update Student Profiles (keyed by user_id for direct lookup) ──
    const studentProfiles = [
      { key: 'student-1', user_id: 'student-1', grade: '10', section: 'A', roll_number: '01', class_id: 'class-10-a', class: '10-A', admission_no: 'ADM-2022-001847', date_of_birth: '2008-03-15', blood_group: 'O+', religion: 'Hindu', nationality: 'Indian', mother_id: 'mother-1', father_id: 'father-1', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'], attendance_percent: 95, xp: 450, badges: ['Top Scorer', 'Early Bird'] },
      { key: 'student-2', user_id: 'student-2', grade: '10', section: 'A', roll_number: '02', class_id: 'class-10-a', class: '10-A', admission_no: 'ADM-2022-001848', date_of_birth: '2008-07-22', blood_group: 'B+', religion: 'Hindu', nationality: 'Indian', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'], attendance_percent: 98, xp: 620, badges: ['Top Scorer', 'Streak Master'] },
      { key: 'student-3', user_id: 'student-3', grade: '10', section: 'A', roll_number: '03', class_id: 'class-10-a', class: '10-A', admission_no: 'ADM-2022-001849', date_of_birth: '2008-01-10', blood_group: 'A+', religion: 'Christian', nationality: 'Indian', subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography'], attendance_percent: 88, xp: 280, badges: [] },
    ];

    for (const sp of studentProfiles) {
      const { key, ...data } = sp;
      await db.ref(`student_profiles/${key}`).update({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    logger.info('Student profiles seeded with user_id as key');

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

    // ── 4. Announcements (50 items linked to assignments) ──
    const announcements = [
      { id: 'ann-1', title: 'Mid-Term Examination Schedule Released', body: 'The mid-term examination schedule has been published. Please check the exam portal for detailed timings and seating arrangements. All students must carry their school ID cards.', category: 'exam', scope: 'all', class_id: null, created_by: 'admin-1', pinned: true, priority: 'high', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-2', title: 'Annual Sports Day - Registrations Open', body: 'Annual Sports Day will be held on May 25th. Students can register for various events including athletics, team sports, and creative activities. Last date for registration is May 18th.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: true, priority: 'medium', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-3', title: 'Chemistry Lab Safety Guidelines Updated', body: 'Updated safety guidelines for chemistry practicals have been posted. All students must review these before attending the upcoming practical examination.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-4', title: 'Fee Payment Reminder - Final Due Date', body: 'This is a reminder that the second term fee payment is due by May 15th. Parents who have not yet paid can use the online payment portal or visit the school office.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-5', title: 'Physics Assignment Due - Motion and Velocity Lab Report', body: 'Submit your lab report on motion and velocity by May 20th. Refer to assignment asgn-1001 for details.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'high', assignment_id: 'asgn-1001', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-6', title: 'Mathematics Quiz Tomorrow - Chapter 5', body: 'There will be a short quiz on Chapter 5 (Algebra) tomorrow. Prepare all formulas and practice problems from the textbook.', category: 'exam', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-7', title: 'School Holiday - Independence Day', body: 'School will remain closed on August 15th on account of Independence Day. Regular classes resume from August 16th.', category: 'holiday', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-8', title: 'English Essay Submission Reminder', body: 'Your essay on digital transformation is due in 2 days. Check assignment asgn-1004 on the portal for guidelines.', category: 'reminder', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'high', assignment_id: 'asgn-1004', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-9', title: 'Chemistry Lab Practical Examination', body: 'The chemistry practical examination will be conducted on May 22nd. Bring your lab coat and safety goggles. Practical assignment asgn-1003 covers all required experiments.', category: 'exam', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'high', assignment_id: 'asgn-1003', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-10', title: 'Computer Science Workshop Registration', body: 'A 3-day workshop on Python programming starts next week. Limited seats available. Register through the club portal.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-11', title: 'Biology Field Trip to City Botanical Garden', body: 'Class 10 students are invited to a field trip on May 28th. Carry your field study notebook and water bottle. Permission slips due by May 20th.', category: 'event', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-12', title: 'Mathematics Assignment - Linear Equations', body: 'Complete exercises 1-20 from Chapter 6 on Linear Equations. Due date: May 18th.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-13', title: 'Annual Day Rehearsal Schedule', body: 'Annual day rehearsals begin from May 16th. Check the notice board for your stage slot and costume requirements.', category: 'schedule', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-14', title: 'Physics Test Results Released', body: 'Results of the Physics test conducted last week are now available on the student portal. Check your marks and contact the teacher for re-evaluation.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-2', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-15', title: 'Library Hours Extended During Exams', body: 'The library will remain open until 8 PM on all weekdays during the examination period for student reference.', category: 'administrative', scope: 'all', class_id: null, created_by: 'librarian-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-16', title: 'History Project Submission - Ancient Civilizations', body: 'Submit your group project on ancient civilizations by May 25th. Reference assignment asgn-1002 for requirements.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'high', assignment_id: 'asgn-1002', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-17', title: 'Class 10 Toppers Felicitation Ceremony', body: 'Top performers from the previous term will be felicitated on May 30th. Parents are invited to attend the ceremony at 10 AM in the main auditorium.', category: 'achievement', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-18', title: 'Bus Route Timings Updated', body: 'New bus timings have been uploaded to the parent portal. Please review and inform the transport office of any conflicts.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-19', title: 'Urgent: Chemistry Lab Safety Incident Report', body: 'A minor chemical spill was reported in Lab 3. All students must strictly follow safety protocols during practicals. New guidelines posted.', category: 'urgent', scope: 'class', class_id: 'class-10-a', created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-20', title: 'PTM Date Announced - May 28th', body: 'Parent-Teacher Meeting for Term 2 will be held on May 28th from 9 AM to 2 PM. Parents must carry the progress report card.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-21', title: 'Yoga and Meditation Workshop', body: 'A wellness workshop on yoga and meditation will be conducted on May 24th for all students. Sign up through the student portal.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-22', title: 'Geography Assignment - Climate Change Report', body: 'Prepare a 5-page report on climate change impacts. Submission deadline: May 22nd.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-23', title: 'Mathematics Chapter Test - May 20th', body: 'Chapter test on Trigonometry will be conducted on May 20th. Focus on formulas and application problems.', category: 'exam', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-24', title: 'School Magazine Submission Open', body: 'Submit your poems, short stories, and articles for the school magazine by May 31st. Email to magazine@schoolsync.edu.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-25', title: 'Health Camp - Eye and Dental Checkup', body: 'Free health checkup camp on May 26th in the school auditorium. All students are encouraged to participate.', category: 'health', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-26', title: 'Physics Assignment Due - Optics Lab', body: 'Submit your optics lab assignment covering reflection and refraction experiments. Due: May 21st.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-2', pinned: false, priority: 'high', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-27', title: 'Computer Lab Upgradation Complete', body: 'The computer lab has been upgraded with new systems and software. Lab access resumes from May 16th.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-28', title: 'English Grammar Workshop', body: 'An interactive grammar workshop for Classes 9 and 10 on May 23rd. Register at the reception.', category: 'event', scope: 'all', class_id: null, created_by: 'teacher-3', pinned: false, priority: 'low', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-29', title: 'Scholarship Applications Open', body: 'Applications for the merit scholarship are now open. Submit forms with required documents by May 25th.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-30', title: 'Mandatory Assembly - Monday', body: 'All students must attend the Monday assembly without fail. Formations begin at 8:00 AM sharp.', category: 'schedule', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-31', title: 'Physics Olympiad Registration', body: 'National Physics Olympiad registrations are open. Interested students should contact the physics department by May 20th.', category: 'event', scope: 'all', class_id: null, created_by: 'teacher-2', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-32', title: 'Biology Diagrams Assignment', body: 'Draw and label diagrams of the human digestive system. Submission via portal by May 19th.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-33', title: 'Diwali Holiday Announcement', body: 'School will remain closed from November 1st to 7th for Diwali festivities. Classes resume on November 8th.', category: 'holiday', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-34', title: 'Mathematics Remedial Classes', body: 'Extra mathematics classes for weak students every Saturday 9-11 AM. Meet teacher-1 in Room 201.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-35', title: 'Fire Drill Scheduled', body: 'A mandatory fire safety drill will be conducted on May 24th at 10 AM. Follow all safety instructions.', category: 'urgent', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-36', title: 'Chemistry Mole Concept Test', body: 'Test on mole concept and stoichiometry on May 19th. Prepare from Chapter 3 textbook.', category: 'exam', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-37', title: 'Student Council Elections', body: 'Student council elections for the academic year will be held on May 27th. Nomination forms available at admin office.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-38', title: 'Science Exhibition Entries Invited', body: 'Annual science exhibition on June 5th. Submit your project proposals by May 22nd. Categories: physics, chemistry, biology, environmental science.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-39', title: 'English Speaking Competition', body: 'Inter-class English elocution competition on May 29th. Topic: "Technology in Education". Register by May 23rd.', category: 'event', scope: 'all', class_id: null, created_by: 'teacher-3', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-40', title: 'Attendance Shortfall Warning', body: 'Students with attendance below 75% have been flagged. Parents will be contacted. Ensure regular school attendance.', category: 'urgent', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-41', title: 'Geography Map Work Submission', body: 'Submit the filled outline maps of India and world continents by May 18th.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-42', title: 'Physics Periodic Motion Assignment', body: 'Complete the worksheet on simple harmonic motion. Reference textbook Chapter 8. Due: May 23rd.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-2', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-43', title: 'School Uniform Guidelines Updated', body: 'New uniform guidelines have been issued. Full details available on the parent portal. Implementation from June 1st.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-44', title: 'Art and Craft Exhibition', body: 'Showcase your paintings, sketches, and craft work in the annual exhibition. Submit entries by May 24th.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-45', title: 'Mathematics Model Paper Released', body: 'Sample model question papers for the annual exam are now available in the student portal.', category: 'exam', scope: 'all', class_id: null, created_by: 'teacher-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-46', title: 'History Source Analysis Assignment', body: 'Write a 3-page analysis of primary sources from the Indian independence movement. Due May 24th.', category: 'academic', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-3', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-47', title: 'Water Conservation Drive', body: 'School is launching a water conservation campaign. Form groups and submit proposals by May 26th.', category: 'event', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'low', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-48', title: 'Class Photo Day - May 29th', body: 'Individual and class photographs will be taken on May 29th. Wear clean uniform and be present on time.', category: 'schedule', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'medium', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-49', title: 'Chemistry IUPAC Nomenclature Test', body: 'Quiz on IUPAC naming conventions for organic compounds on May 21st. Practice from handout provided.', category: 'exam', scope: 'class', class_id: 'class-10-a', created_by: 'teacher-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
      { id: 'ann-50', title: 'Semester Fee Payment Window Closing', body: 'Last date to pay semester fees without penalty is May 15th. Pay online or at the accounts office before 4 PM.', category: 'administrative', scope: 'all', class_id: null, created_by: 'admin-1', pinned: false, priority: 'high', created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() },
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

    // ── 7. Update user records with proper names and profile images ──
    const users = [
      { id: 'student-1', name: 'Priya Sharma',    email: 'student@schoolsync.edu',    phone: '+919876543210', class: '10-A', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya' },
      { id: 'student-2', name: 'Aarav Menon',     email: 'student2@schoolsync.edu',   phone: '+919876543220', class: '10-A', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aarav' },
      { id: 'student-3', name: 'Ishita Kapoor',   email: 'student3@schoolsync.edu',   phone: '+919876543230', class: '10-A', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ishita' },
      { id: 'teacher-1', name: 'Rajesh Kumar',   email: 'teacher@schoolsync.edu',   phone: '+919876543240', department: 'Mathematics', subjects: ['Mathematics', 'Chemistry'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rajesh' },
      { id: 'teacher-2', name: 'James Anderson', email: 'teacher2@schoolsync.edu',  phone: '+919876543250', department: 'Physics', subjects: ['Physics'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=james' },
      { id: 'teacher-3', name: 'Emily Chen',     email: 'teacher3@schoolsync.edu',  phone: '+919876543260', department: 'Languages', subjects: ['English', 'Biology', 'History'], avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emily' },
      { id: 'admin-1',   name: 'Alicia Morgan',   email: 'admin@schoolsync.edu',     phone: '+919876543299', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alicia' },
      { id: 'admin-2',   name: 'Rahul Venkat',    email: 'admin2@schoolsync.edu',    phone: '+919876543298', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul' },
      { id: 'admin-3',   name: 'Neha Kapoor',     email: 'admin3@schoolsync.edu',    phone: '+919876543297', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=neha' },
      { id: 'driver-1',  name: 'Amit Patel',     email: 'driver@schoolsync.edu',    phone: '+919876543280', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit' },
      { id: 'driver-2',  name: 'Suresh Singh',   email: 'driver2@schoolsync.edu',   phone: '+919876543281', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=suresh' },
      { id: 'driver-3',  name: 'Mohan Das',     email: 'driver3@schoolsync.edu',   phone: '+919876543282', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=mohan' },
      { id: 'parent-1',  name: 'Vikram Singh',   email: 'parent@schoolsync.edu',    phone: '+919876543211', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vikram' },
      { id: 'parent-2',  name: 'Priya Menon',    email: 'parent2@schoolsync.edu',   phone: '+919876543212', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya_m' },
      { id: 'parent-3',  name: 'Deepak Verma',   email: 'parent3@schoolsync.edu',   phone: '+919876543213', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=deepak' },
      { id: 'librarian-1', name: 'Fatima Ansari', email: 'librarian@schoolsync.edu', phone: '+919876543250', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fatima' },
      { id: 'librarian-2', name: 'Sanjay Reddy', email: 'librarian2@schoolsync.edu', phone: '+919876543251', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sanjay' },
      { id: 'librarian-3', name: 'Nisha Gupta', email: 'librarian3@schoolsync.edu', phone: '+919876543252', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nisha' },
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

    // ── 11. Subjects (K-12) ──
    const subjects = [
      { id: 'sub-math',    name: 'Mathematics',    code: 'MATH',    class_levels: ['1','2','3','4','5','6','7','8','9','10','11','12'], color: '#ef4444' },
      { id: 'sub-eng',     name: 'English',         code: 'ENG',     class_levels: ['1','2','3','4','5','6','7','8','9','10','11','12'], color: '#3b82f6' },
      { id: 'sub-hindi',   name: 'Hindi',           code: 'HIN',     class_levels: ['1','2','3','4','5','6','7','8','9','10','11','12'], color: '#f97316' },
      { id: 'sub-science', name: 'Science',         code: 'SCI',     class_levels: ['1','2','3','4','5','6','7','8','9','10'],          color: '#10b981' },
      { id: 'sub-sst',     name: 'Social Studies',  code: 'SST',     class_levels: ['6','7','8','9','10'],                            color: '#8b5cf6' },
      { id: 'sub-physics', name: 'Physics',         code: 'PHY',     class_levels: ['9','10','11','12'],                              color: '#06b6d4' },
      { id: 'sub-chem',    name: 'Chemistry',       code: 'CHEM',    class_levels: ['9','10','11','12'],                              color: '#a855f7' },
      { id: 'sub-bio',     name: 'Biology',         code: 'BIO',     class_levels: ['9','10','11','12'],                              color: '#22c55e' },
      { id: 'sub-cs',      name: 'Computer Science', code: 'CS',     class_levels: ['6','7','8','9','10','11','12'],                  color: '#0ea5e9' },
      { id: 'sub-arts',    name: 'Art & Craft',     code: 'ART',     class_levels: ['1','2','3','4','5','6','7','8','9','10','11','12'], color: '#ec4899' },
      { id: 'sub-pe',      name: 'Physical Ed.',    code: 'PE',      class_levels: ['1','2','3','4','5','6','7','8','9','10','11','12'], color: '#f59e0b' },
      { id: 'sub-economics',name: 'Economics',      code: 'ECO',     class_levels: ['11','12'],                                      color: '#64748b' },
      { id: 'sub-accountancy',name: 'Accountancy',   code: 'ACC',     class_levels: ['11','12'],                                      color: '#78716c' },
      { id: 'sub-commerce', name: 'Commerce',       code: 'COM',     class_levels: ['11','12'],                                      color: '#84cc16' },
    ];
    for (const s of subjects) await db.ref(`subjects/${s.id}`).update({ ...s, created_at: new Date().toISOString() });
    logger.info('Subjects seeded (K-12)');

    // ── 12. Class Rooms (K-12) ──
    const classes = [];
    for (let grade = 1; grade <= 12; grade++) {
      for (const section of ['A', 'B']) {
        const classId = `class-${grade}-${section.toLowerCase()}`;
        classes.push({
          id: classId,
          name: `${grade}-${section}`,
          grade: String(grade),
          section,
          class_teacher_id: grade <= 5 ? 'teacher-1' : grade <= 8 ? 'teacher-2' : 'teacher-3',
          created_at: new Date().toISOString(),
        });
      }
    }
    for (const c of classes) await db.ref(`class_rooms/${c.id}`).update(c);
    logger.info('Class rooms seeded (K-12, 24 classes)');

    // ── 13. Teacher → Subjects mapping (each teacher 2 subjects) ──
    const teacherSubjects = [
      { teacher_id: 'teacher-1', subjects: ['sub-math', 'sub-chem'],    class_ids: ['class-10-a','class-10-b','class-11-a','class-11-b'] },
      { teacher_id: 'teacher-2', subjects: ['sub-physics', 'sub-cs'],   class_ids: ['class-10-a','class-10-b','class-12-a','class-12-b'] },
      { teacher_id: 'teacher-3', subjects: ['sub-eng', 'sub-sst'],      class_ids: ['class-9-a','class-9-b','class-8-a','class-8-b'] },
    ];
    for (const ts of teacherSubjects) await db.ref(`teacher_subjects/${ts.teacher_id}`).update({ ...ts, updated_at: new Date().toISOString() });
    logger.info('Teacher-subject mappings seeded');

    // ── 14. Student → Subject enrollment ──
    const studentSubjects = [
      { student_id: 'student-1', subjects: ['sub-math','sub-physics','sub-chem','sub-bio','sub-eng','sub-sst','sub-cs'], class_id: 'class-10-a' },
      { student_id: 'student-2', subjects: ['sub-math','sub-physics','sub-chem','sub-bio','sub-eng','sub-sst','sub-cs'], class_id: 'class-10-a' },
      { student_id: 'student-3', subjects: ['sub-math','sub-physics','sub-chem','sub-bio','sub-eng','sub-sst','sub-cs'], class_id: 'class-10-a' },
    ];
    for (const ss of studentSubjects) await db.ref(`student_subjects/${ss.student_id}`).update({ ...ss, updated_at: new Date().toISOString() });
    logger.info('Student-subject enrollments seeded');

    // ── 15. Timetable for 120 school days (Mon-Fri, 8 periods) ──
    const periodTimings = [
      { period: 1, start: '08:00', end: '08:45' },
      { period: 2, start: '08:45', end: '09:30' },
      { period: 3, start: '09:30', end: '10:15' },
      { period: 4, start: '10:15', end: '11:00' },
      { period: 5, start: '11:00', end: '11:45' },
      { period: 6, start: '11:45', end: '12:30' },
      { period: 7, start: '12:30', end: '13:15' },
      { period: 8, start: '13:15', end: '14:00' },
    ];
    // 5-day rotating schedule (one row per week day Mon-Fri)
    const class10aSchedule = [
      ['sub-math','sub-eng','sub-science','sub-hindi','sub-cs','sub-arts','sub-pe',null],
      ['sub-eng','sub-chem','sub-physics','sub-math','sub-eng','sub-sst','sub-math',null],
      ['sub-science','sub-math','sub-hindi','sub-chem','sub-physics','sub-cs','sub-sst',null],
      ['sub-hindi','sub-physics','sub-math','sub-eng','sub-sst','sub-chem','sub-arts',null],
      ['sub-physics','sub-science','sub-eng','sub-math','sub-chem','sub-sst','sub-cs',null],
    ];
    const days = [];
    const current = new Date('2026-05-11');
    let d = new Date(current);
    while (days.length < 120) {
      if (d.getDay() >= 1 && d.getDay() <= 5) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    const class10aTimetable = {};
    days.forEach((dayDate, idx) => {
      const dateStr = dayDate.toISOString().split('T')[0];
      const dayOfWeek = dayDate.getDay() - 1; // 0=Mon
      const row = class10aSchedule[dayOfWeek];
      class10aTimetable[dateStr] = { day: ['Monday','Tuesday','Wednesday','Thursday','Friday'][dayOfWeek], periods: [] };
      for (let p = 0; p < 8; p++) {
        const subjId = row[p] || null;
        const subj = subjects.find(s => s.id === subjId);
        const tm = teacherSubjects.find(t => t.subjects.includes(subjId));
        class10aTimetable[dateStr].periods.push({
          period: p + 1,
          start: periodTimings[p].start,
          end: periodTimings[p].end,
          subject_id: subjId,
          subject_name: subj?.name || '',
          teacher_id: tm?.teacher_id || null,
        });
      }
    });
    await db.ref('timetables/class-10-a').update(class10aTimetable);
    logger.info(`Timetable seeded: 120 school days, 8 periods for class-10-a`);

    await db.ref(SEED_FLAG_PATH).set(SEED_VERSION);
    logger.info('Extended seed complete!');
  } catch (error) {
    logger.error('Extended seed failed:', { message: error.message });
    // Don't throw — let server stay up in degraded mode
  }
};