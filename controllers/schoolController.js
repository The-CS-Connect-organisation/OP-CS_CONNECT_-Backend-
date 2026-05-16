import { StreamChat } from 'stream-chat';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord, batchWrite, getStudentProfileByUserId, getTeacherProfileByUserId } from '../utils/firebaseDb.js';

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

  res.json({ success: true, students: items, items, total, page, limit });
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

  res.json({ success: true, teachers: items, items, total, page, limit });
});

// ── Get User by ID ──
export const getUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await getRecord(`users/${userId}`);
  if (!user) throw new ApiError(404, 'User not found');
  
  // Return user data without sensitive fields
  res.json({ 
    success: true, 
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      created_at: user.created_at,
    }
  });
});

// ── List Users by Role ──
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { role } = req.query;

  let users = await getRecords('users');

  // Apply role filter if provided
  if (role) {
    users = users.filter(u => u.role === role);
  }

  // Sort by created_at descending
  users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Return users without sensitive fields
  const sanitized = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || null,
    role: u.role,
    created_at: u.created_at,
  }));

  const total = sanitized.length;
  const items = sanitized.slice(skip, skip + limit);

  res.json({
    success: true,
    users: items,
    items,
    total,
    page,
    limit,
    ...buildPaginatedResponse({ items, total, page, limit })
  });
});

