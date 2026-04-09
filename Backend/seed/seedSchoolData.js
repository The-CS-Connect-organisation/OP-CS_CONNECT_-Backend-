import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });


const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Helpers ──
const hash = (pw) => bcrypt.hashSync(pw, 12);

const seed = async () => {
  console.log('🚀 Seeding Cornerstone School data into Supabase...\n');

  // ── Clear existing data (order matters for FK constraints) ──
  console.log('🧹 Clearing old data...');
  await supabase.from('semester_performance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('attendance_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('marks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('timetables').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('exam_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('classroom_students').delete().neq('classroom_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('classroom_teachers').delete().neq('classroom_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('student_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('teacher_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('parent_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('ai_interactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('classrooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // ═══════════════════════════════════════════
  // 1. USERS — 3 admins, 10 teachers, 20 students
  // ═══════════════════════════════════════════
  console.log('👥 Creating users...');

  const adminData = [
    { name: 'Alicia Morgan', email: 'admin@schoolsync.edu', password_hash: hash('admin123'), role: 'admin', is_active: true },
    { name: 'Rahul Venkataraman', email: 'admin2@schoolsync.edu', password_hash: hash('admin123'), role: 'admin', is_active: true },
    { name: 'Neha Kapoor', email: 'admin3@schoolsync.edu', password_hash: hash('admin123'), role: 'admin', is_active: true },
  ];

  const teacherNames = [
    'Rajesh Kumar', 'Priya Sharma',
  ];
  const teacherSubjects = [
    ['Mathematics'], ['English Literature'], ['Physics'], ['Chemistry'],
    ['Computer Science'], ['Biology'], ['History', 'Civics'], ['Mathematics', 'Statistics'],
    ['Geography'], ['Hindi'],
  ];
  const teacherData = teacherNames.map((name, i) => ({
    name,
    email: `teacher${i + 1}@schoolsync.edu`,
    password_hash: hash('teacher123'),
    role: 'teacher',
    is_active: true,
  }));

  const studentNames = [
    'Aarav Menon', 'Ishita Kapoor', 'Vivaan Joshi', 'Diya Malhotra', 'Aditya Rao',
  ];
  const studentData = studentNames.map((name, i) => ({
    name,
    email: `student${i + 1}@schoolsync.edu`,
    password_hash: hash('student123'),
    role: 'student',
    is_active: true,
  }));

  const parentData = Array.from({ length: 10 }).map((_, i) => ({
    name: `Parent ${i + 1}`,
    email: `parent${i + 1}@schoolsync.edu`,
    password_hash: hash('parent123'),
    role: 'parent',
    is_active: true,
  }));

  const { data: admins, error: ae } = await supabase.from('users').insert(adminData).select();
  if (ae) { console.error('Admin insert error:', ae.message); process.exit(1); }

  const { data: teachers, error: te } = await supabase.from('users').insert(teacherData).select();
  if (te) { console.error('Teacher insert error:', te.message); process.exit(1); }

  const { data: students, error: se } = await supabase.from('users').insert(studentData).select();
  if (se) { console.error('Student insert error:', se.message); process.exit(1); }

  const { data: parents, error: pe } = await supabase.from('users').insert(parentData).select();
  if (pe) { console.error('Parent insert error:', pe.message); process.exit(1); }

  console.log(`   ✓ ${admins.length} admins, ${teachers.length} teachers, ${students.length} students, ${parents.length} parents`);

  // ═══════════════════════════════════════════
  // 2. CLASSROOMS
  // ═══════════════════════════════════════════
  console.log('🏫 Creating classrooms...');
  const { data: classes, error: ce } = await supabase
    .from('classrooms')
    .insert([
      { name: 'Grade 10-A', grade: '10', section: 'A' },
      { name: 'Grade 10-B', grade: '10', section: 'B' },
      { name: 'Grade 11-A', grade: '11', section: 'A' },
      { name: 'Grade 11-B', grade: '11', section: 'B' },
    ])
    .select();
  if (ce) { console.error('Classroom error:', ce.message); process.exit(1); }
  console.log(`   ✓ ${classes.length} classrooms`);

  // ── Classroom ↔ Student junction ──
  const csRows = students.map((s, i) => ({
    classroom_id: classes[i % classes.length].id,
    student_id: s.id,
  }));
  await supabase.from('classroom_students').insert(csRows);

  // ── Classroom ↔ Teacher junction ──
  const ctRows = [];
  teachers.forEach((t, i) => {
    ctRows.push({ classroom_id: classes[i % classes.length].id, teacher_id: t.id });
    ctRows.push({ classroom_id: classes[(i + 1) % classes.length].id, teacher_id: t.id });
  });
  // Deduplicate
  const ctUnique = [...new Map(ctRows.map(r => [`${r.classroom_id}-${r.teacher_id}`, r])).values()];
  await supabase.from('classroom_teachers').insert(ctUnique);

  // ═══════════════════════════════════════════
  // 3. PROFILES
  // ═══════════════════════════════════════════
  console.log('📋 Creating profiles...');
  const attendanceBand = [97, 95, 93, 91, 88, 86, 84, 82, 80, 78, 76, 74, 90, 87, 85, 83, 79, 77, 92, 89];

  const studentProfiles = students.map((s, i) => {
    const cls = classes[i % classes.length];
    const att = attendanceBand[i % attendanceBand.length];
    return {
      user_id: s.id,
      grade: cls.grade,
      section: cls.section,
      roll_number: `${cls.grade}${cls.section}-${String(i + 1).padStart(3, '0')}`,
      subjects: ['Mathematics', 'Physics', 'English', 'Chemistry'],
      attendance_percent: att,
      parent_name: parents[i]?.name || null,
      parent_phone: `+91-90${String(1000000 + i).padStart(7, '0')}`,
      xp: Math.max(10, 200 - i * 8),
      badges: att >= 90 ? ['Punctual', 'Consistent'] : att >= 80 ? ['Consistent'] : ['Needs Support'],
    };
  });
  const { error: spe } = await supabase.from('student_profiles').insert(studentProfiles);
  if (spe) { console.error('Student profile error:', spe.message); process.exit(1); }

  const teacherProfiles = teachers.map((t, i) => ({
    user_id: t.id,
    subjects: teacherSubjects[i] || ['General'],
    phone: `+91-98${String(7654300 + i).padStart(7, '0')}`,
  }));
  const { error: tpe } = await supabase.from('teacher_profiles').insert(teacherProfiles);
  if (tpe) { console.error('Teacher profile error:', tpe.message); process.exit(1); }

  const parentProfiles = parents.map((p, i) => ({
    user_id: p.id,
    child_ids: students[i] ? [students[i].id] : [],
    phone: `+91-90${String(1000000 + i).padStart(7, '0')}`,
  }));
  const { error: ppe } = await supabase.from('parent_profiles').insert(parentProfiles);
  if (ppe) { console.error('Parent profile error:', ppe.message); process.exit(1); }

  console.log(`   ✓ ${studentProfiles.length} student, ${teacherProfiles.length} teacher, ${parentProfiles.length} parent profiles`);

  // ═══════════════════════════════════════════
  // 4. ASSIGNMENTS
  // ═══════════════════════════════════════════
  console.log('📝 Creating assignments...');
  const assignmentData = classes.flatMap((cls, idx) => ([
    {
      title: `${cls.name} Mathematics Worksheet`,
      description: `Practice algebra and data interpretation for ${cls.name}.`,
      subject: 'Mathematics',
      class_id: cls.id,
      teacher_id: teachers[idx % teachers.length].id,
      due_date: new Date(Date.now() + (idx + 3) * 86400000).toISOString(),
      max_marks: 100,
    },
    {
      title: `${cls.name} Science Lab Report`,
      description: `Submit full lab observations and inferences for ${cls.name}.`,
      subject: 'Physics',
      class_id: cls.id,
      teacher_id: teachers[(idx + 2) % teachers.length].id,
      due_date: new Date(Date.now() + (idx + 5) * 86400000).toISOString(),
      max_marks: 100,
    },
    {
      title: `${cls.name} English Essay`,
      description: `Write a 500-word essay on a given topic for ${cls.name}.`,
      subject: 'English',
      class_id: cls.id,
      teacher_id: teachers[(idx + 1) % teachers.length].id,
      due_date: new Date(Date.now() + (idx + 7) * 86400000).toISOString(),
      max_marks: 50,
    },
  ]));
  const { data: assignments, error: ase } = await supabase.from('assignments').insert(assignmentData).select();
  if (ase) { console.error('Assignment error:', ase.message); process.exit(1); }
  console.log(`   ✓ ${assignments.length} assignments`);

  // ═══════════════════════════════════════════
  // 5. SUBMISSIONS
  // ═══════════════════════════════════════════
  console.log('📤 Creating submissions...');
  const submissionRows = students.slice(0, 15).map((student, idx) => {
    const assignment = assignments[idx % assignments.length];
    const submittedAt = new Date(Date.now() - idx * 3600 * 1000).toISOString();
    return {
      assignment_id: assignment.id,
      student_id: student.id,
      submitted_at: submittedAt,
      is_late: new Date(submittedAt) > new Date(assignment.due_date),
      content: `Submission draft by ${student.name || studentNames[idx]}.`,
      marks: 65 + (idx % 35),
      feedback: 'Good attempt. Improve structure and examples.',
      graded_at: new Date().toISOString(),
    };
  });
  await supabase.from('submissions').insert(submissionRows);
  console.log(`   ✓ ${submissionRows.length} submissions`);

  // ═══════════════════════════════════════════
  // 6. MARKS
  // ═══════════════════════════════════════════
  console.log('📊 Creating marks...');
  const markRows = students.flatMap((student, idx) => {
    const cls = classes[idx % classes.length];
    return [
      { student_id: student.id, class_id: cls.id, subject: 'Mathematics', exam_type: 'unit_test', score: 60 + (idx % 35), term: 'Cycle Test 1' },
      { student_id: student.id, class_id: cls.id, subject: 'Physics', exam_type: 'mid_term', score: 58 + ((idx * 2) % 35), term: 'Cycle Test 2' },
      { student_id: student.id, class_id: cls.id, subject: 'English', exam_type: 'final', score: 62 + ((idx * 3) % 30), term: 'Term 1' },
      { student_id: student.id, class_id: cls.id, subject: 'Chemistry', exam_type: 'unit_test', score: 55 + ((idx * 4) % 40), term: 'Cycle Test 1' },
    ];
  });
  await supabase.from('marks').insert(markRows);
  console.log(`   ✓ ${markRows.length} marks`);

  // ═══════════════════════════════════════════
  // 7. ATTENDANCE (30 days)
  // ═══════════════════════════════════════════
  console.log('📅 Creating attendance records (30 days)...');
  const attendanceRows = [];
  for (let day = 0; day < 30; day++) {
    const date = new Date(Date.now() - day * 86400000).toISOString().split('T')[0];
    for (let i = 0; i < students.length; i++) {
      const cls = classes[i % classes.length];
      const teacher = teachers[i % teachers.length];
      const pick = (i + day) % 14;
      const status = pick < 10 ? 'present' : pick < 12 ? 'late' : 'absent';
      attendanceRows.push({
        class_id: cls.id,
        student_id: students[i].id,
        teacher_id: teacher.id,
        date,
        status,
      });
    }
  }
  // Insert in batches of 200 to avoid payload limits
  for (let i = 0; i < attendanceRows.length; i += 200) {
    await supabase.from('attendance_records').insert(attendanceRows.slice(i, i + 200));
  }
  console.log(`   ✓ ${attendanceRows.length} attendance records`);

  // ═══════════════════════════════════════════
  // 8. ANNOUNCEMENTS
  // ═══════════════════════════════════════════
  console.log('📢 Creating announcements...');
  await supabase.from('announcements').insert([
    {
      title: 'Cornerstone International School Orientation',
      body: 'New academic year orientation starts next Monday at 9 AM in the main auditorium.',
      category: 'event', scope: 'school', created_by: admins[0].id, pinned: true,
    },
    {
      title: 'Mid Term Exam Schedule Released',
      body: 'Exam IDs and hall ticket details are available in the student portal. Check your dashboard.',
      category: 'exam', scope: 'school', created_by: admins[0].id, pinned: true,
    },
    {
      title: 'Heavy Rain Alert — Transport Delay',
      body: 'School transport may be delayed tomorrow due to heavy rain forecast. Plan accordingly.',
      category: 'emergency', scope: 'school', created_by: admins[0].id, pinned: false,
    },
    {
      title: 'Science Fair 2026 Registration Open',
      body: 'Students can register for the annual science fair. Last date: April 30. See your class teacher for details.',
      category: 'event', scope: 'school', created_by: admins[1].id, pinned: false,
    },
    {
      title: 'Holiday: Republic Day',
      body: 'School will remain closed on January 26 for Republic Day celebrations.',
      category: 'holiday', scope: 'school', created_by: admins[0].id, pinned: false,
    },
  ]);
  console.log('   ✓ 5 announcements');

  // ═══════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════
  console.log('\n✅ Seed complete!\n');
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  LOGIN CREDENTIALS                                  │');
  console.log('├──────────────────────────────────────────────────────┤');
  console.log('│  Admin:   admin@schoolsync.edu    / admin123        │');
  console.log('│  Admin 2: admin2@schoolsync.edu   / admin123        │');
  console.log('│  Admin 3: admin3@schoolsync.edu   / admin123        │');
  console.log('│  Teachers: teacher1..10@schoolsync.edu / teacher123 │');
  console.log('│  Students: student1..20@schoolsync.edu / student123 │');
  console.log('│  Parents:  parent1..20@schoolsync.edu  / parent123  │');
  console.log('└──────────────────────────────────────────────────────┘');

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
