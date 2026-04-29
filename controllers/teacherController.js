import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, deleteRecord, batchWrite } from '../utils/firebaseDb.js';
import { getIO } from '../utils/socket.js';

// ============================================================================
// QUICK ATTENDANCE MARKING - Mark attendance for entire class in one view
// ============================================================================

export const getClassAttendanceView = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { date } = req.query;
  
  if (!classId) {
    throw new ApiError(400, 'classId is required');
  }
  
  const attendanceDate = date || new Date().toISOString().split('T')[0];
  
  // Get all students in the class
  const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
  const studentIds = enrollments.map((e) => e.student_id);
  
  if (!studentIds.length) {
    return res.json({ success: true, students: [], date: attendanceDate });
  }
  
  // Get student profiles
  let students = await getRecords('student_profiles');
  students = students.filter(s => studentIds.includes(s.user_id));
  
  // Enrich with user data
  const enrichedStudents = await Promise.all(
    students.map(async (student) => {
      const user = await getRecord(`users/${student.user_id}`);
      return {
        id: student.user_id,
        name: user?.name || 'Unknown',
        rollNumber: student.roll_number,
        attendancePercent: student.attendance_percent || 100,
      };
    })
  );
  
  // Get existing attendance for this date
  const existingAttendance = await queryRecords('attendance_records', (r) => 
    r.class_id === classId && r.date === attendanceDate
  );
  
  // Map attendance status to students
  const attendanceMap = {};
  existingAttendance.forEach(record => {
    attendanceMap[record.student_id] = record.status;
  });
  
  const studentsWithStatus = enrichedStudents.map(student => ({
    ...student,
    status: attendanceMap[student.id] || 'absent', // Default to absent
  }));
  
  res.json({
    success: true,
    date: attendanceDate,
    classId,
    students: studentsWithStatus,
    summary: {
      total: studentsWithStatus.length,
      present: studentsWithStatus.filter(s => s.status === 'present').length,
      absent: studentsWithStatus.filter(s => s.status === 'absent').length,
      late: studentsWithStatus.filter(s => s.status === 'late').length,
      excused: studentsWithStatus.filter(s => s.status === 'excused').length,
    }
  });
});

export const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { classId, date, entries } = req.body;
  
  if (!classId || !date || !Array.isArray(entries)) {
    throw new ApiError(400, 'classId, date, and entries array are required');
  }
  
  const normalizedDate = date.split('T')[0];
  const teacherId = req.user.id;
  
  // Create attendance records
  const operations = entries.map((entry) => {
    const recordId = `${classId}_${entry.studentId}_${normalizedDate}`;
    return {
      path: `attendance_records/${recordId}`,
      data: {
        id: recordId,
        class_id: classId,
        student_id: entry.studentId,
        teacher_id: teacherId,
        date: normalizedDate,
        status: entry.status,
        notes: entry.notes || '',
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
      const presentOrLate = records.filter(r => ['present', 'late', 'excused'].includes(r.status)).length;
      const attendancePercent = records.length > 0 ? Math.round((presentOrLate / records.length) * 100) : 100;
      
      await updateRecord(`student_profiles/${entry.studentId}`, {
        attendance_percent: attendancePercent,
      });
    })
  );
  
  // Emit real-time update
  const io = getIO();
  if (io) {
    io.to(`class:${classId}`).emit('attendance:updated', { classId, date: normalizedDate });
  }
  
  res.json({ success: true, message: 'Attendance marked successfully' });
});

// ============================================================================
// BULK GRADING - Grade multiple submissions efficiently with templates
// ============================================================================

export const createGradingTemplate = asyncHandler(async (req, res) => {
  const { name, subject, criteria, rubric } = req.body;
  
  if (!name || !criteria) {
    throw new ApiError(400, 'Template name and criteria are required');
  }
  
  const templateId = Date.now().toString();
  const template = {
    id: templateId,
    name,
    subject: subject || '',
    criteria, // Array of { name, maxPoints, weight }
    rubric: rubric || {}, // { score_range: { feedback, grade } }
    teacher_id: req.user.id,
    is_public: req.body.isPublic || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`grading_templates/${templateId}`, template);
  res.status(201).json({ success: true, template });
});

export const getGradingTemplates = asyncHandler(async (req, res) => {
  let templates = await getRecords('grading_templates');
  
  // Filter by teacher or public templates
  templates = templates.filter(t => 
    t.teacher_id === req.user.id || t.is_public === true
  );
  
  if (req.query.subject) {
    templates = templates.filter(t => t.subject === req.query.subject);
  }
  
  templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json({ success: true, templates });
});

export const bulkGradeSubmissions = asyncHandler(async (req, res) => {
  const { assignmentId, grades, templateId, quickFeedback } = req.body;
  
  if (!assignmentId || !Array.isArray(grades)) {
    throw new ApiError(400, 'assignmentId and grades array are required');
  }
  
  const assignment = await getRecord(`assignments/${assignmentId}`);
  if (!assignment) {
    throw new ApiError(404, 'Assignment not found');
  }
  
  const template = templateId ? await getRecord(`grading_templates/${templateId}`) : null;
  
  // Grade each submission
  const updatedSubmissions = await Promise.all(
    grades.map(async (gradeEntry) => {
      const submission = await getRecord(`submissions/${gradeEntry.submissionId}`);
      if (!submission) return null;
      
      let feedback = gradeEntry.feedback || '';
      let marks = gradeEntry.marks;
      
      // Apply template-based grading if template provided
      if (template && !marks) {
        const criteriaScores = gradeEntry.criteriaScores || {};
        marks = Object.values(criteriaScores).reduce((sum, score) => sum + (score || 0), 0);
        
        // Generate feedback from rubric
        if (template.rubric) {
          const maxPossible = template.criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);
          const percentage = (marks / maxPossible) * 100;
          const rubricEntry = Object.entries(template.rubric)
            .find(([range]) => {
              const [min, max] = range.split('-').map(Number);
              return percentage >= min && percentage <= max;
            });
          if (rubricEntry) {
            feedback = rubricEntry[1].feedback || feedback;
          }
        }
      }
      
      // Add quick feedback template if selected
      if (quickFeedback && !feedback.includes(quickFeedback)) {
        feedback = feedback ? `${quickFeedback}\n${feedback}` : quickFeedback;
      }
      
      const updated = {
        ...submission,
        marks,
        feedback,
        graded_by: req.user.id,
        graded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      await updateRecord(`submissions/${gradeEntry.submissionId}`, updated);
      return updated;
    })
  );
  
  // Award XP for graded submissions
  await Promise.all(
    updatedSubmissions.filter(Boolean).map(async (submission) => {
      const profile = await getRecord(`student_profiles/${submission.student_id}`);
      if (profile) {
        await updateRecord(`student_profiles/${submission.student_id}`, {
          xp: (profile.xp || 0) + 15, // XP for getting work graded
        });
      }
    })
  );
  
  // Emit real-time update
  const io = getIO();
  if (io) {
    io.to(`class:${assignment.class_id}`).emit('submissions:graded', { assignmentId });
  }
  
  res.json({ 
    success: true, 
    message: `${updatedSubmissions.filter(Boolean).length} submissions graded`,
    graded: updatedSubmissions.filter(Boolean)
  });
});

