import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { supabase } from '../config/supabase.js';

const gradeFromPercentage = (percentage) => {
  if (percentage >= 90) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 45) return 'D';
  return 'F';
};

// ── ClassRoom ──
export const createClassRoom = asyncHandler(async (req, res) => {
  const { data: classRoom, error } = await supabase
    .from('classrooms')
    .insert(req.body)
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  res.status(201).json({ success: true, classRoom });
});

// ── Student Profile ──
export const createStudentProfile = asyncHandler(async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', req.body.userId || req.body.user_id)
    .single();
  if (!user || user.role !== 'student') throw new ApiError(400, 'userId must belong to a student');

  const { data: profile, error } = await supabase
    .from('student_profiles')
    .insert({
      user_id: user.id,
      grade: req.body.grade,
      section: req.body.section,
      roll_number: req.body.rollNumber || req.body.roll_number,
      subjects: req.body.subjects || [],
      parent_name: req.body.parentName || req.body.parent_name,
      parent_phone: req.body.parentPhone || req.body.parent_phone,
    })
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  res.status(201).json({ success: true, profile });
});

// ── Teacher Profile ──
export const createTeacherProfile = asyncHandler(async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', req.body.userId || req.body.user_id)
    .single();
  if (!user || user.role !== 'teacher') throw new ApiError(400, 'userId must belong to a teacher');

  const { data: profile, error } = await supabase
    .from('teacher_profiles')
    .insert({
      user_id: user.id,
      subjects: req.body.subjects || [],
      phone: req.body.phone,
    })
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  res.status(201).json({ success: true, profile });
});

// ── List Students ──
export const listStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let query = supabase
    .from('student_profiles')
    .select('*, users!inner(name, email, role)', { count: 'exact' });

  if (req.query.grade) query = query.eq('grade', req.query.grade);
  if (req.query.section) query = query.eq('section', req.query.section);
  if (req.query.minAttendance) query = query.gte('attendance_percent', Number(req.query.minAttendance));

  const { data: items, count: total, error } = await query
    .order('xp', { ascending: false })
    .range(skip, skip + limit - 1);

  if (error) throw new ApiError(500, error.message);

  // Reshape to match old format: { ...profile, userId: { name, email, role } }
  const shaped = (items || []).map((item) => {
    const { users, ...rest } = item;
    return { ...rest, userId: users };
  });

  res.json({ success: true, ...buildPaginatedResponse({ items: shaped, total: total || 0, page, limit }) });
});

// ── List Teachers ──
export const listTeachers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const { data: items, count: total, error } = await supabase
    .from('teacher_profiles')
    .select('*, users!inner(name, email, role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (error) throw new ApiError(500, error.message);

  const shaped = (items || []).map((item) => {
    const { users, ...rest } = item;
    return { ...rest, userId: users };
  });

  res.json({ success: true, ...buildPaginatedResponse({ items: shaped, total: total || 0, page, limit }) });
});

// ── Messages ──
export const listMessages = asyncHandler(async (req, res) => {
  const otherUserId = req.query.otherUserId;
  if (!otherUserId) throw new ApiError(400, 'Query otherUserId is required');
  const userId = req.user.id;

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, messages: messages || [] });
});

// ── Assignments ──
export const createAssignment = asyncHandler(async (req, res) => {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert({
      title: req.body.title,
      description: req.body.description,
      subject: req.body.subject,
      class_id: req.body.classId || req.body.class_id,
      teacher_id: req.user.id,
      due_date: req.body.dueDate || req.body.due_date,
      max_marks: req.body.maxMarks || req.body.max_marks,
      attachments: (req.files || []).map((file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/${file.filename || file.originalname}`,
      })),
    })
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  res.status(201).json({ success: true, assignment });
});

export const listAssignments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let query = supabase
    .from('assignments')
    .select('*', { count: 'exact' });

  if (req.query.classId) query = query.eq('class_id', req.query.classId);
  if (req.query.subject) query = query.eq('subject', req.query.subject);

  const { data: items, count: total, error } = await query
    .order('due_date', { ascending: true })
    .range(skip, skip + limit - 1);

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, ...buildPaginatedResponse({ items: items || [], total: total || 0, page, limit }) });
});

// ── Submissions ──
export const submitAssignment = asyncHandler(async (req, res) => {
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', req.params.assignmentId)
    .single();
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const submittedAt = new Date().toISOString();
  const isLate = new Date(submittedAt) > new Date(assignment.due_date);

  const { data: submission, error } = await supabase
    .from('submissions')
    .upsert(
      {
        assignment_id: assignment.id,
        student_id: req.user.id,
        submitted_at: submittedAt,
        is_late: isLate,
        content: req.body.content,
        attachments: (req.files || []).map((file) => ({
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename || file.originalname}`,
        })),
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);

  // Award XP for on-time submissions
  if (!isLate) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('xp')
      .eq('user_id', req.user.id)
      .single();

    if (profile) {
      await supabase
        .from('student_profiles')
        .update({ xp: (profile.xp || 0) + 10 })
        .eq('user_id', req.user.id);
    }
  }

  res.status(201).json({ success: true, submission });
});

