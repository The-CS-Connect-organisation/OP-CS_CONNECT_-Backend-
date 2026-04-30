import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const hash = (pw) => bcrypt.hashSync(pw, 10);

const seed = async () => {
  console.log('🚀 Seeding Cornerstone School data...\n');

  // ── Clear old data ──
  console.log('🧹 Clearing old data...');
  const tables = [
    'semester_performance','submissions','attendance_records','marks','messages',
    'announcements','timetables','exam_schedules','assignments',
    'classroom_students','classroom_teachers',
    'student_profiles','teacher_profiles','parent_profiles','ai_interactions',
    'classrooms','users',
  ];
  for (const t of tables) {
    await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  // ═══════════════════════════════════════════
  // 1. USERS
  // ═══════════════════════════════════════════
  console.log('👥 Creating users...');

  const { data: admins } = await supabase.from('users').insert([
    { name: 'Alicia Morgan',       email: 'admin@schoolsync.edu',  password_hash: hash('admin123'),   role: 'admin',  is_active: true },
    { name: 'Rahul Venkataraman',  email: 'admin2@schoolsync.edu', password_hash: hash('admin123'),   role: 'admin',  is_active: true },
    { name: 'Neha Kapoor',         email: 'admin3@schoolsync.edu', password_hash: hash('admin123'),   role: 'admin',  is_active: true },
  ]).select();

  const teacherRows = [
    { name: 'James Anderson',  email: 'james@schoolsync.edu',    subjects: ['Mathematics', 'Statistics'] },
    { name: 'Emily Chen',      email: 'teacher2@schoolsync.edu', subjects: ['English Literature'] },
    { name: 'Arjun Mehta',     email: 'teacher3@schoolsync.edu', subjects: ['Physics'] },
    { name: 'Sara Iqbal',      email: 'teacher4@schoolsync.edu', subjects: ['Chemistry'] },
    { name: 'David Roy',       email: 'teacher5@schoolsync.edu', subjects: ['Computer Science'] },
    { name: 'Priyanka Menon',  email: 'teacher6@schoolsync.edu', subjects: ['Biology'] },
    { name: 'Rajesh Kumar',    email: 'teacher7@schoolsync.edu', subjects: ['History', 'Civics'] },
    { name: 'Priya Sharma',    email: 'teacher8@schoolsync.edu', subjects: ['Geography'] },
    { name: 'Vikram Nair',     email: 'teacher9@schoolsync.edu', subjects: ['Hindi'] },
    { name: 'Ananya Bose',     email: 'teacher10@schoolsync.edu',subjects: ['Physical Education'] },
  ];
  const { data: teachers } = await supabase.from('users').insert(
    teacherRows.map(t => ({ name: t.name, email: t.email, password_hash: hash('teacher123'), role: 'teacher', is_active: true }))
  ).select();

  const studentRows = [
    { name: 'Aarav Menon',      email: 'alex@schoolsync.edu',     cls: 0 },
    { name: 'Ishita Kapoor',    email: 'student2@schoolsync.edu', cls: 0 },
    { name: 'Vivaan Joshi',     email: 'student3@schoolsync.edu', cls: 0 },
    { name: 'Diya Malhotra',    email: 'student4@schoolsync.edu', cls: 0 },
    { name: 'Aditya Rao',       email: 'student5@schoolsync.edu', cls: 0 },
    { name: 'Kavya Reddy',      email: 'student6@schoolsync.edu', cls: 1 },
    { name: 'Rohan Gupta',      email: 'student7@schoolsync.edu', cls: 1 },
    { name: 'Ananya Singh',     email: 'student8@schoolsync.edu', cls: 1 },
    { name: 'Aryan Patel',      email: 'student9@schoolsync.edu', cls: 1 },
    { name: 'Meera Iyer',       email: 'student10@schoolsync.edu',cls: 1 },
    { name: 'Siddharth Nair',   email: 'student11@schoolsync.edu',cls: 2 },
    { name: 'Pooja Verma',      email: 'student12@schoolsync.edu',cls: 2 },
    { name: 'Karan Sharma',     email: 'student13@schoolsync.edu',cls: 2 },
    { name: 'Riya Desai',       email: 'student14@schoolsync.edu',cls: 2 },
    { name: 'Nikhil Bhat',      email: 'student15@schoolsync.edu',cls: 2 },
    { name: 'Tanvi Kulkarni',   email: 'student16@schoolsync.edu',cls: 3 },
    { name: 'Harsh Agarwal',    email: 'student17@schoolsync.edu',cls: 3 },
    { name: 'Sneha Pillai',     email: 'student18@schoolsync.edu',cls: 3 },
    { name: 'Rahul Mishra',     email: 'student19@schoolsync.edu',cls: 3 },
    { name: 'Prachi Jain',      email: 'student20@schoolsync.edu',cls: 3 },
  ];
  const { data: students } = await supabase.from('users').insert(
    studentRows.map(s => ({ name: s.name, email: s.email, password_hash: hash('student123'), role: 'student', is_active: true }))
  ).select();

  const parentNames = [
    'Priya Menon','Sunita Kapoor','Ramesh Joshi','Anita Malhotra','Suresh Rao',
    'Lakshmi Reddy','Vijay Gupta','Rekha Singh','Mohan Patel','Usha Iyer',
    'Ganesh Nair','Savita Verma','Deepak Sharma','Nirmala Desai','Sunil Bhat',
    'Kavitha Kulkarni','Rajiv Agarwal','Meena Pillai','Ashok Mishra','Geeta Jain',
  ];
  const { data: parents } = await supabase.from('users').insert(
    parentNames.map((name, i) => ({ name, email: `parent${i + 1}@schoolsync.edu`, password_hash: hash('parent123'), role: 'parent', is_active: true }))
  ).select();

  const { data: drivers } = await supabase.from('users').insert([
    { name: 'Rajesh Kumar',  email: 'driver@schoolsync.edu',  password_hash: hash('driver123'), role: 'driver', is_active: true },
    { name: 'Suresh Patel',  email: 'driver2@schoolsync.edu', password_hash: hash('driver123'), role: 'driver', is_active: true },
    { name: 'Mohan Singh',   email: 'driver3@schoolsync.edu', password_hash: hash('driver123'), role: 'driver', is_active: true },
  ]).select();

  console.log(`   ✓ ${admins.length} admins, ${teachers.length} teachers, ${students.length} students, ${parents.length} parents, ${drivers.length} drivers`);

  // ═══════════════════════════════════════════
  // 2. CLASSROOMS
  // ═══════════════════════════════════════════
  console.log('🏫 Creating classrooms...');
  const { data: classes } = await supabase.from('classrooms').insert([
    { name: 'Grade 10-A', grade: '10', section: 'A' },
    { name: 'Grade 10-B', grade: '10', section: 'B' },
    { name: 'Grade 11-A', grade: '11', section: 'A' },
    { name: 'Grade 11-B', grade: '11', section: 'B' },
  ]).select();
  console.log(`   ✓ ${classes.length} classrooms`);

  // Junction tables
  await supabase.from('classroom_students').insert(
    students.map((s, i) => ({ classroom_id: classes[studentRows[i].cls].id, student_id: s.id }))
  );
  const ctRows = [];
  teachers.forEach((t, i) => {
    ctRows.push({ classroom_id: classes[i % 4].id, teacher_id: t.id });
    ctRows.push({ classroom_id: classes[(i + 1) % 4].id, teacher_id: t.id });
  });
  const ctUnique = [...new Map(ctRows.map(r => [`${r.classroom_id}-${r.teacher_id}`, r])).values()];
  await supabase.from('classroom_teachers').insert(ctUnique);

  // ═══════════════════════════════════════════
  // 3. PROFILES
  // ═══════════════════════════════════════════
  console.log('📋 Creating profiles...');
  const attBand = [97,95,93,91,88,86,84,82,80,78,76,74,90,87,85,83,79,77,92,89];
  const xpBand  = [980,920,870,840,810,780,750,720,690,660,630,600,570,540,510,480,450,420,390,360];

  await supabase.from('student_profiles').insert(
    students.map((s, i) => {
      const cls = classes[studentRows[i].cls];
      return {
        user_id: s.id,
        grade: cls.grade,
        section: cls.section,
        roll_number: `${cls.grade}${cls.section}-${String(i + 1).padStart(3, '0')}`,
        subjects: ['Mathematics','Physics','English','Chemistry','Computer Science','Biology'],
        attendance_percent: attBand[i],
        parent_name: parents[i]?.name || null,
        parent_phone: `+91-90${String(1000000 + i).padStart(7, '0')}`,
        xp: xpBand[i],
        badges: attBand[i] >= 90 ? ['Punctual','Consistent','Top Performer'] : attBand[i] >= 80 ? ['Consistent','Active'] : ['Needs Support'],
        attendance_streak: Math.max(0, Math.floor(attBand[i] / 10) - 5),
      };
    })
  );

  await supabase.from('teacher_profiles').insert(
    teachers.map((t, i) => ({
      user_id: t.id,
      subjects: teacherRows[i].subjects,
      phone: `+91-98${String(7654300 + i).padStart(7, '0')}`,
    }))
  );

  await supabase.from('parent_profiles').insert(
    parents.map((p, i) => ({
      user_id: p.id,
      child_ids: students[i] ? [students[i].id] : [],
      phone: `+91-90${String(1000000 + i).padStart(7, '0')}`,
    }))
  );

  await supabase.from('driver_profiles').insert(
    drivers.map((d, i) => ({
      user_id: d.id,
      bus_number: `BUS-${String(i + 1).padStart(3, '0')}`,
      license_plate: `DL-01-${String.fromCharCode(65 + i)}-${String(1234 + i * 1000).padStart(4, '0')}`,
      phone: `+91-94${String(4000000 + i).padStart(7, '0')}`,
      route_id: `route-${i + 1}`,
    }))
  );
  console.log('   ✓ All profiles created');

  // ═══════════════════════════════════════════
  // 4. TIMETABLES
  // ═══════════════════════════════════════════
  console.log('📅 Creating timetables...');
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
  const subjectPool = ['Mathematics','Physics','English','Chemistry','Computer Science','Biology','History','Geography'];
  const rooms = ['101','102','103','104','Lab-A','Lab-B','201','202'];

  const timetableEntries = (classIdx) => days.map((day, di) => ({
    day,
    slots: [
      { time: '08:00 - 08:45', subject: subjectPool[(classIdx + di) % subjectPool.length],     teacher: teacherRows[(classIdx + di) % teachers.length].name,     room: rooms[(classIdx + di) % rooms.length] },
      { time: '08:50 - 09:35', subject: subjectPool[(classIdx + di + 1) % subjectPool.length], teacher: teacherRows[(classIdx + di + 1) % teachers.length].name, room: rooms[(classIdx + di + 1) % rooms.length] },
      { time: '09:40 - 10:25', subject: subjectPool[(classIdx + di + 2) % subjectPool.length], teacher: teacherRows[(classIdx + di + 2) % teachers.length].name, room: rooms[(classIdx + di + 2) % rooms.length] },
      { time: '10:40 - 11:25', subject: subjectPool[(classIdx + di + 3) % subjectPool.length], teacher: teacherRows[(classIdx + di + 3) % teachers.length].name, room: rooms[(classIdx + di + 3) % rooms.length] },
      { time: '11:30 - 12:15', subject: subjectPool[(classIdx + di + 4) % subjectPool.length], teacher: teacherRows[(classIdx + di + 4) % teachers.length].name, room: rooms[(classIdx + di + 4) % rooms.length] },
      { time: '13:00 - 13:45', subject: subjectPool[(classIdx + di + 5) % subjectPool.length], teacher: teacherRows[(classIdx + di + 5) % teachers.length].name, room: rooms[(classIdx + di + 5) % rooms.length] },
      { time: '13:50 - 14:35', subject: subjectPool[(classIdx + di + 6) % subjectPool.length], teacher: teacherRows[(classIdx + di + 6) % teachers.length].name, room: rooms[(classIdx + di + 6) % rooms.length] },
    ],
  }));

  await supabase.from('timetables').insert(
    classes.map((cls, i) => ({ class_id: cls.id, entries: timetableEntries(i) }))
  );
  console.log('   ✓ Timetables created for all 4 classes');

  // ═══════════════════════════════════════════
  // 5. ASSIGNMENTS (3 per class = 12 total)
  // ═══════════════════════════════════════════
  console.log('📝 Creating assignments...');
  const assignmentTemplates = [
    { title: 'Algebra & Data Interpretation Worksheet',  subject: 'Mathematics',      desc: 'Solve 20 problems covering quadratic equations, data tables, and graph interpretation.', marks: 100 },
    { title: 'Physics Lab Report — Optics',              subject: 'Physics',           desc: 'Document your observations from the lens experiment. Include ray diagrams and error analysis.', marks: 100 },
    { title: 'English Essay — Climate Change',           subject: 'English',           desc: 'Write a 600-word argumentative essay on the impact of climate change on developing nations.', marks: 50 },
    { title: 'Organic Chemistry Reactions',              subject: 'Chemistry',         desc: 'Complete the reaction mechanism worksheet covering substitution and elimination reactions.', marks: 80 },
    { title: 'Python Programming Assignment',            subject: 'Computer Science',  desc: 'Build a simple student grade calculator using Python. Submit .py file and output screenshots.', marks: 100 },
    { title: 'Cell Biology Diagram & Notes',             subject: 'Biology',           desc: 'Draw and label a detailed plant cell and animal cell. Include functions of each organelle.', marks: 60 },
  ];

  const assignmentData = classes.flatMap((cls, ci) =>
    assignmentTemplates.slice(0, 3).map((tmpl, ti) => ({
      title: `${cls.name} — ${tmpl.title}`,
      description: tmpl.desc,
      subject: tmpl.subject,
      class_id: cls.id,
      teacher_id: teachers[(ci + ti) % teachers.length].id,
      due_date: new Date(Date.now() + (ci * 2 + ti + 3) * 86400000).toISOString(),
      max_marks: tmpl.marks,
    }))
  );
  const { data: assignments } = await supabase.from('assignments').insert(assignmentData).select();
  console.log(`   ✓ ${assignments.length} assignments`);

  // ═══════════════════════════════════════════
  // 6. SUBMISSIONS (most students submitted)
  // ═══════════════════════════════════════════
  console.log('📤 Creating submissions...');
  const submissionRows = [];
  students.forEach((student, si) => {
    const clsIdx = studentRows[si].cls;
    const clsAssignments = assignments.filter(a => a.class_id === classes[clsIdx].id);
    clsAssignments.forEach((asgn, ai) => {
      if ((si + ai) % 5 !== 0) { // ~80% submission rate
        const daysAgo = Math.floor(Math.random() * 5) + 1;
        submissionRows.push({
          assignment_id: asgn.id,
          student_id: student.id,
          submitted_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
          is_late: daysAgo === 1 && ai % 3 === 0,
          content: `Submission by ${studentRows[si].name} for ${asgn.subject}.`,
          marks: 50 + ((si * 7 + ai * 13) % 45),
          feedback: ['Excellent work! Very detailed.','Good attempt. Improve structure.','Needs more examples.','Well done, keep it up!','Average. Revise concepts.'][(si + ai) % 5],
          graded_at: new Date(Date.now() - (daysAgo - 1) * 86400000).toISOString(),
        });
      }
    });
  });
  for (let i = 0; i < submissionRows.length; i += 100) {
    await supabase.from('submissions').insert(submissionRows.slice(i, i + 100));
  }
  console.log(`   ✓ ${submissionRows.length} submissions`);

  // ═══════════════════════════════════════════
  // 7. MARKS — 3 terms × 6 subjects × 20 students
  // ═══════════════════════════════════════════
  console.log('📊 Creating marks...');
  const terms = [
    { term: 'Cycle Test 1',  exam_type: 'unit_test', daysAgo: 120 },
    { term: 'Mid Term',      exam_type: 'mid_term',  daysAgo: 90  },
    { term: 'Cycle Test 2',  exam_type: 'unit_test', daysAgo: 60  },
    { term: 'Term Final',    exam_type: 'final',     daysAgo: 30  },
    { term: 'Cycle Test 3',  exam_type: 'unit_test', daysAgo: 14  },
    { term: 'Pre-Board',     exam_type: 'mid_term',  daysAgo: 5   },
  ];
  const markSubjects = ['Mathematics','Physics','English','Chemistry','Computer Science','Biology'];
  const scoreBase = [72,68,75,65,80,70];

  const markRows = students.flatMap((student, si) => {
    const cls = classes[studentRows[si].cls];
    return terms.flatMap((term, ti) =>
      markSubjects.map((subject, subi) => ({
        student_id: student.id,
        class_id: cls.id,
        subject,
        exam_type: term.exam_type,
        score: Math.min(100, Math.max(35, scoreBase[subi] + (si % 5) * 3 - (ti % 3) * 2 + (subi % 4) * 2)),
        term: term.term,
      }))
    );
  });
  for (let i = 0; i < markRows.length; i += 200) {
    await supabase.from('marks').insert(markRows.slice(i, i + 200));
  }
  console.log(`   ✓ ${markRows.length} marks records`);

  // ═══════════════════════════════════════════
  // 8. SEMESTER PERFORMANCE
  // ═══════════════════════════════════════════
  console.log('📈 Creating semester performance...');
  const { data: spProfiles } = await supabase.from('student_profiles').select('id, user_id');
  const spRows = spProfiles.flatMap((sp, i) => [
    { student_profile_id: sp.id, semester: 'Semester 1 (2024-25)', percentage: 68 + (i % 20), grade: i % 20 >= 15 ? 'A+' : i % 20 >= 10 ? 'A' : i % 20 >= 5 ? 'B+' : 'B' },
    { student_profile_id: sp.id, semester: 'Semester 2 (2024-25)', percentage: 71 + (i % 22), grade: i % 22 >= 16 ? 'A+' : i % 22 >= 11 ? 'A' : i % 22 >= 6 ? 'B+' : 'B' },
    { student_profile_id: sp.id, semester: 'Semester 1 (2025-26)', percentage: 74 + (i % 18), grade: i % 18 >= 14 ? 'A+' : i % 18 >= 9 ? 'A' : i % 18 >= 4 ? 'B+' : 'B' },
  ]);
  await supabase.from('semester_performance').insert(spRows);
  console.log(`   ✓ ${spRows.length} semester performance records`);

  // ═══════════════════════════════════════════
  // 9. ATTENDANCE — 120 days of history (Mon-Fri only)
  // ═══════════════════════════════════════════
  console.log('📅 Creating attendance records (120 days)...');
  const attendanceRows = [];
  for (let day = 0; day < 120; day++) {
    const dateObj = new Date(Date.now() - day * 86400000);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) continue;
    const date = dateObj.toISOString().split('T')[0];
    students.forEach((student, si) => {
      const cls = classes[studentRows[si].cls];
      const teacher = teachers[si % teachers.length];
      const roll = (si + day) % 20;
      const status = roll < 14 ? 'present' : roll < 17 ? 'late' : 'absent';
      attendanceRows.push({ class_id: cls.id, student_id: student.id, teacher_id: teacher.id, date, status });
    });
  }
  for (let i = 0; i < attendanceRows.length; i += 200) {
    await supabase.from('attendance_records').insert(attendanceRows.slice(i, i + 200));
  }
  console.log(`   ✓ ${attendanceRows.length} attendance records`);

  // ═══════════════════════════════════════════
  // 10. ANNOUNCEMENTS
  // ═══════════════════════════════════════════
  console.log('📢 Creating announcements...');
  await supabase.from('announcements').insert([
    { title: 'New Academic Year Orientation',         body: 'Orientation for the new academic year starts Monday at 9 AM in the main auditorium. All students and parents are requested to attend.',                                                    category: 'event',     scope: 'school', created_by: admins[0].id, pinned: true  },
    { title: 'Mid Term Exam Schedule Released',       body: 'Mid-term exams begin April 21. Hall tickets are available in the student portal. Check your dashboard for your exam timetable and room allocation.',                                          category: 'exam',      scope: 'school', created_by: admins[0].id, pinned: true  },
    { title: 'Heavy Rain Alert — Transport Delay',    body: 'School transport may be delayed tomorrow due to heavy rain forecast. Parents are advised to make alternate arrangements if possible.',                                                          category: 'emergency', scope: 'school', created_by: admins[0].id, pinned: false },
    { title: 'Science Fair 2026 — Registrations Open',body: 'Annual Science Fair registrations are now open. Students can register through their class teacher. Last date: April 30. Prizes worth ₹50,000 to be won!',                                    category: 'event',     scope: 'school', created_by: admins[1].id, pinned: false },
    { title: 'Holiday: Republic Day',                 body: 'School will remain closed on January 26 for Republic Day. The flag hoisting ceremony will be held at 8 AM for students who wish to attend.',                                                  category: 'holiday',   scope: 'school', created_by: admins[0].id, pinned: false },
    { title: 'Parent-Teacher Meeting — April 20',     body: 'PTM is scheduled for April 20 from 10 AM to 1 PM. Parents are requested to collect their ward\'s progress report and meet subject teachers.',                                                category: 'event',     scope: 'school', created_by: admins[2].id, pinned: false },
    { title: 'Library Book Return Reminder',          body: 'All students must return borrowed library books by April 15. A fine of ₹5 per day will be charged for late returns.',                                                                         category: 'event',     scope: 'school', created_by: admins[1].id, pinned: false },
    { title: 'Sports Day — May 5',                    body: 'Annual Sports Day is scheduled for May 5. Students participating in events must register with the PE department by April 25. Practice sessions start next week.',                             category: 'event',     scope: 'school', created_by: admins[0].id, pinned: false },
  ]);
  console.log('   ✓ 8 announcements');

  // ═══════════════════════════════════════════
  // 11. EXAM SCHEDULES
  // ═══════════════════════════════════════════
  console.log('📋 Creating exam schedules...');
  const examScheduleRows = classes.flatMap((cls, ci) =>
    markSubjects.map((subject, si) => ({
      class_id: cls.id,
      subject,
      date: new Date(Date.now() + (11 + ci * 6 + si) * 86400000).toISOString(),
      room: rooms[(ci + si) % rooms.length],
    }))
  );
  await supabase.from('exam_schedules').insert(examScheduleRows);
  console.log(`   ✓ ${examScheduleRows.length} exam schedules`);

  // ═══════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════
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
};

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