// ── Messages ──
export const listMessages = asyncHandler(async (req, res) => {
  const otherUserId = req.query.otherUserId;
  if (!otherUserId) throw new ApiError(400, 'Query otherUserId is required');
  
  const userId = req.user.id;

  const messages = await queryRecords('messages', (msg) => {
    return (
      (msg.sender_id === userId && msg.recipient_id === otherUserId) ||
      (msg.sender_id === otherUserId && msg.recipient_id === userId)
    );
  });

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
  let items = assignments.slice(skip, skip + limit);

  // Enrich with submission counts when teacherId is present
  if (req.query.teacherId) {
    const allSubmissions = await getRecords('submissions');
    items = items.map(a => ({
      ...a,
      submission_count: allSubmissions.filter(s => s.assignment_id === a.id).length,
    }));
  }

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
     const profile = await getStudentProfileByUserId(req.user.id);
     if (profile) {
       await updateRecord(`student_profiles/${profile.id}`, {
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
     const profile = await getStudentProfileByUserId(submission.student_id);
     if (profile) {
       const badges = Array.isArray(profile.badges) ? profile.badges : [];
       if (!badges.includes('Top Scorer')) {
         badges.push('Top Scorer');
       }
       await updateRecord(`student_profiles/${profile.id}`, {
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

       const profile = await getStudentProfileByUserId(entry.studentId);
       if (profile) {
         await updateRecord(`student_profiles/${profile.id}`, {
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

  return res.json({ success: true, records, items: records });
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

  // Filter based on role
  if (req.user.role === 'student') {
    const { getStudentProfileByUserId } = await import('../utils/firebaseDb.js');
    const profile = await getStudentProfileByUserId(req.user.id);
    const baseClassId = profile?.class_id || `class-${profile?.grade || '10'}-${(profile?.section || 'a').toLowerCase()}`;
    const normalizedClassId = baseClassId.startsWith('class-') ? baseClassId : `class-${baseClassId.toLowerCase()}`;

    announcements = announcements.filter(a =>
      a.scope === 'all' ||
      (a.scope === 'class' && (a.class_id === normalizedClassId || a.class_id === baseClassId))
    );
  }

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

  res.json({ success: true, announcements: items, items, total, page, limit });
});

// ── Messaging ──
export const sendMessage = asyncHandler(async (req, res) => {
  if (!req.body.recipientId && !req.body.classId) {
    throw new ApiError(400, 'recipientId is required for direct messages');
  }

  const userId = req.user.id;
  const messageId = Date.now().toString();
  const message = {
    id: messageId,
    sender_id: userId,
    recipient_id: req.body.recipientId || null,
    class_id: req.body.classId || null,
    content: req.body.content,
    read_by: [userId],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`messages/${messageId}`, message);

  if (req.io) {
    const rid = req.body.recipientId;
    if (rid) req.io.to(`user:${rid}`).emit('message:new', message);
    req.io.to(`user:${userId}`).emit('message:new', message);
    if (req.body.classId) req.io.to(`class:${req.body.classId}`).emit('message:new', message);
  }

  res.status(201).json({ success: true, message });
});

export const markMessageRead = asyncHandler(async (req, res) => {
  const existing = await getRecord(`messages/${req.params.messageId}`);
  if (!existing) throw new ApiError(404, 'Message not found');

  // Get user ID from header, query param, or req.user (if authenticated)
  const userId = req.headers['x-user-id'] || req.query.userId || req.user?.id;
  if (!userId) throw new ApiError(400, 'userId is required (via header x-user-id, query param, or auth)');

  const readBy = Array.isArray(existing.read_by) ? existing.read_by : [];
  if (!readBy.includes(userId)) {
    readBy.push(userId);
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
const normalizeClassId = (id) => {
  if (!id) return id;
  // Convert formats like "10-A" → "class-10-a", "class-10-a" stays "class-10-a"
  const normalized = String(id).replace(/^(\d+)-([A-Z])$/i, 'class-$1-$2').toLowerCase();
  return normalized === String(id).toLowerCase() ? id : normalized;
};

export const getTimetable = asyncHandler(async (req, res) => {
  let classId = req.query.classId || req.query.class_id;
  // Fall back to user's enrolled class if no classId provided
  if (!classId && req.user?.class) {
    classId = req.user.class;
  }
if (!classId) {
     // Try to get the student's class from their profile
     try {
       const profile = await getStudentProfileByUserId(req.user.id);
       if (profile?.class_id) classId = profile.class_id;
       else if (profile?.class) classId = profile.class;
       else if (profile?.grade) classId = `class-${profile.grade}-${profile.section || 'a'}`;
     } catch {}
   }
  if (!classId) throw new ApiError(400, 'classId is required');

  const normalizeClassId = (id) => {
    if (!id) return id;
    const normalized = String(id).replace(/^(\d+)-([A-Z])$/i, 'class-$1-$2').toLowerCase();
    return normalized === String(id).toLowerCase() ? id : normalized;
  };

  // Try multiple key patterns
  const keys = [classId, normalizeClassId(classId), 'class-10-a', 'class-10-b'].filter(Boolean);
  let timetable = null;
  for (const key of keys) {
    const tt = await getRecord(`timetables/${key}`);
    if (tt && Object.keys(tt).length > 0) {
      timetable = tt;
      classId = key;
      break;
    }
  }

  if (!timetable) return res.json({ success: true, entries: [] });

  let entries = typeof timetable.entries === 'string'
    ? JSON.parse(timetable.entries)
    : timetable.entries;

  // Handle extendedSeed date-keyed format: { "2026-05-11": { day: "Monday", periods: [...] } }
  if (!Array.isArray(entries) || entries.length === 0) {
    const dateEntries = Object.values(timetable).filter(v => v && typeof v === 'object' && v.day && Array.isArray(v.periods));
    if (dateEntries.length > 0) {
      const daysSeen = new Set();
      entries = [];
      for (const de of dateEntries) {
        if (daysSeen.has(de.day)) continue;
        daysSeen.add(de.day);
        for (const p of de.periods) {
          if (p.subject_name || p.subject_id) {
            entries.push({
              day: de.day,
              period: String(p.period),
              subject: p.subject_name || p.subject_id || '',
              teacherId: p.teacher_id || '',
              room: p.room || '',
              startTime: p.start,
              endTime: p.end,
            });
          }
        }
      }
    }
  }

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

  // Normalize classId so timetable is stored consistently
  const normalizedClassId = normalizeClassId(classId);

  const timetable = {
    id: normalizedClassId,
    class_id: normalizedClassId,
    entries: JSON.stringify(entries),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`timetables/${normalizedClassId}`, timetable);
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

// ── Get Expanded Student Profile ──
export const getExpandedStudentProfile = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.user.id;

// Get user and profile data
   const user = await getRecord(`users/${studentId}`);
   const profile = await getStudentProfileByUserId(studentId);

  if (!user) throw new ApiError(404, 'Student not found');

  // Get parent information
  let mother = null;
  let father = null;

  if (profile?.mother_id) {
    mother = await getRecord(`parents/${profile.mother_id}`);
  }
  if (profile?.father_id) {
    father = await getRecord(`parents/${profile.father_id}`);
  }

  // Format the response
  res.json({
    success: true,
    profile: {
      id: studentId,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      photo: user.photo || null,
      avatar: user.avatar || '',
      
      // Personal Information
      admissionNumber: profile?.admission_no || profile?.admission_number || '',
      rollNumber: profile?.roll_number || profile?.rollNumber || '',
      dateOfBirth: profile?.date_of_birth || profile?.dob || null,
      bloodGroup: profile?.blood_group || profile?.bloodGroup || '',
      religion: profile?.religion || '',
      nationality: profile?.nationality || '',
      
      // Academic Information
      class: profile?.class || profile?.grade || '',
      classId: profile?.class_id || profile?.classId || '',
      section: profile?.section || '',
      
      // Identification
      aadharNumber: profile?.aadhar_number || profile?.aadharNumber || '',
      pen: profile?.pen || '',
      apaarId: profile?.apaar_id || profile?.apaarId || '',
      
      // Parent Information
      mother: mother ? {
        fullName: mother.full_name || mother.fullName || '',
        phone: mother.phone || '',
        photo: mother.photo || null,
        houseName: mother.house_name || mother.houseName || '',
        address: mother.address || '',
        houseLocation: mother.house_location || mother.houseLocation || '',
      } : null,
      
      father: father ? {
        fullName: father.full_name || father.fullName || '',
        phone: father.phone || '',
        photo: father.photo || null,
        houseName: father.house_name || father.houseName || '',
        address: father.address || '',
        houseLocation: father.house_location || father.houseLocation || '',
      } : null,
      
      // Additional Info
      attendancePercent: profile?.attendance_percent || 100,
      xp: profile?.xp || 0,
      badges: profile?.badges || [],
      joinedAt: user.joined_at || user.created_at || '',
    },
  });
});

export const getStreamToken = asyncHandler(async (req, res) => {
  const serverClient = StreamChat.getInstance(env.STREAM_API_KEY, env.STREAM_API_SECRET);
  // Get user ID from query param, header, body, or use a default
  let userId = req.query.userId || req.headers['x-user-id'] || req.body?.userId || req.user?.id || 'anonymous';
  
  // Sanitize user ID to match frontend sanitization (alphanumeric, underscore, dash only)
  // This ensures the token's user_id claim matches the ID used to connect to Stream Chat
  userId = String(userId)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 64);
  
const token = serverClient.createToken(userId);
   res.json({ success: true, token, apiKey: env.STREAM_API_KEY });
});

// ── Stationery / Supplies Needed (on assignments) ──
export const createAssignmentWithSupplies = asyncHandler(async (req, res) => {
  const { title, description, subject, classId, dueDate, maxMarks, suppliesNeeded, notifyParents, notifyDaysBefore } = req.body;

  const assignmentId = Date.now().toString();
  const assignment = {
    id: assignmentId,
    title,
    description,
    subject,
    class_id: classId,
    teacher_id: req.user.id,
    due_date: dueDate,
    max_marks: maxMarks,
    supplies_needed: suppliesNeeded || [],
    notify_parents: notifyParents || false,
    notify_days_before: notifyDaysBefore || 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`assignments/${assignmentId}`, assignment);

  // If supplies flag is set, notify parents of all students in the class
  if (notifyParents && suppliesNeeded && suppliesNeeded.length > 0) {
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const students = await getRecords('student_profiles');
    const users = await getRecords('users');

    const studentIds = enrollments.map(e => e.student_id);
    const notifyUserIds = [];

    for (const sid of studentIds) {
      const student = students.find(s => s.user_id === sid || s.id === sid);
      if (student) {
        const parentId = student.mother_id || student.father_id;
        if (parentId) {
          const parentProfile = await getRecord(`parents/${parentId}`);
          if (parentProfile) {
            notifyUserIds.push(parentProfile.user_id);
          }
        }
      }
    }

    // Send notifications to unique parent IDs
    const uniqueParentIds = [...new Set(notifyUserIds)];
    const io = req.io;
    const supplyList = suppliesNeeded.join(', ');
    const dueDateFormatted = new Date(dueDate).toLocaleDateString();

    for (const parentUserId of uniqueParentIds) {
      const notification = {
        id: `stat-${Date.now()}-${parentUserId}`,
        user_id: parentUserId,
        message: `📦 Stationery Alert: "${title}" due ${dueDateFormatted}. Your child needs: ${supplyList}`,
        type: 'supplies',
        meta: { assignmentId, supplies: suppliesNeeded, classId, priority: 'warning' },
        read: false,
        created_by: req.user.id,
        created_at: new Date().toISOString(),
      };

      await createRecord('notifications', notification);

      if (io) {
        io.to(`user:${parentUserId}`).emit('notification:new', notification);
      }
    }
  }

  res.status(201).json({ success: true, assignment });
});

export const updateAssignmentSupplies = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const { suppliesNeeded, notifyParents } = req.body;

  const existing = await getRecord(`assignments/${assignmentId}`);
  if (!existing) throw new ApiError(404, 'Assignment not found');

  const updated = {
    ...existing,
    supplies_needed: suppliesNeeded || existing.supplies_needed || [],
    notify_parents: notifyParents !== undefined ? notifyParents : existing.notify_parents,
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`assignments/${assignmentId}`, updated);
  res.json({ success: true, assignment: updated });
});

// ── Book Heavy Day Alert ──
const HEAVY_BOOK_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Science'];

// Internal helper to compute book load without sending a response
const _computeBookLoad = async (classId, date, heavySubjectThreshold) => {
  const threshold = parseInt(heavySubjectThreshold) || 4;

  let timetable = await getRecord(`timetables/${classId}`);
  if (!timetable) {
    const normalized = `class-${classId.toLowerCase()}`;
    timetable = await getRecord(`timetables/${normalized}`);
  }
  if (!timetable) return { heavyDay: false, subjects: [], loadLevel: 'light' };

  let entries = typeof timetable.entries === 'string' ? JSON.parse(timetable.entries) : timetable.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { heavyDay: false, subjects: [], loadLevel: 'light' };
  }

  const targetDate = new Date(date + 'T00:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = dayNames[targetDate.getDay()];

  const todaysEntries = entries.filter(e => {
    const entryDay = e.day || (e.date && new Date(e.date).toLocaleDateString('en-US', { weekday: 'long' }));
    return entryDay === targetDay || String(e.day).toLowerCase() === targetDay.toLowerCase() || String(e.day) === targetDay;
  });

  const subjects = todaysEntries.map(e => e.subject || e.subject_name || '').filter(Boolean);
  const heavySubjects = subjects.filter(s => HEAVY_BOOK_SUBJECTS.some(h => s.toLowerCase().includes(h.toLowerCase())));

  const heavyDay = heavySubjects.length >= threshold;
  const loadLevel = heavySubjects.length >= 5 ? 'very-heavy' : heavySubjects.length >= threshold ? 'heavy' : 'light';

  return { heavyDay, loadLevel, date, day: targetDay, allSubjects: subjects, heavySubjects, totalPeriods: todaysEntries.length, heavyCount: heavySubjects.length, threshold };
};

export const analyzeBookLoad = asyncHandler(async (req, res) => {
  const { classId, date } = req.params;
  const { heavySubjectThreshold } = req.query;
  const result = await _computeBookLoad(classId, date, heavySubjectThreshold);

  res.json({
    success: true,
    ...result,
    suggestion: result.heavyDay
      ? 'Consider sharing textbooks with classmates or leaving non-essential books at school.'
      : 'Normal load - no action needed.',
  });
});

export const sendBookHeavyAlert = asyncHandler(async (req, res) => {
  const { classId, date, message, heavySubjectThreshold } = req.body;

  const loadResult = await _computeBookLoad(classId, date, heavySubjectThreshold);

  if (loadResult.heavyDay) {
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const students = await getRecords('student_profiles');
    const parents = await getRecords('parents');

    const studentIds = enrollments.map(e => e.student_id);
    const notifyUserIds = [];

    for (const sid of studentIds) {
      const student = students.find(s => s.user_id === sid || s.id === sid);
      if (student) {
        const parentId = student.mother_id || student.father_id;
        if (parentId) {
          const parent = parents.find(p => p.id === parentId || p.user_id === parentId);
          if (parent) {
            notifyUserIds.push(parent.user_id);
          }
        }
      }
    }

    const uniqueParentIds = [...new Set(notifyUserIds)];
    const io = req.io;
    const alertMsg = message || `📚 Heavy Book Day Alert: ${new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}. Your child has ${loadResult.heavySubjects.length} heavy textbook subjects. Consider sharing books or leaving non-essential ones at school.`;

    for (const parentUserId of uniqueParentIds) {
      const notification = {
        id: `heavy-${Date.now()}-${parentUserId}`,
        user_id: parentUserId,
        message: alertMsg,
        type: 'book-alert',
        meta: { classId, date, heavySubjects: loadResult.heavySubjects, priority: 'info' },
        read: false,
        created_by: req.user.id,
        created_at: new Date().toISOString(),
      };

      await createRecord('notifications', notification);
      if (io) {
        io.to(`user:${parentUserId}`).emit('notification:new', notification);
      }
    }
  }

  res.json({ success: true, ...loadResult, message: 'Alert processed' });
});

// ── Digital Fridge (Shared Tasks) ──
export const createFridgeItem = asyncHandler(async (req, res) => {
  const { title, description, category, dueDate, assignedTo, priority, sharedWith } = req.body;

  const itemId = Date.now().toString();
  const item = {
    id: itemId,
    title,
    description: description || null,
    category: category || 'general',
    assignedTo: assignedTo || null,
    priority: priority || 'medium',
    sharedWith: sharedWith || [],
    status: 'pending',
    createdBy: req.user.id,
    createdByName: req.user.name,
    completedBy: null,
    completedAt: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await createRecord(`fridge_items/${itemId}`, item);

  // Notify shared users
  if (sharedWith && sharedWith.length > 0) {
    const io = req.io;
    const user = await getRecord(`users/${req.user.id}`);
    for (const targetId of sharedWith) {
      const notification = {
        id: `fridge-${Date.now()}-${targetId}`,
        user_id: targetId,
        message: `📋 ${user?.name || 'Someone'} shared: "${title}"`,
        type: 'fridge-task',
        meta: { fridgeItemId: itemId, assignedTo: targetId },
        read: false,
        created_by: req.user.id,
        created_at: new Date().toISOString(),
      };

      await createRecord('notifications', notification);
      if (io) {
        io.to(`user:${targetId}`).emit('notification:new', notification);
      }
    }
  }

  res.status(201).json({ success: true, item });
});

export const getFridgeItems = asyncHandler(async (req, res) => {
  const { userId, status, category, fromDate, toDate } = req.query;

  // Users can see their own items and items shared with them
  let items = await queryRecords('fridge_items', (item) => {
    const createdByMatch = item.createdBy === (userId || req.user.id);
    const sharedMatch = item.sharedWith && item.sharedWith.includes(req.user.id);
    return createdByMatch || sharedMatch;
  });

  if (status) items = items.filter(i => i.status === status);
  if (category) items = items.filter(i => i.category === category);
  if (fromDate) items = items.filter(i => i.created_at >= fromDate);
  if (toDate) items = items.filter(i => i.created_at <= toDate);

  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ success: true, items });
});

export const updateFridgeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { status, description, assignedTo, priority } = req.body;

  const existing = await getRecord(`fridge_items/${itemId}`);
  if (!existing) throw new ApiError(404, 'Task not found');

  // Users can only update their own tasks or tasks shared with them
  if (existing.createdBy !== req.user.id && !existing.sharedWith.includes(req.user.id)) {
    throw new ApiError(403, 'Not authorized');
  }

  const updates = {
    ...(status && { status, completedBy: status === 'completed' ? req.user.id : null, completedAt: status === 'completed' ? new Date().toISOString() : null }),
    ...(description && { description }),
    ...(assignedTo && { assignedTo }),
    ...(priority && { priority }),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`fridge_items/${itemId}`, updates);
  res.json({ success: true, item: { ...existing, ...updates } });
});

export const deleteFridgeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const existing = await getRecord(`fridge_items/${itemId}`);

  if (!existing) throw new ApiError(404, 'Task not found');
  if (existing.createdBy !== req.user.id) throw new ApiError(403, 'Not authorized');

  await deleteRecord(`fridge_items/${itemId}`);
  res.json({ success: true, message: 'Task deleted' });
});

// ── Uniform Schedule ──
export const createUniformSchedule = asyncHandler(async (req, res) => {
  const { classId, date, uniformType, customDescription, notes } = req.body;

  // Check for existing
  const existing = await queryRecords('uniform_schedules', (s) => s.class_id === classId && s.date === date);
  if (existing.length > 0) {
    throw new ApiError(409, 'Uniform schedule already exists for this date and class');
  }

  const scheduleId = Date.now().toString();
  const schedule = {
    id: scheduleId,
    class_id: classId,
    date,
    uniform_type: uniformType,
    custom_description: customDescription || null,
    notes: notes || null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await createRecord(`uniform_schedules/${scheduleId}`, schedule);
  res.status(201).json({ success: true, schedule });
});

export const getUniformSchedule = asyncHandler(async (req, res) => {
  const { classId, date } = req.params;

  let schedules;
  if (date) {
    schedules = await queryRecords('uniform_schedules', (s) => s.class_id === classId && s.date === date);
  } else {
    schedules = await queryRecords('uniform_schedules', (s) => s.class_id === classId);
  }

  res.json({ success: true, schedules: schedules.length > 0 ? schedules : null });
});

export const getTodaysUniform = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const allSchedules = await getRecords('uniform_schedules');
  const todaysSchedules = allSchedules.filter(s => s.date === today);
  res.json({ success: true, schedules: todaysSchedules });
});
