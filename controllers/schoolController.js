import { StreamChat } from 'stream-chat';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord, batchWrite } from '../utils/supabaseDb.js';

const gradeFromPercentage = (percentage) => {
  if (percentage >= 90) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 45) return 'D';
  return 'F';
};

// ── ClassRoom ──
export const createClassRoom = asyncHandler(async (req, res) => {
  const classroomId = Date.now().toString();
  const classroom = {
    id: classroomId,
    ...req.body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`classrooms/${classroomId}`, classroom);
  res.status(201).json({ success: true, classRoom: classroom });
});

// ── Student Profile ──
export const createStudentProfile = asyncHandler(async (req, res) => {
  const userId = req.body.userId || req.body.user_id;
  const user = await getRecord(`users/${userId}`);
  if (!user || user.role !== 'student') throw new ApiError(400, 'userId must belong to a student');

  const profileId = Date.now().toString();
  const profile = {
    id: profileId,
    user_id: user.id,
    grade: req.body.grade,
    section: req.body.section,
    roll_number: req.body.rollNumber || req.body.roll_number,
    subjects: req.body.subjects || [],
    parent_name: req.body.parentName || req.body.parent_name,
    parent_phone: req.body.parentPhone || req.body.parent_phone,
    attendance_percent: 100,
    xp: 0,
    badges: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`student_profiles/${profileId}`, profile);
  res.status(201).json({ success: true, profile });
});

// ── Teacher Profile ──
export const createTeacherProfile = asyncHandler(async (req, res) => {
  const userId = req.body.userId || req.body.user_id;
  const user = await getRecord(`users/${userId}`);
  if (!user || user.role !== 'teacher') throw new ApiError(400, 'userId must belong to a teacher');

  const profileId = Date.now().toString();
  const profile = {
    id: profileId,
    user_id: user.id,
    subjects: req.body.subjects || [],
    phone: req.body.phone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`teacher_profiles/${profileId}`, profile);
  res.status(201).json({ success: true, profile });
});

// ── List Students ──
export const listStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let students = await getRecords('student_profiles');

  // Apply filters
  if (req.query.grade) {
    students = students.filter(s => s.grade === req.query.grade);
  }
  if (req.query.section) {
    students = students.filter(s => s.section === req.query.section);
  }
  if (req.query.minAttendance) {
    students = students.filter(s => s.attendance_percent >= Number(req.query.minAttendance));
  }

  // Sort by XP descending
  students.sort((a, b) => (b.xp || 0) - (a.xp || 0));

  // Enrich with user data
  const enriched = await Promise.all(
    students.map(async (student) => {
      const user = await getRecord(`users/${student.user_id}`);
      return {
        ...student,
        userId: user ? { name: user.name, email: user.email, role: user.role } : null,
      };
    })
  );

  const total = enriched.length;
  const items = enriched.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

// ── List Teachers ──
export const listTeachers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let teachers = await getRecords('teacher_profiles');

  // Sort by created_at descending
  teachers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Enrich with user data
  const enriched = await Promise.all(
    teachers.map(async (teacher) => {
      const user = await getRecord(`users/${teacher.user_id}`);
      return {
        ...teacher,
        userId: user ? { name: user.name, email: user.email, role: user.role } : null,
      };
    })
  );

  const total = enriched.length;
  const items = enriched.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

// ── Messages ──
export const listMessages = asyncHandler(async (req, res) => {
  const otherUserId = req.query.otherUserId;
  if (!otherUserId) throw new ApiError(400, 'Query otherUserId is required');
  const userId = req.user.id;

  const messages = await queryRecords('messages', (msg) => {
    const isBetweenUsers =
      (msg.sender_id === userId && msg.recipient_id === otherUserId) ||
      (msg.sender_id === otherUserId && msg.recipient_id === userId);
    return isBetweenUsers;
  });

  // Sort by created_at ascending
  messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  res.json({ success: true, messages: messages.slice(-500) });
});

// ── Assignments ──
export const createAssignment = asyncHandler(async (req, res) => {
  const assignmentId = Date.now().toString();
  const assignment = {
    id: assignmentId,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`assignments/${assignmentId}`, assignment);
  res.status(201).json({ success: true, assignment });
});