// ============================================================================
// CLASS PERFORMANCE ANALYTICS - View class-level metrics and trends
// ============================================================================

export const getClassPerformanceAnalytics = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { term, subject } = req.query;
  
  // Get all students in the class
  const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
  const studentIds = enrollments.map((e) => e.student_id);
  
  if (!studentIds.length) {
    return res.json({ success: true, analytics: null });
  }
  
  // Get all marks for this class
  let marks = await getRecords('marks');
  marks = marks.filter(m => studentIds.includes(m.student_id));
  
  if (subject) {
    marks = marks.filter(m => m.subject === subject);
  }
  
  if (term) {
    marks = marks.filter(m => m.term === term);
  }
  
  // Calculate class averages per subject
  const subjectAverages = {};
  marks.forEach(mark => {
    if (!subjectAverages[mark.subject]) {
      subjectAverages[mark.subject] = { total: 0, count: 0, scores: [] };
    }
    subjectAverages[mark.subject].total += Number(mark.score);
    subjectAverages[mark.subject].count += 1;
    subjectAverages[mark.subject].scores.push(Number(mark.score));
  });
  
  const averages = Object.entries(subjectAverages).map(([subject, data]) => ({
    subject,
    average: (data.total / data.count).toFixed(2),
    highest: data.scores.length > 0 ? Math.max(...data.scores) : 0,
    lowest: data.scores.length > 0 ? Math.min(...data.scores) : 0,
    standardDeviation: calculateStdDev(data.scores).toFixed(2),
    studentCount: data.count,
  }));
  
  // Get attendance data
  const attendanceRecords = await queryRecords('attendance_records', (r) => r.class_id === classId);
  const attendanceByStudent = {};
  attendanceRecords.forEach(record => {
    if (!attendanceByStudent[record.student_id]) {
      attendanceByStudent[record.student_id] = { total: 0, present: 0 };
    }
    attendanceByStudent[record.student_id].total += 1;
    if (['present', 'late', 'excused'].includes(record.status)) {
      attendanceByStudent[record.student_id].present += 1;
    }
  });
  
  const attendanceRates = Object.values(attendanceByStudent).map(data => 
    data.total > 0 ? (data.present / data.total) * 100 : 100
  );
  const avgAttendance = attendanceRates.length > 0 
    ? (attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length).toFixed(2)
    : 0;
  
  // Get submission/assignment completion rates
  const assignments = await queryRecords('assignments', (a) => a.class_id === classId);
  const submissions = await queryRecords('submissions', (s) => 
    assignments.some(a => a.id === s.assignment_id)
  );
  
  const completionRate = assignments.length > 0
    ? (submissions.length / (assignments.length * studentIds.length) * 100).toFixed(2)
    : 0;
  
  res.json({
    success: true,
    analytics: {
      classId,
      studentCount: studentIds.length,
      academicPerformance: {
        subjectAverages: averages,
        classAverage: averages.length > 0
          ? (averages.reduce((sum, a) => sum + parseFloat(a.average), 0) / averages.length).toFixed(2)
          : 0,
      },
      attendance: {
        averageRate: avgAttendance,
        below75Percent: attendanceRates.filter(r => r < 75).length,
      },
      engagement: {
        assignmentCompletionRate: completionRate,
        totalAssignments: assignments.length,
        totalSubmissions: submissions.length,
      },
      gradeDistribution: calculateGradeDistribution(marks),
    }
  });
});

export const getClassTrends = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { months = 6 } = req.query;
  
  const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
  const studentIds = enrollments.map((e) => e.student_id);
  
  // Get marks from past N months
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - parseInt(months));
  
  let marks = await getRecords('marks');
  marks = marks.filter(m => 
    studentIds.includes(m.student_id) && 
    new Date(m.created_at) >= cutoffDate
  );
  
  // Group by month
  const monthlyPerformance = {};
  marks.forEach(mark => {
    const month = new Date(mark.created_at).toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyPerformance[month]) {
      monthlyPerformance[month] = [];
    }
    monthlyPerformance[month].push(Number(mark.score));
  });
  
  const trends = Object.entries(monthlyPerformance)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      month,
      averageScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
      submissionCount: scores.length,
    }));
  
  res.json({ success: true, trends });
});

// ============================================================================
// STUDENT PROGRESS TRACKING - Monitor individual student progress over time
// ============================================================================

