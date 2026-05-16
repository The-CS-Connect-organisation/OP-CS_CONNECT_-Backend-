import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord, getStudentProfileByUserId } from '../utils/firebaseDb.js';

// ── Get Supply Analytics for Teacher ──
export const getSupplyAnalytics = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;

  // Get all assignments by this teacher that have supplies
  const assignments = await queryRecords('assignments', (a) => a.teacher_id === teacherId);
  const assignmentsWithSupplies = assignments.filter(a => (a.supplies_needed && a.supplies_needed.length > 0) || (a.supply_needed && a.supply_needed.length > 0));

  // Aggregate supply items
  const supplyCounts = {};
  let totalBudgetEstimate = 0;

  for (const assignment of assignmentsWithSupplies) {
    const supplies = assignment.supplies_needed || assignment.supply_needed || [];
    // Get student count in the class
    const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === assignment.class_id);
    const studentCount = enrollments.length || 1;

    for (const supply of supplies) {
      if (!supplyCounts[supply]) {
        supplyCounts[supply] = { count: 0, students: new Set(), assignments: [] };
      }
      supplyCounts[supply].count += studentCount;
      supplyCounts[supply].students.add(assignment.class_id);
      supplyCounts[supply].assignments.push({
        id: assignment.id,
        title: assignment.title,
        dueDate: assignment.due_date,
        classId: assignment.class_id,
        studentCount
      });
    }
  }

  // Estimate budget (assume average cost per item type)
  const avgCosts = {
    'notebook': 2.5, 'pen': 0.5, 'pencil': 0.3, 'eraser': 0.25,
    'ruler': 1.0, 'calculator': 15.0, 'textbook': 25.0,
    'folder': 3.0, 'highlighter': 1.5, 'markers': 4.0,
    'glue': 2.0, 'scissors': 3.5, 'paper': 1.0, 'binder': 5.0
  };

  const supplySummary = Object.entries(supplyCounts).map(([item, data]) => {
    const unitCost = avgCosts[item.toLowerCase()] || 2.0;
    const estimatedCost = data.count * unitCost;
    totalBudgetEstimate += estimatedCost;
    return {
      item,
      totalNeeded: data.count,
      classesAffected: data.students.size,
      assignments: data.assignments,
      estimatedCost
    };
  }).sort((a, b) => b.totalNeeded - a.totalNeeded);

  // Get upcoming supply alerts (next 7 days)
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = assignmentsWithSupplies.filter(a => {
    const due = new Date(a.due_date);
    return due >= now && due <= sevenDaysLater && a.notify_parents;
  });

  res.json({
    success: true,
    analytics: {
      totalAssignmentsWithSupplies: assignmentsWithSupplies.length,
      uniqueSupplyItems: supplySummary.length,
      totalBudgetEstimate: Math.round(totalBudgetEstimate * 100) / 100,
      supplySummary,
      upcomingAlerts: upcoming.map(a => ({
        id: a.id,
        title: a.title,
        dueDate: a.due_date,
        supplies: a.supplies_needed || a.supply_needed || [],
        classId: a.class_id
      })),
      costBreakdown: {
        low: supplySummary.filter(s => s.estimatedCost < 10).length,
        medium: supplySummary.filter(s => s.estimatedCost >= 10 && s.estimatedCost < 50).length,
        high: supplySummary.filter(s => s.estimatedCost >= 50).length
      }
    }
  });
});