export const listAssignments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let assignments = await getRecords('assignments');

  // Apply filters
  if (req.query.classId) {
    assignments = assignments.filter(a => a.class_id === req.query.classId);
  }
  if (req.query.teacherId) {
    assignments = assignments.filter(a => a.teacher_id === req.query.teacherId);
  }
  if (req.query.subject) {
    assignments = assignments.filter(a => a.subject === req.query.subject);
  }

  // Sort by due_date ascending
  assignments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const total = assignments.length;
  const items = assignments.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

// ── Submissions ──
export const submitAssignment = asyncHandler(async (req, res) => {
  const assignment = await getRecord(`assignments/${req.params.assignmentId}`);
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  const submittedAt = new Date().toISOString();
  const isLate = new Date(submittedAt) > new Date(assignment.due_date);

  const submissionId = Date.now().toString();
  const submission = {
    id: submissionId,
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`submissions/${submissionId}`, submission);

  // Award XP for on-time submissions
  if (!isLate) {
    const profile = await getRecord(`student_profiles/${req.user.id}`);
    if (profile) {
      await updateRecord(`student_profiles/${req.user.id}`, {
        xp: (profile.xp || 0) + 10,
      });
    }
  }

  res.status(201).json({ success: true, submission });
});

export const gradeSubmission = asyncHandler(async (req, res) => {
  const submission = await getRecord(`submissions/${req.params.submissionId}`);
  if (!submission) throw new ApiError(404, 'Submission not found');

  const updated = {
    ...submission,
    marks: req.body.marks,
    feedback: req.body.feedback || '',
    graded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`submissions/${req.params.submissionId}`, updated);

  // Award badge for perfect score
  if (req.body.marks >= 100) {
    const profile = await getRecord(`student_profiles/${submission.student_id}`);
    if (profile) {
      const badges = Array.isArray(profile.badges) ? profile.badges : [];
      if (!badges.includes('Top Scorer')) {
        badges.push('Top Scorer');
      }
      await updateRecord(`student_profiles/${submission.student_id}`, {
        xp: (profile.xp || 0) + 25,
        badges,
      });
    }
  }

  res.json({ success: true, submission: updated });
});

// ── Attendance ──
export const markAttendance = asyncHandler(async (req, res) => {
  const { classId, date, entries } = req.body;
  const normalizedDate = date.split('T')[0];

  // Create attendance records
  const operations = entries.map((entry) => {
    const recordId = `${classId}_${entry.studentId}_${normalizedDate}`;
    return {
      path: `attendance_records/${recordId}`,
      data: {
        id: recordId,
        class_id: classId,
        student_id: entry.studentId,
        teacher_id: req.user.id,
        date: normalizedDate,
        status: entry.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      operation: 'set',
    };
  });

  await batchWrite(operations);

  // Recalculate attendance percentages
  await Promise.all(
    entries.map(async (entry) => {
      const records = await queryRecords('attendance_records', (r) => r.student_id === entry.studentId);
      const presentOrLate = records.filter(r => ['present', 'late'].includes(r.status)).length;
      const attendancePercent = records.length > 0 ? Math.round((presentOrLate / records.length) * 100) : 100;

      const profile = await getRecord(`student_profiles/${entry.studentId}`);
      if (profile) {
        await updateRecord(`student_profiles/${entry.studentId}`, {
          attendance_percent: attendancePercent,
        });
      }
    })
  );

  res.json({ success: true, message: 'Attendance updated' });
});

export const getAttendanceReport = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  let records = await queryRecords('attendance_records', (r) => r.student_id === studentId);

  // Filter by month/year if provided
  if (req.query.month && req.query.year) {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    records = records.filter(r => r.date >= startDate && r.date < endDate);
  }

  // Sort by date
  records.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (req.query.format === 'csv') {
    const csvRows = ['date,status', ...records.map((r) => `${r.date},${r.status}`)];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-${studentId}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }

  return res.json({ success: true, records });
});

// ── Announcements ──
export const createAnnouncement = asyncHandler(async (req, res) => {
  const announcementId = Date.now().toString();
  const announcement = {
    id: announcementId,
    title: req.body.title,
    body: req.body.body,
    category: req.body.category,
    scope: req.body.scope,
    class_id: req.body.classId || req.body.class_id || null,
    created_by: req.user.id,
    pinned: req.body.pinned || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`announcements/${announcementId}`, announcement);

  if (req.io) req.io.emit('announcement:new', announcement);
  res.status(201).json({ success: true, announcement });
});