export const getStudentProgress = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { term } = req.query;
  
  const student = await getRecord(`student_profiles/${studentId}`);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }
  
  const user = await getRecord(`users/${student.user_id}`);
  
  // Get all marks
  let marks = await queryRecords('marks', (m) => m.student_id === studentId);
  
  if (term) {
    marks = marks.filter(m => m.term === term);
  }
  
  // Calculate subject-wise progress
  const subjectProgress = {};
  marks.forEach(mark => {
    if (!subjectProgress[mark.subject]) {
      subjectProgress[mark.subject] = { scores: [], exams: [] };
    }
    subjectProgress[mark.subject].scores.push(Number(mark.score));
    subjectProgress[mark.subject].exams.push({
      type: mark.exam_type,
      score: Number(mark.score),
      term: mark.term,
      date: mark.created_at,
    });
  });
  
  const progressBySubject = Object.entries(subjectProgress).map(([subject, data]) => {
    const scores = data.scores;
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend = scores.length > 1 
      ? ((scores[scores.length - 1] - scores[0]) / scores[0] * 100).toFixed(2)
      : 0;
    
    return {
      subject,
      average: average.toFixed(2),
      trend: parseFloat(trend),
      trendDirection: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
      exams: data.exams.sort((a, b) => new Date(a.date) - new Date(b.date)),
    };
  });
  
  // Get attendance history
  const attendanceRecords = await queryRecords('attendance_records', (r) => r.student_id === studentId);
  attendanceRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Get submission history
  const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);
  submissions.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  
  const gradedSubmissions = submissions.filter(s => s.marks !== undefined);
  
  res.json({
    success: true,
    progress: {
      student: {
        id: studentId,
        name: user?.name || 'Unknown',
        grade: student.grade,
        section: student.section,
        attendancePercent: student.attendance_percent || 100,
        xp: student.xp || 0,
        badges: student.badges || [],
      },
      academicProgress: progressBySubject,
      attendanceHistory: attendanceRecords.slice(-30), // Last 30 records
      submissionHistory: {
        total: submissions.length,
        graded: gradedSubmissions.length,
        pending: submissions.length - gradedSubmissions.length,
        recent: gradedSubmissions.slice(-10).map(s => ({
          assignmentId: s.assignment_id,
          marks: s.marks,
          feedback: s.feedback,
          submittedAt: s.submitted_at,
          gradedAt: s.graded_at,
        })),
      },
    }
  });
});

export const getStudentProgressTimeline = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  // Get all relevant data
  const marks = await queryRecords('marks', (m) => m.student_id === studentId);
  const attendance = await queryRecords('attendance_records', (r) => r.student_id === studentId);
  const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);
  
  // Create timeline of events
  const events = [];
  
  marks.forEach(mark => {
    events.push({
      type: 'assessment',
      date: mark.created_at,
      details: {
        subject: mark.subject,
        examType: mark.exam_type,
        score: mark.score,
        term: mark.term,
      }
    });
  });
  
  attendance.forEach(record => {
    if (record.status === 'absent') {
      events.push({
        type: 'attendance',
        date: record.date,
        details: { status: record.status }
      });
    }
  });
  
  submissions.forEach(sub => {
    events.push({
      type: 'submission',
      date: sub.submitted_at,
      details: {
        assignmentId: sub.assignment_id,
        isLate: sub.is_late,
        marks: sub.marks,
        graded: sub.marks !== undefined,
      }
    });
  });
  
  // Sort by date descending
  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.json({ success: true, timeline: events.slice(-50) }); // Last 50 events
});

// ============================================================================
// AUTOMATED NOTIFICATIONS - Get alerts for important events and deadlines
// ============================================================================

export const createNotification = asyncHandler(async (req, res) => {
  const { type, title, message, targetUsers, classId, scheduledAt } = req.body;
  
  const notificationId = Date.now().toString();
  const notification = {
    id: notificationId,
    type, // 'assignment_due', 'low_attendance', 'poor_performance', 'announcement', 'custom'
    title,
    message,
    target_users: targetUsers || [], // Array of user IDs, or empty for all
    class_id: classId || null,
    scheduled_at: scheduledAt || null,
    sent_at: null,
    read_by: [],
    created_by: req.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`notifications/${notificationId}`, notification);
  
  // If not scheduled, send immediately
  if (!scheduledAt) {
    await sendNotification(notification);
  }
  
  res.status(201).json({ success: true, notification });
});

export const getMyNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, skip } = parsePagination(req.query);
  
  let notifications = await queryRecords('notifications', (n) => 
    n.target_users.length === 0 || n.target_users.includes(userId)
  );
  
  // Sort by created_at descending
  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Mark as read
  const unreadIds = notifications
    .filter(n => !n.read_by?.includes(userId) && !n.scheduled_at)
    .map(n => n.id);
  
  if (unreadIds.length > 0) {
    await Promise.all(
      unreadIds.map(id => {
        const notification = notifications.find(n => n.id === id);
        const readBy = [...(notification.read_by || []), userId];
        return updateRecord(`notifications/${id}`, { read_by: readBy });
      })
    );
  }
  
  const total = notifications.length;
  const items = notifications.slice(skip, skip + limit);
  
  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const notifications = await queryRecords('notifications', (n) => 
    n.target_users.length === 0 || n.target_users.includes(userId)
  );
  
  const unreadCount = notifications.filter(n => 
    !n.read_by?.includes(userId) && !n.scheduled_at
  ).length;
  
  res.json({ success: true, unreadCount });
});

// Automated notification checks (to be called periodically)
export const checkAutomatedNotifications = asyncHandler(async (req, res) => {
  // Check for upcoming assignment deadlines (24 hours)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const assignments = await getRecords('assignments');
  const upcomingDeadlines = assignments.filter(a => 
    new Date(a.due_date) <= tomorrow && 
    new Date(a.due_date) >= new Date()
  );
  
  // Check for low attendance students
  const students = await getRecords('student_profiles');
  const lowAttendanceStudents = students.filter(s => 
    (s.attendance_percent || 100) < 75
  );
  
  // Check for poor performance
  const marks = await getRecords('marks');
  const failingMarks = marks.filter(m => Number(m.score) < 45);
  
  const alerts = {
    upcomingDeadlines: upcomingDeadlines.length,
    lowAttendance: lowAttendanceStudents.length,
    poorPerformance: new Set(failingMarks.map(m => m.student_id)).size,
  };
  
  res.json({ success: true, alerts });
});

// ============================================================================
// CLASS NOTES ORGANIZATION - Organize and share teaching materials
// ============================================================================