// ── Get Student Supply Alerts (Student can see their own) ──
export const getStudentSupplyAlerts = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  // Get student profile to find their class
  const profile = await getStudentProfileByUserId(studentId);
  if (!profile) throw new ApiError(404, 'Student profile not found');

  const classId = profile.class_id || profile.class;
  if (!classId) throw new ApiError(400, 'No class assigned to student');

  // Find assignments with supplies for this class
  const assignments = await queryRecords('assignments', (a) =>
    a.class_id === classId && a.supplies_needed && a.supplies_needed.length > 0
  );

  // Also check legacy field
  const assignmentsLegacy = await queryRecords('assignments', (a) =>
    a.class_id === classId && a.supply_needed && a.supply_needed.length > 0
  );

  // Merge and deduplicate
  const allSupplyAssignments = [...assignments, ...assignmentsLegacy.filter(la => !assignments.some(a => a.id === la.id))];

  // Filter for upcoming (not past due)
  const now = new Date();
  const upcoming = allSupplyAssignments.filter(a => new Date(a.due_date) >= now)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Check submitted status
  const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);

  const alerts = upcoming.map(assignment => {
    const submitted = submissions.find(s => s.assignment_id === assignment.id);
    const isLate = new Date(assignment.due_date) < now && !submitted;
    return {
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      dueDate: assignment.due_date,
      suppliesNeeded: assignment.supplies_needed || assignment.supply_needed || [],
      notifyParents: assignment.notify_parents || false,
      isSubmitted: !!submitted,
      isLate,
      classId: assignment.class_id
    };
  });

  res.json({
    success: true,
    alerts,
    summary: {
      total: alerts.length,
      submitted: alerts.filter(a => a.isSubmitted).length,
      pending: alerts.filter(a => !a.isSubmitted && !a.isLate).length,
      overdue: alerts.filter(a => a.isLate).length
    }
  });
});

// ── Send Bulk Parent Notification (Teacher/Admin) ──
export const sendBulkParentNotification = asyncHandler(async (req, res) => {
  const { classId, subject, message, type } = req.body;

  if (!classId || !message) {
    throw new ApiError(400, 'classId and message are required');
  }

  // Get all students in the class
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
        if (parent && parent.user_id) {
          notifyUserIds.push(parent.user_id);
        }
      }
    }
  }

  const uniqueParentIds = [...new Set(notifyUserIds)];
  const io = req.io;

  for (const parentUserId of uniqueParentIds) {
    const notification = {
      id: `bulk-${Date.now()}-${parentUserId}`,
      user_id: parentUserId,
      message,
      type: type || 'info',
      meta: { classId, subject: subject || 'General', priority: 'normal' },
      read: false,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
    };

    await createRecord('notifications', notification);

    if (io) {
      io.to(`user:${parentUserId}`).emit('notification:new', notification);
    }
  }

  res.status(201).json({
    success: true,
    message: `Notifications sent to ${uniqueParentIds.length} parents`,
    notifiedCount: uniqueParentIds.length
  });
});

// ── Get Parent Dashboard Data ──
export const getParentDashboard = asyncHandler(async (req, res) => {
  const parentId = req.user.id;

  // Find parent profile
  const parentProfile = await getRecord(`parents/${parentId}`) ||
    (await queryRecords('parents', (p) => p.user_id === parentId))[0];

  if (!parentProfile) throw new ApiError(404, 'Parent profile not found');

  const studentId = parentProfile.student_id;
  if (!studentId) throw new ApiError(404, 'No student linked to this parent');

  // Get student profile and user
  const studentProfile = await getRecord(`student_profiles/${studentId}`) ||
    (await queryRecords('student_profiles', (s) => s.user_id === studentId))[0];
  const studentUser = await getRecord(`users/${studentId}`);

  const classId = studentProfile?.class_id || studentProfile?.class;

  // Get attendance summary
  const attendanceRecords = await queryRecords('attendance_records', (r) => r.student_id === studentId);
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const attendancePercent = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 100;

  // Get recent grades
  const marks = await queryRecords('marks', (m) => m.student_id === studentId);
  marks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recentGrades = marks.slice(0, 5);

  // Get upcoming assignments
  let upcomingAssignments = [];
  if (classId) {
    const allAssignments = await queryRecords('assignments', (a) => a.class_id === classId);
    const now = new Date().toISOString().split('T')[0];
    upcomingAssignments = allAssignments
      .filter(a => a.due_date >= now)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5);
  }

  // Get recent notifications
  const notifications = await queryRecords('notifications', (n) => n.user_id === parentId);
  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = notifications.filter(n => !n.read).length;

  // Get recent student submissions
  const submissions = await queryRecords('submissions', (s) => s.student_id === studentId);
  submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recentSubmissions = submissions.slice(0, 3);

  res.json({
    success: true,
    dashboard: {
      student: {
        id: studentId,
        name: studentUser?.name || studentProfile?.name || 'Unknown',
        grade: studentProfile?.grade || '',
        class: studentProfile?.class || '',
        section: studentProfile?.section || '',
        avatar: studentUser?.avatar || '',
        attendancePercent
      },
      recentGrades,
      upcomingAssignments,
      recentSubmissions: recentSubmissions.map(s => ({
        id: s.id,
        assignmentId: s.assignment_id,
        status: s.status,
        submittedAt: s.submitted_at,
        marks: s.marks || null,
        feedback: s.feedback || null
      })),
      notifications: {
        total: notifications.length,
        unread: unreadCount,
        recent: notifications.slice(0, 5).map(n => ({
          id: n.id,
          message: n.message,
          type: n.type,
          read: n.read,
          createdAt: n.created_at
        }))
      },
      attendance: {
        total: attendanceRecords.length,
        present: presentCount,
        absent: attendanceRecords.filter(r => r.status === 'absent').length,
        late: attendanceRecords.filter(r => r.status === 'late').length,
        percent: attendancePercent
      }
    }
  });
});

