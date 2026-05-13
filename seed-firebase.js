/**
 * Direct Firebase seeder - FAST version with batch writes
 * Reuses Firebase app initialized by config/firebase.js (server.js)
 */
import { db } from './config/firebase.js';
import pkg from 'bcryptjs';
const { hash } = pkg;

const now = () => new Date().toISOString();

// Deterministic seeded random
function seededRand(seed) {
  let s = (seed * 16807 + 0) % 2147483647;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// XP → Level (1000 XP per level)
function xpToLevel(xp) {
  return Math.floor(xp / 1000) + 1;
}

// Batch write (max 500 per batch to be safe)
async function batchWrite(writes) {
  const chunks = [];
  for (let i = 0; i < writes.length; i += 400) chunks.push(writes.slice(i, i + 400));
  for (const chunk of chunks) {
    const updates = {};
    for (const { path, data } of chunk) updates[path] = data;
    await db.ref().update(updates);
  }
}

// 120 school days (Mon-Fri)
function schoolDays120() {
  const days = [];
  const d = new Date('2026-01-06');
  while (days.length < 120) {
    if (d.getDay() >= 1 && d.getDay() <= 5) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const SEED_VERSION = 100;
const SEED_FLAG_PATH = '_meta/seed_v100_done';

const seedFirebaseData = async function() {
  // Check if already seeded
  try {
    const flagSnap = await db.ref(SEED_FLAG_PATH).once('value');
    if (flagSnap.val() === SEED_VERSION) {
      console.log('Firebase seed already applied (v' + SEED_VERSION + ') — skipping. Delete ' + SEED_FLAG_PATH + ' in Firebase RTDB to re-seed.');
      return;
    }
  } catch (err) {
    console.warn('Seed flag check failed, proceeding...');
  }

  console.log('Starting fast Firebase seed...');
  const days = schoolDays120();
  const subjects = [
    { id: 'sub-math', name: 'Mathematics', code: 'MATH', color: '#ef4444' },
    { id: 'sub-eng',  name: 'English',      code: 'ENG',  color: '#3b82f6' },
    { id: 'sub-hindi',name: 'Hindi',        code: 'HIN',  color: '#f97316' },
    { id: 'sub-science', name: 'Science',    code: 'SCI',  color: '#10b981' },
    { id: 'sub-sst',  name: 'Social Studies', code: 'SST', color: '#8b5cf6' },
    { id: 'sub-physics', name: 'Physics',   code: 'PHY',  color: '#06b6d4' },
    { id: 'sub-chem', name: 'Chemistry',     code: 'CHEM', color: '#a855f7' },
    { id: 'sub-bio',  name: 'Biology',       code: 'BIO',  color: '#22c55e' },
    { id: 'sub-cs',   name: 'Computer Science', code: 'CS', color: '#0ea5e9' },
    { id: 'sub-arts', name: 'Art & Craft',  code: 'ART',  color: '#ec4899' },
    { id: 'sub-pe',   name: 'Physical Ed.',  code: 'PE',   color: '#f59e0b' },
  ];

  // Generate 150 students across grades 6-12 with multiple sections
  const firstNames = ['Aarav', 'Aanya', 'Aditya', 'Aisha', 'Arjun', 'Avni', 'Dev', 'Diya', 'Ishaan', 'Kavya', 'Mira', 'Neil', 'Priya', 'Reyansh', 'Saanvi', 'Vivaan', 'Yash', 'Zara', 'Arnav', 'Myra', 'Kabir', 'Ananya', 'Rohan', 'Sneha', 'Karan', 'Tara', 'Om', 'Navya', 'Aryan', 'Kiara', 'Veer', 'Sia', 'Ari', 'Laksh', 'Tanvi', 'Riya', 'Dhruv', 'Neha', 'Kabir', 'Anika', 'Rohan', 'Aadhya', 'Vihaan', 'Myra', 'Ayaan', 'Sara', 'Krish', 'Aditi', 'Arnav', 'Riya', 'Vivaan', 'Aarna', 'Atharv', 'Pari', 'Atharva', 'Myra', 'Yash', 'Aadhya'];
  const lastNames = ['Sharma', 'Patel', 'Gupta', 'Singh', 'Kapoor', 'Nair', 'Mehta', 'Reddy', 'Chen', 'Kumar', 'Verma', 'Joshi', 'Shah', 'Trivedi', 'Mishra', 'Banerjee', 'Iyer', 'Rao', 'Sinha', 'Pandey'];
  const students = [];
  const grades = ['6', '7', '8', '9', '10', '11', '12'];
  const sections = ['A', 'B', 'C'];

  let studentIdx = 1;
  for (const grade of grades) {
    for (const section of sections) {
      for (let i = 0; i < 8; i++) { // 8 students per class section = 168 total
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const classId = `class-${grade}-${section.toLowerCase()}`;
        students.push({
          id: `student-${studentIdx}`,
          name: `${firstName} ${lastName}`,
          class: `${grade}-${section}`,
          class_id: classId,
          email: `student${studentIdx}@schoolsync.edu`
        });
        studentIdx++;
      }
    }
  }

  // Generate 35 teachers across subjects
  const teacherNames = [
    'Rajesh Kumar', 'James Anderson', 'Emily Chen', 'Priya Sharma', 'Vikram Singh',
    'Anita Gupta', 'Rajiv Menon', 'Sunita Rao', 'Ajay Patel', 'Kavita Sharma',
    'Sanjay Verma', 'Meera Nair', 'Arun Joshi', 'Pooja Shah', 'Deepak Kumar',
    'Neeraj Singh', 'Rashmi Kapoor', 'Vijay Gupta', 'Sakshi Sharma', 'Rahul Nair',
    'Manish Patel', 'Anjali Singh', 'Ajit Kumar', 'Preeti Menon', 'Vikram Rao',
    'Anu Sharma', 'Rohit Gupta', 'Kamini Singh', 'Milind Joshi', 'Swati Shah',
    'Gautam Kumar', 'Charu Patel', 'Nitin Sharma', 'Riya Nair'
  ];
  const teacherSubjects = [
    ['Mathematics'], ['Physics'], ['Chemistry'], ['English'], ['Social Studies'],
    ['Biology'], ['Computer Science'], ['Hindi'], ['Art & Craft'], ['Physical Ed.'],
    ['Mathematics', 'Physics'], ['Chemistry', 'Biology'], ['English', 'Social Studies'],
    ['Mathematics', 'Chemistry'], ['Physics', 'Computer Science']
  ];
  const teachers = [];
  for (let i = 0; i < teacherNames.length; i++) {
    teachers.push({
      id: `teacher-${i + 1}`,
      name: teacherNames[i],
      email: `teacher${i + 1}@schoolsync.edu`,
      subjects: teacherSubjects[i % teacherSubjects.length]
    });
  }

  const scheduleRows = [
    ['sub-math','sub-eng','sub-science','sub-hindi','sub-cs','sub-arts','sub-pe',null],
    ['sub-eng','sub-chem','sub-physics','sub-math','sub-eng','sub-sst','sub-math',null],
    ['sub-science','sub-math','sub-hindi','sub-chem','sub-physics','sub-cs','sub-sst',null],
    ['sub-hindi','sub-physics','sub-math','sub-eng','sub-sst','sub-chem','sub-arts',null],
    ['sub-physics','sub-science','sub-eng','sub-math','sub-chem','sub-sst','sub-cs',null],
  ];

  const periodTimings = [
    { period: 1, start: '08:00', end: '08:45' }, { period: 2, start: '08:45', end: '09:30' },
    { period: 3, start: '09:30', end: '10:15' }, { period: 4, start: '10:15', end: '11:00' },
    { period: 5, start: '11:00', end: '11:45' }, { period: 6, start: '11:45', end: '12:30' },
    { period: 7, start: '12:30', end: '13:15' }, { period: 8, start: '13:15', end: '14:00' },
  ];

  const pwHash = await hash('student123', 12);
  const tHash = await hash('teacher123', 12);
  const aHash = await hash('admin123', 12);
  const mHash = await hash('manager123', 12);
  const dHash = await hash('driver123', 12);
  const pHash = await hash('parent123', 12);
  const lHash = await hash('librarian123', 12);

  // ── USERS (batch) ─────────────────────────────────────────────────────────
  const avatarSeed = (name) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
  const userWrites = [];
  for (const s of students) userWrites.push({ path: `users/${s.id}`, data: { id: s.id, name: s.name, email: s.email, role: 'student', is_active: true, password_hash: pwHash, avatar: avatarSeed(s.name), created_at: now(), updated_at: now() } });
  for (const t of teachers) userWrites.push({ path: `users/${t.id}`, data: { id: t.id, name: t.name, email: t.email, role: 'teacher', is_active: true, password_hash: tHash, avatar: avatarSeed(t.name), created_at: now(), updated_at: now() } });
  for (let i = 1; i <= 3; i++) userWrites.push({ path: `users/admin-${i}`, data: { id: `admin-${i}`, name: `Admin ${i}`, email: `admin${i}@schoolsync.edu`, role: 'admin', is_active: true, password_hash: aHash, avatar: avatarSeed(`admin${i}`), created_at: now(), updated_at: now() } });
  userWrites.push({ path: 'users/manager-1', data: { id: 'manager-1', name: 'Sonia Verma', email: 'manager@schoolsync.edu', role: 'manager', is_active: true, password_hash: mHash, avatar: avatarSeed('Sonia Verma'), created_at: now(), updated_at: now() } });
  for (let i = 1; i <= 3; i++) userWrites.push({ path: `users/driver-${i}`, data: { id: `driver-${i}`, name: `Driver ${i}`, email: `driver${i}@schoolsync.edu`, role: 'driver', is_active: true, password_hash: dHash, avatar: avatarSeed(`driver${i}`), created_at: now(), updated_at: now() } });
  for (let i = 1; i <= 3; i++) userWrites.push({ path: `users/parent-${i}`, data: { id: `parent-${i}`, name: `Parent ${i}`, email: `parent${i}@schoolsync.edu`, role: 'parent', is_active: true, password_hash: pHash, avatar: avatarSeed(`parent${i}`), created_at: now(), updated_at: now() } });
  for (let i = 1; i <= 3; i++) userWrites.push({ path: `users/librarian-${i}`, data: { id: `librarian-${i}`, name: `Librarian ${i}`, email: `librarian${i}@schoolsync.edu`, role: 'librarian', is_active: true, password_hash: lHash, avatar: avatarSeed(`librarian${i}`), created_at: now(), updated_at: now() } });
  await batchWrite(userWrites);
  console.log('✓ 19 users with avatars');

  // ── SUBJECTS + CLASSES (batch) ────────────────────────────────────────────
  const miscWrites = [];
  for (const s of subjects) miscWrites.push({ path: `subjects/${s.id}`, data: { ...s, class_levels: ['1','2','3','4','5','6','7','8','9','10','11','12'], created_at: now() } });
  for (let grade = 6; grade <= 12; grade++) {
    for (const sec of ['A','B','C']) {
      const cid = `class-${grade}-${sec.toLowerCase()}`;
      const teacherIdx = (grade - 6) % teachers.length + 1;
      miscWrites.push({ path: `class_rooms/${cid}`, data: { id: cid, name: `${grade}-${sec}`, grade: String(grade), section: sec, class_teacher_id: `teacher-${teacherIdx}`, created_at: now() } });
    }
  }
  // Add teacher subject mappings for all teachers
  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const classIds = [];
    for (let g = 6; g <= 12; g++) {
      if (i % 7 === g % 7) {
        classIds.push(`class-${g}-a`);
        classIds.push(`class-${g}-b`);
      }
    }
    miscWrites.push({ path: `teacher_subjects/${t.id}`, data: { teacher_id: t.id, subjects: t.subjects.map(s => subjects.find(sub => sub.name === s)?.id || 'sub-math'), class_ids: classIds, updated_at: now() } });
  }
  await batchWrite(miscWrites);
  console.log('✓ Subjects (13), classes (21), teacher mappings');

  // ── STUDENT PROFILES + ENROLLMENTS ───────────────────────────────────────
  const profileWrites = [];
  for (const s of students) {
    profileWrites.push({ path: `student_profiles/${s.id}`, data: { id: s.id, user_id: s.id, name: s.name, class: s.class, class_id: s.class_id, grade: s.class.split('-')[0], section: s.class.split('-')[1], roll_number: s.id.split('-')[1].padStart(2,'0'), subjects: ['Mathematics','English','Hindi','Science','Social Studies','Physics','Chemistry','Biology','Computer Science'], attendance_percent: 88, xp: 0, level: 1, badges: [], created_at: now(), updated_at: now() } });
    profileWrites.push({ path: `classroom_students/${s.id}-${s.class_id}`, data: { id: `${s.id}-${s.class_id}`, classroom_id: s.class_id, student_id: s.id, enrolled_at: now() } });
  }
  await batchWrite(profileWrites);
  console.log('✓ Student profiles + enrollments');

  // ── TIMETABLE (flat entries — matches frontend normalizeTimetableResponse) ──
  const allClassIds = ['class-6-a', 'class-6-b', 'class-7-a', 'class-7-b', 'class-8-a', 'class-8-b', 'class-9-a', 'class-9-b', 'class-10-a', 'class-10-b', 'class-10-c', 'class-11-a', 'class-11-b', 'class-12-a', 'class-12-b'];
  const ttWrites = [];
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const BREAK_PERIODS = [4, 8]; // periods 4=break, 8=lunch
  for (const cid of allClassIds) {
    const flatEntries = [];
    for (let d = 0; d < 5; d++) {
      const row = scheduleRows[d];
      for (let p = 0; p < 8; p++) {
        const subjId = row[p];
        const subj = subjId ? subjects.find(s => s.id === subjId) : null;
        const tm = subj ? teachers.find(t => t.subjects.includes(subj.name)) : null;
        flatEntries.push({
          classId: cid,
          day: DAYS[d],
          period: String(p + 1),
          subject: subj?.name || '',
          subject_id: subjId || null,
          teacherId: tm?.id || '',
          room: p === 3 ? 'Room 101' : p === 5 ? 'Lab 1' : p === 7 ? 'Gym' : `Room ${101 + p}`,
          startTime: periodTimings[p].start,
          endTime: periodTimings[p].end,
          isBreak: !subjId,
        });
      }
    }
    ttWrites.push({ path: `timetables/${cid}`, data: { id: cid, classId: cid, entries: flatEntries, updated_at: now() } });
  }
  await batchWrite(ttWrites);
  console.log('✓ Timetable: flat entries for class-10-a');

  // ── ATTENDANCE (120 days) ────────────────────────────────────────────────
  const attWrites = [];
  for (const dayDate of days) {
    const dateStr = dayDate.toISOString().split('T')[0];
    for (const s of students) {
      const r = seededRand(parseInt(s.id.split('-')[1]) * 1000 + parseInt(dateStr.replace(/-/g,'')) % 10000);
      const status = r() > 0.18 ? 'present' : r() > 0.05 ? 'late' : 'absent';
      attWrites.push({ path: `attendance_records/att-${s.id}-${dateStr}`, data: { id: `att-${s.id}-${dateStr}`, student_id: s.id, class_id: s.class_id, date: dateStr, status, teacher_id: 'teacher-1', created_at: now(), updated_at: now() } });
    }
  }
  await batchWrite(attWrites);
  console.log(`✓ Attendance: ${attWrites.length} records`);

  // ── XP PROGRESSION (120 days) ─────────────────────────────────────────────
  const xpWrites = [];
  const xpProgression = {};
  for (const s of students) xpProgression[s.id] = 0;
  for (const dayDate of days) {
    const dateStr = dayDate.toISOString().split('T')[0];
    for (const s of students) {
      const r = seededRand(parseInt(s.id.split('-')[1]) * 300 + parseInt(dateStr.replace(/-/g,'')) % 3000);
      if (r() > 0.18) {
        const hours = Math.floor(r() * 3 + 2);
        const xpGained = hours * 10 + Math.floor(r() * 20 + 5);
        xpProgression[s.id] += xpGained;
        xpWrites.push({ path: `xp_progression/${s.id}/${dateStr}`, data: { date: dateStr, xp_gained: xpGained, total_xp: xpProgression[s.id], level: xpToLevel(xpProgression[s.id]), hours_studied: hours } });
      }
    }
  }
  await batchWrite(xpWrites);
  console.log(`✓ XP progression: ${xpWrites.length} daily logs`);

  // Update student profiles with final XP/level
  const xpProfileWrites = [];
  for (const s of students) {
    xpProfileWrites.push({ path: `student_profiles/${s.id}`, data: { xp: xpProgression[s.id], level: xpToLevel(xpProgression[s.id]), badges: xpProgression[s.id] > 500 ? ['badge-early-bird','badge-streak-7'] : ['badge-early-bird'], updated_at: now() } });
  }
  await batchWrite(xpProfileWrites);
  console.log('✓ XP/level updated on profiles');

  // ── MARKS ─────────────────────────────────────────────────────────────────
  const markWrites = [];
  const titles = ['Lab Report','Chapter Test','Essay','Project','Quiz','Worksheet'];
  for (let i = 0; i < days.length; i += 4) {
    const dayDate = days[i];
    const dateStr = dayDate.toISOString().split('T')[0];
    for (const s of students) {
      const r = seededRand(parseInt(s.id.split('-')[1]) * 200 + i * 3);
      for (let m = 0; m < 2; m++) {
        const subj = subjects[Math.floor(r() * subjects.length)];
        const maxMarks = 100;
        const obtained = Math.floor(r() * maxMarks * 0.4 + maxMarks * 0.5);
        markWrites.push({ path: `marks/mark-${s.id}-${i}-${m}`, data: { id: `mark-${s.id}-${i}-${m}`, student_id: s.id, class_id: s.class_id, subject_id: subj.id, subject_name: subj.name, score: obtained, obtained_marks: obtained, maxMarks: maxMarks, max_marks: maxMarks, type: 'assignment', title: `${subj.name} ${titles[Math.floor(r() * titles.length)]}`, date: dateStr, created_at: now(), updated_at: now() } });
      }
    }
  }
  await batchWrite(markWrites);
  console.log(`✓ Marks: ${markWrites.length} records`);

  // ── ASSIGNMENTS (30 for EACH CLASS: class-10-a AND class-10-b ───────────────
  const assignTitles = [
    'Linear Equations Practice Set','Motion and Force Worksheet','Chemical Reactions Lab Report',
    'English Essay: My Favorite Memory','History Map Work Assignment','Physics Numerical Problems',
    'Biology Diagram Labeling Test','Hindi Grammar Exercises','Social Studies Project Report',
    'Computer Science Coding Challenge','Geometry Construction Homework','Human Body Systems Quiz',
    'Revolutions in Europe Notes','Trigonometry Practice Problems','Periodic Table Memory Test',
    'English Comprehension Passage','Geography Climate Report','Organic Chemistry Basics',
    'Linear Programming Assignment','Sound Waves Experiment Log','Cell Division Diagram Test',
    'Hindi Composition Writing','Democratic Rights Chapter Notes','Electrostatics Numericals',
    'Ecosystem Project Work','Algebraic Expressions Set','Inertia and Momentum Lab',
    'Nutrition in Humans Assignment','Civics Essay: Rights and Duties','Geometry Proofs Homework',
  ];
  const assignSubjects = ['Mathematics','Physics','Chemistry','English','History','Biology','Hindi','Social Studies','Computer Science'];
  const classesToSeed = ['class-6-a', 'class-6-b', 'class-7-a', 'class-7-b', 'class-8-a', 'class-8-b', 'class-9-a', 'class-9-b', 'class-10-a', 'class-10-b', 'class-10-c', 'class-11-a', 'class-11-b', 'class-12-a', 'class-12-b'];
  const assignmentWrites = [];
  let assignCounter = 1;
  for (const classId of classesToSeed) {
    const className = classId.replace('class-', '').replace('-', '-').toUpperCase();
    for (let i = 0; i < 30; i++) {
      const dueDays = 2 + (i % 14);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 60 + i * 4);
      const dueStr = dueDate.toISOString().split('T')[0];
      const createdDate = new Date(dueDate);
      createdDate.setDate(createdDate.getDate() - 7);
      const subj = assignSubjects[i % assignSubjects.length];
      const teacher = teachers.find(t => t.subjects.includes(subj)) || teachers[0];
      assignmentWrites.push({
        path: `assignments/assign-${assignCounter}`,
        data: {
          id: `assign-${assignCounter}`,
          title: assignTitles[i],
          description: `Complete the ${assignTitles[i]}. Submit before the due date.`,
          subject: subj,
          subject_id: subjects.find(s => s.name === subj)?.id || '',
          class_id: classId,
          class: className,
          teacher_id: teacher.id,
          teacher_name: teacher.name,
          due_date: dueStr,
          due_time: '23:59',
          total_marks: 30,
          status: new Date(dueStr) < new Date() ? 'closed' : 'active',
          type: ['homework','project','lab','test'][i % 4],
          created_at: createdDate.toISOString(),
          updated_at: now(),
        },
      });
      assignCounter++;
    }
  }
  await batchWrite(assignmentWrites);
  console.log(`✓ Assignments: ${assignmentWrites.length} records`);

  // ── SUBMISSIONS (60% submitted, 40% pending) ───────────────────────────────
  const submissionWrites = [];
  for (const s of students) {
    const studentClassAssignments = assignmentWrites.filter(a => a.data.class_id === s.class_id);
    const submitted = studentClassAssignments.slice(0, 18); // first 18 for student's class
    for (const a of submitted) {
      const r = seededRand(parseInt(s.id.split('-')[1]) * 1000 + parseInt(a.path.split('-')[1]));
      if (r() < 0.85) { // 85% of assigned submissions
        const subDate = new Date(a.data.due_date);
        subDate.setDate(subDate.getDate() - Math.floor(r() * 3));
        const isLate = subDate > new Date(a.data.due_date);
        const marks = isLate ? null : Math.floor(r() * 20 + 10); // 10-30 marks if on time
        submissionWrites.push({
          path: `submissions/sub-${s.id}-${a.data.id}`,
          data: {
            id: `sub-${s.id}-${a.data.id}`,
            assignment_id: a.data.id,
            student_id: s.id,
            submitted_at: subDate.toISOString(),
            is_late: isLate,
            marks_obtained: marks,
            feedback: marks !== null ? (marks >= 25 ? 'Excellent work!' : marks >= 20 ? 'Good effort, well done.' : 'Keep improving!') : null,
            created_at: subDate.toISOString(),
          },
        });
      }
    }
  }
  await batchWrite(submissionWrites);
  console.log(`✓ Submissions: ${submissionWrites.length} records`);

  // ── STUDY ACTIVITY ─────────────────────────────────────────────────────────
  const studyWrites = [];
  for (const s of students) {
    const totalHours = Math.floor(xpProgression[s.id] / 10 + 30);
    const streakDays = Math.floor(xpProgression[s.id] / 50);
    studyWrites.push({ path: `study_activity/${s.id}`, data: { student_id: s.id, total_hours: totalHours, assignments_completed: Math.floor(totalHours / 3), tests_taken: Math.floor(totalHours / 5), streak_days: Math.min(streakDays, 45), last_active: days[days.length - 1].toISOString().split('T')[0], subject_hours: { Mathematics: Math.floor(totalHours * 0.25), English: Math.floor(totalHours * 0.2), Hindi: Math.floor(totalHours * 0.15), Science: Math.floor(totalHours * 0.15), 'Social Studies': Math.floor(totalHours * 0.1), Physics: Math.floor(totalHours * 0.08), Chemistry: Math.floor(totalHours * 0.05), Biology: Math.floor(totalHours * 0.05), 'Computer Science': Math.floor(totalHours * 0.05) }, weekly_progress: [{ week:'W1',hours:7},{week:'W2',hours:9},{week:'W3',hours:6},{week:'W4',hours:11},{week:'W5',hours:8}], updated_at: now() } });
  }
  await batchWrite(studyWrites);
  console.log('✓ Study activity');

  // ── LEADERBOARD ─────────────────────────────────────────────────────────────
  const sorted = [...students].sort((a, b) => (xpProgression[b.id]||0) - (xpProgression[a.id]||0));
  const lbWrites = [];
  sorted.forEach((s, idx) => {
    const xp = xpProgression[s.id] || 0;
    const level = xpToLevel(xp);
    lbWrites.push({ path: `leaderboard/${s.id}`, data: { rank: idx + 1, student_id: s.id, name: s.name, class: s.class, xp, level, streak_days: Math.min(Math.floor(xp / 50), 45), total_hours: Math.floor(xp / 10 + 30), assignments_completed: Math.floor(Math.floor(xp / 10 + 30) / 3), badges: xp > 500 ? ['badge-early-bird','badge-streak-7'] : ['badge-early-bird'], updated_at: now() } });
  });
  await batchWrite(lbWrites);
  console.log('✓ Leaderboard ranked by XP');

  // ── BADGES ─────────────────────────────────────────────────────────────────
  const badgeWrites = [];
  const badges = [
    { id:'badge-streak-7', name:'7-Day Streak', icon:'fire', description:'Studied 7 days in a row' },
    { id:'badge-streak-30', name:'30-Day Streak', icon:'flame', description:'Studied 30 days in a row' },
    { id:'badge-top-scorer', name:'Top Scorer', icon:'trophy', description:'Highest marks in class' },
    { id:'badge-early-bird', name:'Early Bird', icon:'sun', description:'Attended 50+ days on time' },
    { id:'badge-assignment-king', name:'Assignment King', icon:'star', description:'Completed 20+ assignments' },
    { id:'badge-perfect-attendance', name:'Perfect Attendance', icon:'check', description:'100% attendance for a month' },
    { id:'badge-bookworm', name:'Bookworm', icon:'book', description:'Read 50+ hours of study material' },
    { id:'badge-test-master', name:'Test Master', icon:'brain', description:'Top scorer in 10+ tests' },
  ];
  for (const b of badges) badgeWrites.push({ path: `badges/${b.id}`, data: { ...b, created_at: now() } });
  await batchWrite(badgeWrites);
  console.log('✓ 8 badge templates');

  // ── 50 ANNOUNCEMENTS ───────────────────────────────────────────────────────
  const annWrites = [];
  const annTitles = [
    'Mid-Term Examination Schedule Released','Annual Sports Day - Registrations Open','Chemistry Lab Safety Guidelines Updated',
    'Fee Payment Reminder - Final Due Date','Physics Assignment Due - Motion Lab Report','Mathematics Quiz Tomorrow - Chapter 5',
    'School Holiday - Independence Day','English Essay Submission Reminder','Chemistry Practical Exam Date Set',
    'Computer Science Workshop Registration','Biology Field Trip to Botanical Garden','Mathematics Assignment - Linear Equations',
    'Annual Day Rehearsal Schedule','Physics Test Results Released','Library Hours Extended During Exams',
    'History Project Submission','Class Toppers Felicitation Ceremony','Bus Route Timings Updated',
    'Urgent: Chemistry Lab Safety Incident','PTM Date Announced - May 28th','Yoga Workshop Registration',
    'Geography Assignment - Climate Report','Mathematics Chapter Test - May 20th','School Magazine Submission Open',
    'Health Camp - Eye and Dental Checkup','Physics Assignment Due - Optics Lab','Computer Lab Upgradation Complete',
    'English Grammar Workshop','Scholarship Applications Open','Mandatory Assembly - Monday',
    'Physics Olympiad Registration','Biology Diagrams Assignment','Diwali Holiday Announcement',
    'Mathematics Remedial Classes','Fire Drill Scheduled','Chemistry Mole Concept Test',
    'Student Council Elections','Science Exhibition Entries Invited','English Speaking Competition',
    'Attendance Shortfall Warning','Geography Map Work Submission','Physics Periodic Motion Assignment',
    'School Uniform Guidelines Updated','Art and Craft Exhibition','Mathematics Model Paper Released',
    'History Source Analysis Assignment','Water Conservation Drive','Class Photo Day - May 29th',
    'Chemistry IUPAC Nomenclature Test','Semester Fee Payment Window Closing',
  ];
  const categories = ['exam','event','academic','administrative','urgent','reminder','holiday','health'];
  for (let i = 0; i < 100; i++) {
    const d = new Date(days[Math.min(i, days.length - 1)]);
    d.setDate(d.getDate() - Math.floor(i * 1.2));
    const title = annTitles[i % annTitles.length] + (i >= annTitles.length ? ` (Update ${Math.floor(i/annTitles.length) + 1})` : '');
    annWrites.push({ path: `announcements/ann-${i+1}`, data: { id:`ann-${i+1}`, title: title, body:`Details for: ${title}. Please check the school portal for complete information.`, category: categories[i % categories.length], scope:'all', class_id:null, created_by: i%2===0?'admin-1':`teacher-${(i % teachers.length) + 1}`, pinned: i < 5, priority: ['high','medium','low'][i%3], created_at: d.toISOString(), updated_at: now() } });
  }
  await batchWrite(annWrites);
  console.log('✓ 100 announcements');

  // ── GOALS + NOTIFICATIONS ──────────────────────────────────────────────────
  const misc2Writes = [];
  for (const s of students) {
    const xp = xpProgression[s.id] || 0;
    misc2Writes.push({ path: `goals/goal-${s.id}-1`, data: { id:`goal-${s.id}-1`, student_id:s.id, subject:'Mathematics', target:90, current: Math.floor(xp/25+50), progress: Math.floor(Math.random()*20+75), created_at:now() } });
    misc2Writes.push({ path: `goals/goal-${s.id}-2`, data: { id:`goal-${s.id}-2`, student_id:s.id, subject:'Physics', target:85, current: Math.floor(xp/30+45), progress: Math.floor(Math.random()*15+80), created_at:now() } });
  }
  const notifMsgs = [
    'Your Physics assignment has been graded - 28/30','New announcement: Annual Sports Day',
    'Reminder: Mathematics assignment due in 2 days','Congratulations! You earned the "Top Scorer" badge',
    'Your essay has been submitted successfully','New homework posted: Chapter 5 exercises',
    'Your Chemistry lab report has been graded - 95/100','Important: Mid-term exams schedule released',
    'Your Mathematics quiz results are out - 88/100','Reminder: Submit your English essay by Friday',
    'You have been promoted to Level 5!','New study material uploaded for Physics',
    'Your attendance this month is 95%','Parent-Teacher meeting scheduled for next week',
  ];
  // Create more notifications for multiple students
  let notifIdx = 1;
  for (let sIdx = 0; sIdx < Math.min(20, students.length); sIdx++) {
    const s = students[sIdx];
    for (let i = 0; i < 5; i++) {
      const d = new Date(); d.setHours(d.getHours() - (sIdx * 24 + i * 6));
      const msgIdx = (sIdx + i) % notifMsgs.length;
      misc2Writes.push({ path: `notifications/notif-${notifIdx}`, data: { id:`notif-${notifIdx}`, userId:s.id, message:notifMsgs[msgIdx], type:['grade','announcement','reminder','achievement','submission','homework'][msgIdx % 6], read: i > 2, createdAt: d.toISOString() } });
      notifIdx++;
    }
  }
  await batchWrite(misc2Writes);
  console.log('✓ Goals + notifications');

  console.log('\n✅ Firebase seed complete!');
  console.log(`  • ${students.length + teachers.length + 12} users (all roles)`);
  console.log('  • 13 subjects, 21 classes, teacher-subject mappings');
  console.log(`  • ${students.length} students with 120 days of attendance, XP, marks, study activity`);
  console.log('  • XP progression daily logs (all 120 days)');
  console.log('  • Leaderboard ranked by XP');
  console.log('  • 8 badges');
  console.log('  • Timetable (15 classes × 5 days × 8 periods)');
  console.log('  • 100 announcements, goals, notifications');
  console.log('\n✅ MASSIVE Firebase seed complete!');

  // Mark as done
  await db.ref(SEED_FLAG_PATH).set(SEED_VERSION);
}

export { seedFirebaseData };