export const createClassNote = asyncHandler(async (req, res) => {
  const { classId, title, content, category, tags } = req.body;
  
  if (!classId || !title) {
    throw new ApiError(400, 'classId and title are required');
  }
  
  const noteId = Date.now().toString();
  const note = {
    id: noteId,
    class_id: classId,
    title,
    content: content || '',
    category: category || 'general', // 'lecture', 'homework', 'resource', 'announcement'
    tags: tags || [],
    attachments: (req.files || []).map(file => ({
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename || file.originalname}`,
    })),
    created_by: req.user.id,
    is_pinned: req.body.isPinned || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`class_notes/${noteId}`, note);
  
  // Emit real-time update
  const io = getIO();
  if (io) {
    io.to(`class:${classId}`).emit('notes:updated', { classId });
  }
  
  res.status(201).json({ success: true, note });
});

export const getClassNotes = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { category, tag, page, limit, skip } = req.query;
  
  let notes = await queryRecords('class_notes', (n) => n.class_id === classId);
  
  if (category) {
    notes = notes.filter(n => n.category === category);
  }
  
  if (tag) {
    notes = notes.filter(n => n.tags?.includes(tag));
  }
  
  // Sort by pinned then by date
  notes.sort((a, b) => {
    if (b.is_pinned !== a.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  const total = notes.length;
  const items = notes.slice(skip || 0, (skip || 0) + (limit || 20));
  
  // Enrich with creator info
  const enrichedItems = await Promise.all(
    items.map(async (note) => {
      const creator = await getRecord(`users/${note.created_by}`);
      return {
        ...note,
        creatorName: creator?.name || 'Unknown',
      };
    })
  );
  
  res.json({ 
    success: true, 
    ...buildPaginatedResponse({ items: enrichedItems, total, page: page || 1, limit: limit || 20 }) 
  });
});

export const updateClassNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const note = await getRecord(`class_notes/${noteId}`);
  
  if (!note) {
    throw new ApiError(404, 'Note not found');
  }
  
  // Only creator can update
  if (note.created_by !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to update this note');
  }
  
  const updates = {
    title: req.body.title ?? note.title,
    content: req.body.content ?? note.content,
    category: req.body.category ?? note.category,
    tags: req.body.tags ?? note.tags,
    is_pinned: req.body.isPinned ?? note.is_pinned,
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`class_notes/${noteId}`, updates);
  
  res.json({ success: true, note: { ...note, ...updates } });
});

export const deleteClassNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;
  const note = await getRecord(`class_notes/${noteId}`);
  
  if (!note) {
    throw new ApiError(404, 'Note not found');
  }
  
  if (note.created_by !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this note');
  }
  
  await deleteRecord(`class_notes/${noteId}`);
  
  res.json({ success: true, message: 'Note deleted' });
});

// ============================================================================
// QUICK MESSAGING - Send messages to students/parents with templates
// ============================================================================

export const getMessageTemplates = asyncHandler(async (req, res) => {
  let templates = await getRecords('message_templates');
  
  // Filter by teacher or public templates
  templates = templates.filter(t => 
    t.teacher_id === req.user.id || t.is_public === true
  );
  
  if (req.query.category) {
    templates = templates.filter(t => t.category === req.query.category);
  }
  
  templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json({ success: true, templates });
});

export const createMessageTemplate = asyncHandler(async (req, res) => {
  const { name, category, subject, body } = req.body;
  
  if (!name || !body) {
    throw new ApiError(400, 'Template name and body are required');
  }
  
  const templateId = Date.now().toString();
  const template = {
    id: templateId,
    name,
    category: category || 'general', // 'reminder', 'feedback', 'appreciation', 'concern'
    subject: subject || '',
    body,
    variables: req.body.variables || [], // Array of variable names like {{student_name}}
    teacher_id: req.user.id,
    is_public: req.body.isPublic || false,
    usage_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`message_templates/${templateId}`, template);
  res.status(201).json({ success: true, template });
});

export const sendQuickMessage = asyncHandler(async (req, res) => {
  const { recipientId, classId, templateId, content, variables } = req.body;
  
  if (!recipientId && !classId) {
    throw new ApiError(400, 'recipientId or classId is required');
  }
  
  let messageContent = content;
  
  // Apply template if provided
  if (templateId) {
    const template = await getRecord(`message_templates/${templateId}`);
    if (!template) {
      throw new ApiError(404, 'Template not found');
    }
    
    messageContent = template.body;
    
    // Replace variables
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        messageContent = messageContent.replace(`{{${key}}}`, value);
      });
    }
    
    // Update usage count
    await updateRecord(`message_templates/${templateId}`, {
      usage_count: (template.usage_count || 0) + 1,
    });
  }
  
  const messageId = Date.now().toString();
  const message = {
    id: messageId,
    sender_id: req.user.id,
    recipient_id: recipientId || null,
    class_id: classId || null,
    content: messageContent,
    template_id: templateId || null,
    read_by: [req.user.id],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await updateRecord(`messages/${messageId}`, message);
  
  // Emit real-time update
  const io = getIO();
  if (io) {
    if (recipientId) {
      io.to(`user:${recipientId}`).emit('message:new', message);
    }
    io.to(`user:${req.user.id}`).emit('message:new', message);
    if (classId) {
      io.to(`class:${classId}`).emit('message:new', message);
    }
  }
  
  res.status(201).json({ success: true, message });
});

// ============================================================================
// PERFORMANCE REPORTS - Generate comprehensive reports in multiple formats
// ============================================================================

export const generateClassReport = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { format = 'json', term } = req.query;
  
  if (!classId) {
    throw new ApiError(400, 'classId is required');
  }
  
  // Get all students in the class
  const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
  const studentIds = enrollments.map((e) => e.student_id);
  
  if (!studentIds.length) {
    return res.json({ success: true, report: null, message: 'No students in class' });
  }
  
  // Get all marks for this class
  let marks = await getRecords('marks');
  marks = marks.filter(m => studentIds.includes(m.student_id));
  
  if (term) {
    marks = marks.filter(m => m.term === term);
  }
  
  // Calculate class averages per subject
  const subjectAverages = {};
  marks.forEach(mark => {
    if (!subjectAverages[mark.subject]) {
      subjectAverages[mark.subject] = { total: 0, count: 0, scores: [] };
    }
    subjectAverages[mark.subject].total += Number(mark.score);
    subjectAverages[mark.subject].count += 1;
    subjectAverages[mark.subject].scores.push(Number(mark.score));
  });
  
  const averages = Object.entries(subjectAverages).map(([subject, data]) => ({
    subject,
    average: (data.total / data.count).toFixed(2),
    highest: data.scores.length > 0 ? Math.max(...data.scores) : 0,
    lowest: data.scores.length > 0 ? Math.min(...data.scores) : 0,
    standardDeviation: calculateStdDev(data.scores).toFixed(2),
    studentCount: data.count,
  }));
  
  // Get attendance data
  const attendanceRecords = await queryRecords('attendance_records', (r) => r.class_id === classId);
  const attendanceByStudent = {};
  attendanceRecords.forEach(record => {
    if (!attendanceByStudent[record.student_id]) {
      attendanceByStudent[record.student_id] = { total: 0, present: 0 };
    }
    attendanceByStudent[record.student_id].total += 1;
    if (['present', 'late', 'excused'].includes(record.status)) {
      attendanceByStudent[record.student_id].present += 1;
    }
  });
  
  const attendanceRates = Object.values(attendanceByStudent).map(data => 
    data.total > 0 ? (data.present / data.total) * 100 : 100
  );
  const avgAttendance = attendanceRates.length > 0 
    ? (attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length).toFixed(2)
    : 0;
  
  // Get submission/assignment completion rates
  const assignments = await queryRecords('assignments', (a) => a.class_id === classId);
  const submissions = await queryRecords('submissions', (s) => 
    assignments.some(a => a.id === s.assignment_id)
  );
  
  const completionRate = assignments.length > 0
    ? (submissions.length / (assignments.length * studentIds.length) * 100).toFixed(2)
    : 0;
  
  const analytics = {
    classId,
    studentCount: studentIds.length,
    academicPerformance: {
      subjectAverages: averages,
      classAverage: averages.length > 0
        ? (averages.reduce((sum, a) => sum + parseFloat(a.average), 0) / averages.length).toFixed(2)
        : 0,
    },
    attendance: {
      averageRate: avgAttendance,
      below75Percent: attendanceRates.filter(r => r < 75).length,
    },
    engagement: {
      assignmentCompletionRate: completionRate,
      totalAssignments: assignments.length,
      totalSubmissions: submissions.length,
    },
    gradeDistribution: calculateGradeDistribution(marks),
  };
  
  if (format === 'csv') {
    const csvRows = [
      'Metric,Value',
      `Total Students,${analytics.studentCount}`,
      `Class Average,${analytics.academicPerformance.classAverage}`,
      `Attendance Rate,${analytics.attendance.averageRate}%`,
      `Assignment Completion,${analytics.engagement.assignmentCompletionRate}%`,
    ];
    
    analytics.academicPerformance.subjectAverages.forEach(subject => {
      csvRows.push(`${subject.subject} Average,${subject.average}`);
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=class-report-${classId}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }
  
  res.json({ success: true, report: analytics });
});

export const generateStudentReport = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { format = 'json', term } = req.query;
  
  if (!studentId) {
    throw new ApiError(400, 'studentId is required');
  }
  
  const student = await getRecord(`student_profiles/${studentId}`);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }
  
  const user = await getRecord(`users/${student.user_id}`);
  
  // Get all marks
  let marks = await queryRecords('marks', (m) => m.student_id === studentId);
  
  if (term) {
    marks = marks.filter(m => m.term === term);
  }
  
  // Calculate subject-wise progress
  const subjectProgress = {};
  marks.forEach(mark => {
    if (!subjectProgress[mark.subject]) {
      subjectProgress[mark.subject] = { scores: [], exams: [] };
    }
    subjectProgress[mark.subject].scores.push(Number(mark.score));
    subjectProgress[mark.subject].exams.push({
      type: mark.exam_type,
      score: Number(mark.score),
      term: mark.term,
      date: mark.created_at,
    });
  });
  
  const progressBySubject = Object.entries(subjectProgress).map(([subject, data]) => {
    const scores = data.scores;
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trend = scores.length > 1 
      ? ((scores[scores.length - 1] - scores[0]) / scores[0] * 100).toFixed(2)
      : 0;
    
    return {
      subject,
      average: average.toFixed(2),
      trend: parseFloat(trend),
      trendDirection: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
      exams: data.exams.sort((a, b) => new Date(a.date) - new Date(b.date)),
    };
  });
  
  // Get attendance history
  const attendanceRecords = await queryRecords('attendance_records', (r) => r.student_id === studentId);
  attendanceRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Get submission history
  const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);
  submissions.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  
  const gradedSubmissions = submissions.filter(s => s.marks !== undefined);
  
  const progress = {
    student: {
      id: studentId,
      name: user?.name || 'Unknown',
      grade: student.grade,
      section: student.section,
      attendancePercent: student.attendance_percent || 100,
      xp: student.xp || 0,
      badges: student.badges || [],
    },
    academicProgress: progressBySubject,
    attendanceHistory: attendanceRecords.slice(-30),
    submissionHistory: {
      total: submissions.length,
      graded: gradedSubmissions.length,
      pending: submissions.length - gradedSubmissions.length,
      recent: gradedSubmissions.slice(-10).map(s => ({
        assignmentId: s.assignment_id,
        marks: s.marks,
        feedback: s.feedback,
        submittedAt: s.submitted_at,
        gradedAt: s.graded_at,
      })),
    },
  };
  
  if (format === 'csv') {
    const csvRows = ['Subject,Average,Trend'];
    progress.academicProgress.forEach(subject => {
      csvRows.push(`${subject.subject},${subject.average},${subject.trend}%`);
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=student-report-${studentId}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }
  
  res.json({ success: true, report: progress });
});

// ============================================================================
// PRODUCTIVITY DASHBOARD - Centralized view with quick-access tools
// ============================================================================

export const getTeacherDashboard = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  
  // Get teacher's classes
  const classrooms = await getRecords('classrooms');
  const teacherClasses = classrooms.filter(c => c.teacher_id === teacherId);
  
  // Get today's attendance summary
  const today = new Date().toISOString().split('T')[0];
  let todayAttendance = { total: 0, present: 0, absent: 0 };
  
  for (const classItem of teacherClasses) {
    const records = await queryRecords('attendance_records', (r) => 
      r.class_id === classItem.id && r.date === today
    );
    todayAttendance.total += records.length;
    todayAttendance.present += records.filter(r => r.status === 'present').length;
    todayAttendance.absent += records.filter(r => r.status === 'absent').length;
  }
  
  // Get pending submissions to grade
  const assignments = await queryRecords('assignments', (a) => a.teacher_id === teacherId);
  const assignmentIds = assignments.map(a => a.id);
  const submissions = await queryRecords('submissions', (s) => 
    assignmentIds.includes(s.assignment_id)
  );
  const pendingGrading = submissions.filter(s => s.marks === undefined).length;
  
  // Get upcoming deadlines (next 7 days)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingDeadlines = assignments.filter(a => 
    new Date(a.due_date) <= nextWeek && new Date(a.due_date) >= new Date()
  );
  
  // Get recent notifications
  const notifications = await queryRecords('notifications', (n) => 
    n.target_users.length === 0 || n.target_users.includes(teacherId)
  );
  const unreadNotifications = notifications.filter(n => 
    !n.read_by?.includes(teacherId)
  ).length;
  
  // Get productivity stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const weeklyActivity = {
    attendanceMarked: await queryRecords('attendance_records', (r) => 
      r.teacher_id === teacherId && new Date(r.created_at) >= weekAgo
    ),
    submissionsGraded: submissions.filter(s => 
      s.graded_by === teacherId && s.graded_at && new Date(s.graded_at) >= weekAgo
    ).length,
    messagesSent: await queryRecords('messages', (m) => 
      m.sender_id === teacherId && new Date(m.created_at) >= weekAgo
    ).length,
  };
  
  res.json({
    success: true,
    dashboard: {
      overview: {
        totalClasses: teacherClasses.length,
        totalStudents: teacherClasses.reduce((sum, c) => sum + (c.student_count || 0), 0),
        todayAttendance,
        pendingGrading,
        unreadNotifications,
      },
      upcomingDeadlines: upcomingDeadlines.slice(0, 5).map(a => ({
        id: a.id,
        title: a.title,
        dueDate: a.due_date,
        subject: a.subject,
        className: a.class_id,
      })),
      weeklyActivity: {
        attendanceMarked: weeklyActivity.attendanceMarked.length,
        submissionsGraded: weeklyActivity.submissionsGraded,
        messagesSent: weeklyActivity.messagesSent,
      },
      quickActions: [
        { action: 'mark_attendance', label: 'Mark Attendance', icon: 'attendance' },
        { action: 'grade_submissions', label: 'Grade Submissions', icon: 'grade', badge: pendingGrading },
        { action: 'send_message', label: 'Send Message', icon: 'message' },
        { action: 'create_assignment', label: 'Create Assignment', icon: 'assignment' },
        { action: 'view_reports', label: 'View Reports', icon: 'report' },
      ],
    }
  });
});

// ============================================================================
// DATA EXPORT & INTEGRATION - Export data to CSV/Excel
// ============================================================================

export const exportAttendanceData = asyncHandler(async (req, res) => {
  const { classId, startDate, endDate, format = 'csv' } = req.query;
  
  let records = await getRecords('attendance_records');
  
  if (classId) {
    records = records.filter(r => r.class_id === classId);
  }
  
  if (startDate) {
    records = records.filter(r => r.date >= startDate);
  }
  
  if (endDate) {
    records = records.filter(r => r.date <= endDate);
  }
  
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (format === 'csv') {
    const csvRows = ['Date,Student ID,Class ID,Status,Teacher ID'];
    records.forEach(r => {
      csvRows.push(`${r.date},${r.student_id},${r.class_id},${r.status},${r.teacher_id}`);
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance-export-${Date.now()}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }
  
  res.json({ success: true, data: records });
});

export const exportGradesData = asyncHandler(async (req, res) => {
  const { classId, subject, term, format = 'csv' } = req.query;
  
  let marks = await getRecords('marks');
  
  if (classId) {
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const studentIds = enrollments.map(e => e.student_id);
    marks = marks.filter(m => studentIds.includes(m.student_id));
  }
  
  if (subject) {
    marks = marks.filter(m => m.subject === subject);
  }
  
  if (term) {
    marks = marks.filter(m => m.term === term);
  }
  
  if (format === 'csv') {
    const csvRows = ['Student ID,Subject,Exam Type,Score,Term'];
    marks.forEach(m => {
      csvRows.push(`${m.student_id},${m.subject},${m.exam_type},${m.score},${m.term}`);
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=grades-export-${Date.now()}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }
  
  res.json({ success: true, data: marks });
});

export const exportStudentList = asyncHandler(async (req, res) => {
  const { classId, format = 'csv' } = req.query;
  
  let students = await getRecords('student_profiles');
  
  if (classId) {
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const studentIds = enrollments.map(e => e.student_id);
    students = students.filter(s => studentIds.includes(s.user_id));
  }
  
  // Enrich with user data
  const enrichedStudents = await Promise.all(
    students.map(async (student) => {
      const user = await getRecord(`users/${student.user_id}`);
      return {
        id: student.user_id,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        grade: student.grade,
        section: student.section,
        rollNumber: student.roll_number,
        attendancePercent: student.attendance_percent || 100,
        xp: student.xp || 0,
      };
    })
  );
  
  if (format === 'csv') {
    const csvRows = ['Student ID,Name,Email,Grade,Section,Roll Number,Attendance %,XP'];
    enrichedStudents.forEach(s => {
      csvRows.push(`${s.id},${s.name},${s.email},${s.grade},${s.section},${s.rollNumber},${s.attendancePercent},${s.xp}`);
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=students-export-${Date.now()}.csv`);
    return res.status(200).send(csvRows.join('\n'));
  }
  
  res.json({ success: true, data: enrichedStudents });
});

// ============================================================================
// PRODUCTIVITY INSIGHTS - AI-driven recommendations based on data
// ============================================================================

export const getProductivityInsights = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  
  // Get teacher's data
  const classrooms = await queryRecords('classrooms', (c) => c.teacher_id === teacherId);
  const classIds = classrooms.map(c => c.id);
  
  // Analyze attendance patterns
  const attendanceRecords = await queryRecords('attendance_records', (r) => 
    classIds.includes(r.class_id)
  );
  
  const attendanceByDay = {};
  attendanceRecords.forEach(r => {
    const day = new Date(r.date).getDay(); // 0 = Sunday, 1 = Monday, etc.
    if (!attendanceByDay[day]) {
      attendanceByDay[day] = { total: 0, absent: 0 };
    }
    attendanceByDay[day].total += 1;
    if (r.status === 'absent') attendanceByDay[day].absent += 1;
  });
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const attendancePatterns = Object.entries(attendanceByDay)
    .map(([day, data]) => ({
      day: dayNames[day],
      absenceRate: ((data.absent / data.total) * 100).toFixed(2),
    }))
    .sort((a, b) => parseFloat(b.absenceRate) - parseFloat(a.absenceRate));
  
  // Analyze grading patterns
  const assignments = await queryRecords('assignments', (a) => a.teacher_id === teacherId);
  const assignmentIds = assignments.map(a => a.id);
  const submissions = await queryRecords('submissions', (s) => 
    assignmentIds.includes(s.assignment_id)
  );
  
  const avgGradingTime = submissions
    .filter(s => s.graded_at && s.submitted_at)
    .map(s => (new Date(s.graded_at) - new Date(s.submitted_at)) / (1000 * 60 * 60 * 24)) // days
    .reduce((a, b) => a + b, 0) / (submissions.filter(s => s.graded_at).length || 1);
  
  // Generate insights
  const insights = [];
  
  // Attendance insights
  if (attendancePatterns.length > 0 && parseFloat(attendancePatterns[0].absenceRate) > 20) {
    insights.push({
      type: 'attendance',
      priority: 'high',
      title: 'High Absence Rate Detected',
      description: `${attendancePatterns[0].day} has a ${attendancePatterns[0].absenceRate}% absence rate. Consider investigating the cause.`,
      recommendation: 'Send a survey to students or discuss with class representatives to understand the issue.',
    });
  }
  
  // Grading insights
  if (avgGradingTime > 7) {
    insights.push({
      type: 'grading',
      priority: 'medium',
      title: 'Grading Turnaround Time',
      description: `Average grading time is ${avgGradingTime.toFixed(1)} days.`,
      recommendation: 'Consider using grading templates and bulk grading to reduce turnaround time.',
    });
  }
  
  // Performance insights
  const marks = await getRecords('marks');
  
  // Filter marks for teacher's classes
  const teacherClassMarks = [];
  for (const classId of classIds) {
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
    const studentIds = enrollments.map(e => e.student_id);
    const classMarks = marks.filter(m => studentIds.includes(m.student_id));
    teacherClassMarks.push(...classMarks);
  }
  
  if (teacherClassMarks.length > 0) {
    const lowScoringSubjects = Object.entries(
      teacherClassMarks.reduce((acc, m) => {
        if (!acc[m.subject]) acc[m.subject] = { total: 0, count: 0, lowScores: 0 };
        acc[m.subject].total += Number(m.score);
        acc[m.subject].count += 1;
        if (Number(m.score) < 50) acc[m.subject].lowScores += 1;
        return acc;
      }, {})
    )
      .map(([subject, data]) => ({
        subject,
        average: (data.total / data.count).toFixed(2),
        lowScoreRate: ((data.lowScores / data.count) * 100).toFixed(2),
      }))
      .filter(s => parseFloat(s.lowScoreRate) > 30);
    
    if (lowScoringSubjects.length > 0) {
      insights.push({
        type: 'performance',
        priority: 'high',
        title: 'Subjects Needing Attention',
        description: `${lowScoringSubjects.length} subject(s) have >30% low scores.`,
        recommendation: 'Consider additional tutoring sessions or reviewing teaching methods for these subjects.',
        details: lowScoringSubjects,
      });
    }
  }
  
  // Productivity tips
  insights.push({
    type: 'tip',
    priority: 'low',
    title: 'Productivity Tip',
    description: 'Use message templates to save time on common communications.',
    recommendation: 'Create templates for assignment reminders, appreciation messages, and parent communications.',
  });
  
  res.json({ success: true, insights });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateStdDev(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squareDiffs = numbers.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / numbers.length);
}