export const gradeSubmission = asyncHandler(async (req, res) => {
  const { data: submission } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', req.params.submissionId)
    .single();
  if (!submission) throw new ApiError(404, 'Submission not found');

  const { data: updated, error } = await supabase
    .from('submissions')
    .update({
      marks: req.body.marks,
      feedback: req.body.feedback || '',
      graded_at: new Date().toISOString(),
    })
    .eq('id', submission.id)
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);

  // Award badge for perfect score
  if (req.body.marks >= 100) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('xp, badges')
      .eq('user_id', submission.student_id)
      .single();

    if (profile) {
      const badges = Array.isArray(profile.badges) ? profile.badges : [];
      if (!badges.includes('Top Scorer')) {
        badges.push('Top Scorer');
      }
      await supabase
        .from('student_profiles')
        .update({ xp: (profile.xp || 0) + 25, badges })
        .eq('user_id', submission.student_id);
    }
  }

  res.json({ success: true, submission: updated });
});

// ── Attendance ──
export const markAttendance = asyncHandler(async (req, res) => {
  const { classId, date, entries } = req.body;

  // Upsert all attendance entries
  const rows = entries.map((entry) => ({
    class_id: classId,
    student_id: entry.studentId,
    teacher_id: req.user.id,
    date,
    status: entry.status,
  }));

  const { error } = await supabase
    .from('attendance_records')
    .upsert(rows, { onConflict: 'class_id,student_id,date' });

  if (error) throw new ApiError(500, error.message);

  // Recalculate attendance percentages
  await Promise.all(
    entries.map(async (entry) => {
      const { count: total } = await supabase
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', entry.studentId);

      const { count: presentOrLate } = await supabase
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', entry.studentId)
        .in('status', ['present', 'late']);

      const attendancePercent = total > 0 ? Math.round((presentOrLate / total) * 100) : 100;
      await supabase
        .from('student_profiles')
        .update({ attendance_percent: attendancePercent })
        .eq('user_id', entry.studentId);
    })
  );

  res.json({ success: true, message: 'Attendance updated' });
});

export const getAttendanceReport = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const month = Number(req.query.month ?? new Date().getMonth() + 1);
  const year = Number(req.query.year ?? new Date().getFullYear());
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: records, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('student_id', studentId)
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: true });

  if (error) throw new ApiError(500, error.message);

  if (req.query.format === 'csv') {
    const csvRows = ['date,status', ...(records || []).map((r) => `${r.date},${r.status}`)];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${studentId}-${year}-${month}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }

  return res.json({ success: true, records: records || [] });
});

// ── Announcements ──
export const createAnnouncement = asyncHandler(async (req, res) => {
  const { data: announcement, error } = await supabase
    .from('announcements')
    .insert({
      title: req.body.title,
      body: req.body.body,
      category: req.body.category,
      scope: req.body.scope,
      class_id: req.body.classId || req.body.class_id || null,
      created_by: req.user.id,
      pinned: req.body.pinned || false,
    })
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);
  if (req.io) req.io.emit('announcement:new', announcement);
  res.status(201).json({ success: true, announcement });
});

export const listAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let query = supabase
    .from('announcements')
    .select('*', { count: 'exact' });

  if (req.query.scope) query = query.eq('scope', req.query.scope);
  if (req.query.category) query = query.eq('category', req.query.category);
  if (req.query.classId) query = query.eq('class_id', req.query.classId);

  const { data: items, count: total, error } = await query
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, ...buildPaginatedResponse({ items: items || [], total: total || 0, page, limit }) });
});