export const listAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let announcements = await getRecords('announcements');

  // Apply filters
  if (req.query.scope) {
    announcements = announcements.filter(a => a.scope === req.query.scope);
  }
  if (req.query.category) {
    announcements = announcements.filter(a => a.category === req.query.category);
  }
  if (req.query.classId) {
    announcements = announcements.filter(a => a.class_id === req.query.classId);
  }

  // Sort by pinned (descending) then created_at (descending)
  announcements.sort((a, b) => {
    if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const total = announcements.length;
  const items = announcements.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

// ── Messaging ──
export const sendMessage = asyncHandler(async (req, res) => {
  if (!req.body.classId && !req.body.recipientId) {
    throw new ApiError(400, 'recipientId is required for direct messages (or provide classId for class messages)');
  }

  const messageId = Date.now().toString();
  const message = {
    id: messageId,
    sender_id: req.user.id,
    recipient_id: req.body.recipientId || null,
    class_id: req.body.classId || null,
    content: req.body.content,
    read_by: [req.user.id],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`messages/${messageId}`, message);

  if (req.io) {
    const rid = req.body.recipientId;
    if (rid) req.io.to(`user:${rid}`).emit('message:new', message);
    req.io.to(`user:${req.user.id}`).emit('message:new', message);
    if (req.body.classId) req.io.to(`class:${req.body.classId}`).emit('message:new', message);
  }

  res.status(201).json({ success: true, message });
});

export const markMessageRead = asyncHandler(async (req, res) => {
  const existing = await getRecord(`messages/${req.params.messageId}`);
  if (!existing) throw new ApiError(404, 'Message not found');

  const readBy = Array.isArray(existing.read_by) ? existing.read_by : [];
  if (!readBy.includes(req.user.id)) {
    readBy.push(req.user.id);
  }

  const message = {
    ...existing,
    read_by: readBy,
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`messages/${req.params.messageId}`, message);
  res.json({ success: true, message });
});

// ── Marks ──
export const createMark = asyncHandler(async (req, res) => {
  const markId = Date.now().toString();
  const mark = {
    id: markId,
    student_id: req.body.studentId || req.body.student_id,
    class_id: req.body.classId || req.body.class_id,
    subject: req.body.subject,
    exam_type: req.body.examType || req.body.exam_type,
    score: req.body.score,
    term: req.body.term,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`marks/${markId}`, mark);
  res.status(201).json({ success: true, mark });
});

export const getReportCard = asyncHandler(async (req, res) => {
  const marks = await queryRecords('marks', (m) => m.student_id === req.params.studentId);

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
export const getTimetable = asyncHandler(async (req, res) => {
  const classId = req.query.classId || req.query.class_id;
  if (!classId) throw new ApiError(400, 'classId is required');

  const timetable = await getRecord(`timetables/${classId}`);

  if (!timetable) return res.json({ success: true, entries: [] });

  const entries = typeof timetable.entries === 'string'
    ? JSON.parse(timetable.entries)
    : timetable.entries;

  res.json({ success: true, classId, entries: entries || [] });
});

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

  const timetable = {
    id: classId,
    class_id: classId,
    entries: JSON.stringify(entries),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`timetables/${classId}`, timetable);
  res.json({ success: true, timetable });
});

// ── Leaderboard ──
export const getLeaderboard = asyncHandler(async (req, res) => {
  const classRoom = await getRecord(`classrooms/${req.params.classId}`);

  if (!classRoom) throw new ApiError(404, 'Class not found');
  if (!classRoom.privacy_leaderboard_enabled && req.user.role === 'student') {
    throw new ApiError(403, 'Leaderboard is disabled for this class');
  }

  // Get student IDs in this classroom
  const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === req.params.classId);
  const studentIds = enrollments.map((e) => e.student_id);

  if (!studentIds.length) {
    return res.json({ success: true, leaderboard: [] });
  }

  // Get student profiles
  let students = await getRecords('student_profiles');
  students = students
    .filter(s => studentIds.includes(s.user_id))
    .sort((a, b) => {
      if (b.xp !== a.xp) return (b.xp || 0) - (a.xp || 0);
      return (b.attendance_percent || 0) - (a.attendance_percent || 0);
    })
    .slice(0, 50);

  res.json({ success: true, leaderboard: students });
});
export const getStreamToken = asyncHandler(async (req, res) => {
  const serverClient = StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
  const token = serverClient.createToken(req.user.id);
  res.json({ success: true, token, apiKey: env.STREAM_API_KEY });
});