function calculateGradeDistribution(marks) {
  if (!Array.isArray(marks) || marks.length === 0) {
    return { A: 0, B: 0, C: 0, D: 0, F: 0 };
  }
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  
  marks.forEach(mark => {
    const score = Number(mark.score);
    if (score >= 90) distribution.A++;
    else if (score >= 75) distribution.B++;
    else if (score >= 60) distribution.C++;
    else if (score >= 45) distribution.D++;
    else distribution.F++;
  });
  
  return distribution;
}

async function sendNotification(notification) {
  const io = getIO();
  if (!io) return;
  
  // Update notification as sent
  await updateRecord(`notifications/${notification.id}`, {
    sent_at: new Date().toISOString(),
  });
  
  // Determine target users
  let targetUserIds = notification.target_users;
  if (targetUserIds.length === 0 && notification.class_id) {
    // Send to all users in the class
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === notification.class_id);
    targetUserIds = enrollments.map(e => e.student_id);
  }
  
  // Emit to each target user
  targetUserIds.forEach(userId => {
    io.to(`user:${userId}`).emit('notification:new', notification);
  });
}


// ============================================================================
// PRODUCTIVITY SCORE - Calculate teacher productivity metrics
// ============================================================================

export const getProductivityScore = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;
  
  // Import the service
  const { calculateProductivityScore, getProductivityRecommendations } = await import('../services/productivityScoreService.js');
  
  const scoreResult = await calculateProductivityScore(teacherId);
  
  if (!scoreResult.success) {
    throw new ApiError(500, scoreResult.error);
  }
  
  const recommendationsResult = await getProductivityRecommendations(teacherId);
  
  res.json({
    success: true,
    score: scoreResult.score,
    level: scoreResult.level,
    breakdown: scoreResult.breakdown,
    metrics: scoreResult.metrics,
    recommendations: recommendationsResult.recommendations || [],
  });
});