// ── Messaging ──
export const sendMessage = asyncHandler(async (req, res) => {
  if (!req.body.classId && !req.body.recipientId) {
    throw new ApiError(400, 'recipientId is required for direct messages (or provide classId for class messages)');
  }
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      sender_id: req.user.id,
      recipient_id: req.body.recipientId || null,
      class_id: req.body.classId || null,
      content: req.body.content,
      read_by: [req.user.id],
    })
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);

  if (req.io) {
    const rid = req.body.recipientId;
    if (rid) req.io.to(`user:${rid}`).emit('message:new', message);
    req.io.to(`user:${req.user.id}`).emit('message:new', message);
    if (req.body.classId) req.io.to(`class:${req.body.classId}`).emit('message:new', message);
  }

  res.status(201).json({ success: true, message });
});

export const markMessageRead = asyncHandler(async (req, res) => {
  const { data: existing } = await supabase
    .from('messages')
    .select('id, read_by')
    .eq('id', req.params.messageId)
    .single();

  if (!existing) throw new ApiError(404, 'Message not found');

  const readBy = Array.isArray(existing.read_by) ? existing.read_by : [];
  if (!readBy.includes(req.user.id)) {
    readBy.push(req.user.id);
  }

  const { data: message, error } = await supabase
    .from('messages')
    .update({ read_by: readBy })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, message });
});

// ── Marks ──
export const createMark = asyncHandler(async (req, res) => {
  const { data: mark, error } = await supabase
    .from('marks')
    .insert({
      student_id: req.body.studentId || req.body.student_id,
      class_id: req.body.classId || req.body.class_id,
      subject: req.body.subject,
      exam_type: req.body.examType || req.body.exam_type,
      score: req.body.score,
      term: req.body.term,
    })
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);
  res.status(201).json({ success: true, mark });
});

export const getReportCard = asyncHandler(async (req, res) => {
  const { data: marks, error } = await supabase
    .from('marks')
    .select('*')
    .eq('student_id', req.params.studentId);

  if (error) throw new ApiError(500, error.message);
  if (!marks || !marks.length) {
    return res.json({ success: true, report: { total: 0, percentage: 0, grade: 'N/A', marks: [] } });
  }

  const total = marks.reduce((sum, m) => sum + Number(m.score), 0);
  const percentage = Number((total / marks.length).toFixed(2));
  const grade = gradeFromPercentage(percentage);

  const subjectBreakdown = marks.reduce((acc, mark) => {
    if (!acc[mark.subject]) acc[mark.subject] = [];
    acc[mark.subject].push(Number(mark.score));
    return acc;
  }, {});

  res.json({
    success: true,
    report: {
      total,
      percentage,
      grade,
      strengths: Object.entries(subjectBreakdown)
        .filter(([, scores]) => scores.reduce((s, x) => s + x, 0) / scores.length >= 75)
        .map(([subject]) => subject),
      weaknesses: Object.entries(subjectBreakdown)
        .filter(([, scores]) => scores.reduce((s, x) => s + x, 0) / scores.length < 60)
        .map(([subject]) => subject),
      marks,
    },
  });
});

// ── Timetable ──
export const saveTimetable = asyncHandler(async (req, res) => {
  const { classId, entries } = req.body;

  const duplicateSlots = new Set();
  for (const entry of entries) {
    const slot = `${entry.day}|${entry.period}|${entry.room}`;
    if (duplicateSlots.has(slot)) {
      throw new ApiError(400, `Timetable clash detected at ${slot}`);
    }
    duplicateSlots.add(slot);
  }

  const { data: timetable, error } = await supabase
    .from('timetables')
    .upsert(
      { class_id: classId, entries: JSON.stringify(entries) },
      { onConflict: 'class_id' }
    )
    .select()
    .single();

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, timetable });
});

// ── Leaderboard ──
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { data: classRoom } = await supabase
    .from('classrooms')
    .select('id, privacy_leaderboard_enabled')
    .eq('id', req.params.classId)
    .single();

  if (!classRoom) throw new ApiError(404, 'Class not found');
  if (!classRoom.privacy_leaderboard_enabled && req.user.role === 'student') {
    throw new ApiError(403, 'Leaderboard is disabled for this class');
  }

  // Get student IDs in this classroom
  const { data: enrollments } = await supabase
    .from('classroom_students')
    .select('student_id')
    .eq('classroom_id', req.params.classId);

  const studentIds = (enrollments || []).map((e) => e.student_id);
  if (!studentIds.length) {
    return res.json({ success: true, leaderboard: [] });
  }

  const { data: students, error } = await supabase
    .from('student_profiles')
    .select('*')
    .in('user_id', studentIds)
    .order('xp', { ascending: false })
    .order('attendance_percent', { ascending: false })
    .limit(50);

  if (error) throw new ApiError(500, error.message);
  res.json({ success: true, leaderboard: students || [] });
});