// ── Get Parent Book Heavy Alerts ──
export const getParentBookHeavyAlerts = asyncHandler(async (req, res) => {
  const parentId = req.user.id;

  // Find parent profile
  const parentProfile = await getRecord(`parents/${parentId}`) ||
    (await queryRecords('parents', (p) => p.user_id === parentId))[0];

  if (!parentProfile) throw new ApiError(404, 'Parent profile not found');

  const studentId = parentProfile.student_id;
  const studentProfile = await getRecord(`student_profiles/${studentId}`) ||
    (await queryRecords('student_profiles', (s) => s.user_id === studentId))[0];

  if (!studentProfile) throw new ApiError(404, 'Student profile not found');

  const classId = studentProfile.class_id || studentProfile.class;
  if (!classId) throw new ApiError(400, 'No class assigned');

  // Get timetable
  let timetable = await getRecord(`timetables/${classId}`);
  if (!timetable) {
    const normalized = `class-${classId.toLowerCase()}`;
    timetable = await getRecord(`timetables/${normalized}`);
  }

  if (!timetable) {
    return res.json({ success: true, alerts: [], timetable: null });
  }

  let entries = typeof timetable.entries === 'string'
    ? JSON.parse(timetable.entries) : timetable.entries;

  if (!Array.isArray(entries)) entries = [];

  const HEAVY_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Science'];
  const today = new Date().toISOString().split('T')[0];
  const targetDate = new Date(today + 'T00:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = dayNames[targetDate.getDay()];

  // Get this week and next week heavy days
  const alerts = [];
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const checkDate = new Date(targetDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const checkDay = dayNames[checkDate.getDay()];
    const dateStr = checkDate.toISOString().split('T')[0];

    const dayEntries = entries.filter(e => {
      const entryDay = e.day || '';
      return entryDay === checkDay || String(entryDay).toLowerCase() === checkDay.toLowerCase();
    });

    const subjects = dayEntries.map(e => e.subject || e.subject_name || '').filter(Boolean);
    const heavySubjects = subjects.filter(s => HEAVY_SUBJECTS.some(h => s.toLowerCase().includes(h.toLowerCase())));

    if (heavySubjects.length >= 4) {
      alerts.push({
        date: dateStr,
        day: checkDay,
        heavySubjects,
        totalSubjects: subjects.length,
        heavyCount: heavySubjects.length,
        status: dateStr === today ? 'today' : 'upcoming',
        suggestion: 'Consider sharing textbooks or leaving non-essential books at school.'
      });
    }
  }

  res.json({
    success: true,
    alerts,
    student: {
      name: studentProfile.name || studentUser?.name,
      grade: studentProfile.grade,
      class: studentProfile.class
    }
  });
});