// ============================================================================
// MESSAGE DELIVERY STATUS - Track read/delivered status
// ============================================================================

export const getMessageDeliveryStatus = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  
  const { getMessageDeliveryStatus: getStatus } = await import('../services/messageDeliveryService.js');
  
  const result = await getStatus(messageId);
  
  if (!result.success) {
    throw new ApiError(404, result.error);
  }
  
  res.json({ success: true, ...result });
});

// ============================================================================
// ADVANCED FILTERING - Get filter options
// ============================================================================

export const getAdvancedFilterOptions = asyncHandler(async (req, res) => {
  const { collection } = req.query;
  
  if (!collection) {
    throw new ApiError(400, 'collection parameter is required');
  }
  
  const { getFilterSuggestions } = await import('../services/advancedFilterService.js');
  
  const result = await getFilterSuggestions(collection);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

// ============================================================================
// ADVANCED SEARCH - Perform advanced search
// ============================================================================

export const performAdvancedSearch = asyncHandler(async (req, res) => {
  const { searchTerm, collections, filters } = req.body;
  
  if (!searchTerm) {
    throw new ApiError(400, 'searchTerm is required');
  }
  
  const { advancedSearch, filterStudents, filterSubmissions, filterAttendance } = await import('../services/advancedFilterService.js');
  
  // Perform search
  const searchResult = await advancedSearch(searchTerm, collections);
  
  if (!searchResult.success) {
    throw new ApiError(500, searchResult.error);
  }
  
  // Apply additional filters if provided
  let results = searchResult.results;
  
  if (filters?.students) {
    const studentFilter = await filterStudents(filters.students);
    if (studentFilter.success) {
      results.students = (results.students || []).filter(s => 
        studentFilter.students.some(fs => fs.user_id === s.user_id)
      );
    }
  }
  
  if (filters?.submissions) {
    const submissionFilter = await filterSubmissions(filters.submissions);
    if (submissionFilter.success) {
      results.submissions = (results.submissions || []).filter(s => 
        submissionFilter.submissions.some(fs => fs.id === s.id)
      );
    }
  }
  
  res.json({ success: true, ...searchResult, results });
});

// ============================================================================
// KEYBOARD SHORTCUTS - Get user's shortcuts
// ============================================================================

export const getKeyboardShortcuts = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const { getUserShortcuts } = await import('../services/keyboardShortcutService.js');
  
  const result = await getUserShortcuts(userId);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

// ============================================================================
// KEYBOARD SHORTCUTS - Update shortcut
// ============================================================================

export const updateKeyboardShortcut = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { action } = req.params;
  const { keys } = req.body;
  
  if (!keys) {
    throw new ApiError(400, 'keys are required');
  }
  
  const { updateUserShortcut, validateShortcutKeys } = await import('../services/keyboardShortcutService.js');
  
  // Validate keys
  const validation = validateShortcutKeys(keys);
  if (!validation.valid) {
    throw new ApiError(400, validation.error);
  }
  
  const result = await updateUserShortcut(userId, action, keys);
  
  if (!result.success) {
    throw new ApiError(400, result.error);
  }
  
  res.json({ success: true, shortcut: result.shortcut });
});

// ============================================================================
// KEYBOARD SHORTCUTS - Track shortcut usage
// ============================================================================

export const trackKeyboardShortcut = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { action } = req.params;
  
  const { trackShortcutUsage } = await import('../services/keyboardShortcutService.js');
  
  const result = await trackShortcutUsage(userId, action);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, message: 'Shortcut usage tracked' });
});

// ============================================================================
// KEYBOARD SHORTCUTS - Get shortcut statistics
// ============================================================================

export const getShortcutStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 7 } = req.query;
  
  const { getShortcutUsageStats, getShortcutRecommendations } = await import('../services/keyboardShortcutService.js');
  
  const statsResult = await getShortcutUsageStats(userId, parseInt(days));
  const recommendationsResult = await getShortcutRecommendations(userId);
  
  if (!statsResult.success) {
    throw new ApiError(500, statsResult.error);
  }
  
  res.json({
    success: true,
    stats: statsResult,
    recommendations: recommendationsResult.recommendations || [],
  });
});

// ============================================================================
// AI-POWERED FEATURES
// ============================================================================

export const analyzeAttendanceAI = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { classId } = req.query;
  
  if (!studentId || !classId) {
    throw new ApiError(400, 'studentId and classId are required');
  }
  
  const { analyzeAttendancePatterns } = await import('../services/aiService.js');
  
  const result = await analyzeAttendancePatterns(studentId, classId);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

export const identifyLearningGapsAI = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { classId } = req.query;
  
  if (!studentId) {
    throw new ApiError(400, 'studentId is required');
  }
  
  const { identifyLearningGaps } = await import('../services/aiService.js');
  
  const result = await identifyLearningGaps(studentId, classId);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

export const predictPerformanceAI = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const { classId } = req.query;
  
  if (!studentId) {
    throw new ApiError(400, 'studentId is required');
  }
  
  const { predictStudentPerformance } = await import('../services/aiService.js');
  
  const result = await predictStudentPerformance(studentId, classId);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

export const recommendAssignmentAI = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { subject } = req.query;
  
  if (!classId || !subject) {
    throw new ApiError(400, 'classId and subject are required');
  }
  
  const { recommendAssignmentDifficulty } = await import('../services/aiService.js');
  
  const result = await recommendAssignmentDifficulty(classId, subject);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

export const generateClassInsightsAI = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { term } = req.query;
  
  if (!classId) {
    throw new ApiError(400, 'classId is required');
  }
  
  const { generateAIInsights } = await import('../services/aiService.js');
  
  const result = await generateAIInsights(classId, term);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});

export const generateFeedbackAI = asyncHandler(async (req, res) => {
  const { submissionId, marks, maxMarks, rubric } = req.body;
  
  if (!submissionId || marks === undefined || !maxMarks) {
    throw new ApiError(400, 'submissionId, marks, and maxMarks are required');
  }
  
  const { generateGradeFeedback } = await import('../services/aiService.js');
  
  const result = await generateGradeFeedback(submissionId, marks, maxMarks, rubric);
  
  if (!result.success) {
    throw new ApiError(500, result.error);
  }
  
  res.json({ success: true, ...result });
});
