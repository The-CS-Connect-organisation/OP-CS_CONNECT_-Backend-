/**
 * Student Controller
 * Dedicated student data endpoints - grades, attendance, profile, dashboard
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, updateRecord } from '../utils/firebaseDb.js';

// ============================================================================
// STUDENT PROFILE
// ============================================================================

export const getStudentProfile = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const profile = await getRecord(`student_profiles/${studentId}`);
  const user = await getRecord(`users/${studentId}`);

  if (!user) throw new ApiError(404, 'Student not found');

  res.json({
    success: true,
    profile: {
      id: studentId,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      avatar: user.avatar || '',
      grade: profile?.grade || '',
      section: profile?.section || '',
      rollNumber: profile?.roll_number || '',
      admissionNo: profile?.admission_no || '',
      parentName: profile?.parent_name || '',
      parentPhone: profile?.parent_phone || '',
      attendancePercent: profile?.attendance_percent || 100,
      xp: profile?.xp || 0,
      badges: profile?.badges || [],
      weakTopics: profile?.weak_topics || {},
      learningStyle: profile?.learning_style || 'mixed',
      joinedAt: user.joined_at || user.created_at || '',
    },
  });
});

export const updateStudentProfile = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { phone, parentName, parentPhone, learningStyle } = req.body;

  await updateRecord(`student_profiles/${studentId}`, {
    ...(phone !== undefined && { phone }),
    ...(parentName !== undefined && { parent_name: parentName }),
    ...(parentPhone !== undefined && { parent_phone: parentPhone }),
    ...(learningStyle !== undefined && { learning_style: learningStyle }),
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, message: 'Profile updated' });
});

// ============================================================================
// STUDENT DASHBOARD
// ============================================================================

export const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const [profile, user] = await Promise.all([
    getRecord(`student_profiles/${studentId}`),
    getRecord(`users/${studentId}`),
  ]);

  // Assignments
  const allAssignments = await getRecords('assignments');
  const classId = profile?.class_id || `${profile?.grade}_${profile?.section}`;
  const myAssignments = allAssignments.filter(a => a.class_id === classId || a.class === classId);

  // Submissions
  const mySubmissions = await queryRecords('submissions', s => s.student_id === studentId);
  const submittedIds = new Set(mySubmissions.map(s => s.assignment_id));
  const pendingAssignments = myAssignments.filter(a => !submittedIds.has(a.id));

  // Upcoming deadlines (next 7 days)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingDeadlines = pendingAssignments
    .filter(a => a.due_date && new Date(a.due_date) <= nextWeek && new Date(a.due_date) >= new Date())
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  // Recent grades
  const marks = await queryRecords('marks', m => m.student_id === studentId);
  marks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recentGrades = marks.slice(0, 5);

  // Attendance summary
  const attendanceRecords = await queryRecords('attendance_records', r => r.student_id === studentId);
  const presentCount = attendanceRecords.filter(r => ['present', 'late', 'excused'].includes(r.status)).length;
  const attendanceRate = attendanceRecords.length > 0
    ? Math.round((presentCount / attendanceRecords.length) * 100)
    : 100;

  // Notifications
  const notifications = await queryRecords('notifications', n =>
    n.target_users?.length === 0 || n.target_users?.includes(studentId)
  );
  const unreadCount = notifications.filter(n => !n.read_by?.includes(studentId)).length;

  // Leaderboard (class rank)
  const classRoomId = profile?.class_id || (profile?.grade ? `class-${profile.grade}-${(profile.section || 'A').toLowerCase()}` : null);
  let rank = null;
  let totalStudents = 0;
  if (classRoomId) {
    const enrollments = await queryRecords('classroom_students', e => e.classroom_id === classRoomId);
    totalStudents = enrollments.length;
    const profiles = await queryRecords('student_profiles', p => enrollments.some(e => e.student_id === p.user_id));
    profiles.sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const myRank = profiles.findIndex(p => p.user_id === studentId);
    if (myRank >= 0) rank = myRank + 1;
  }

  res.json({
    success: true,
    dashboard: {
      student: {
        name: user?.name || 'Student',
        grade: profile?.grade || '',
        section: profile?.section || '',
        attendancePercent: attendanceRate,
        xp: profile?.xp || 0,
        level: profile?.level || 1,
        badges: profile?.badges || [],
        rank,
        totalStudents,
      },
      stats: {
        totalAssignments: myAssignments.length,
        pendingAssignments: pendingAssignments.length,
        submittedAssignments: mySubmissions.length,
        attendanceRate,
        unreadNotifications: unreadCount,
      },
      upcomingDeadlines,
      recentGrades,
    },
  });
});

// ============================================================================
// GRADES
// ============================================================================

export const getStudentGrades = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { subject, term } = req.query;

  let marks = await queryRecords('marks', m => m.student_id === studentId);

  if (subject) marks = marks.filter(m => (m.subject || m.subject_name) === subject);
  if (term) marks = marks.filter(m => m.term === term);

  marks.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

  // Subject-wise summary
  const subjectSummary = {};
  marks.forEach(mark => {
    const subj = mark.subject || mark.subject_name || 'Unknown';
    if (!subjectSummary[subj]) {
      subjectSummary[subj] = { scores: [], total: 0, count: 0 };
    }
    subjectSummary[subj].scores.push(Number(mark.score || mark.obtained_marks || 0));
    subjectSummary[subj].total += Number(mark.score || mark.obtained_marks || 0);
    subjectSummary[subj].count += 1;
  });

  const summary = Object.entries(subjectSummary).map(([subj, data]) => ({
    subject: subj,
    average: (data.total / data.count).toFixed(1),
    highest: Math.max(...data.scores),
    lowest: Math.min(...data.scores),
    count: data.count,
  }));

  res.json({ success: true, marks, summary, items: marks });
});

// ============================================================================
// ATTENDANCE
// ============================================================================

export const getStudentAttendance = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { startDate, endDate, subject } = req.query;

  let records = await queryRecords('attendance_records', r => r.student_id === studentId);

  if (startDate) records = records.filter(r => r.date >= startDate);
  if (endDate) records = records.filter(r => r.date <= endDate);
  if (subject) records = records.filter(r => r.subject === subject);

  records.sort((a, b) => new Date(b.date) - new Date(a.date));

  const present = records.filter(r => ['present', 'late', 'excused'].includes(r.status)).length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 100;

  res.json({
    success: true,
    records,
    items: records,
    summary: {
      total: records.length,
      present,
      absent,
      late,
      rate,
    },
  });
});

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export const getStudentAssignments = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const { status } = req.query;

  const profile = await getRecord(`student_profiles/${studentId}`);
  const classId = profile?.class_id || `${profile?.grade}_${profile?.section}`;

  const allAssignments = await getRecords('assignments');
  const myAssignments = allAssignments.filter(a => a.class_id === classId || a.class === classId);

  const mySubmissions = await queryRecords('submissions', s => s.student_id === studentId);
  const submissionMap = {};
  mySubmissions.forEach(s => { submissionMap[s.assignment_id] = s; });

  const enriched = myAssignments.map(a => ({
    ...a,
    submission: submissionMap[a.id] || null,
    status: submissionMap[a.id]
      ? (submissionMap[a.id].marks !== undefined ? 'graded' : 'submitted')
      : (new Date(a.due_date) < new Date() ? 'overdue' : 'pending'),
  }));

  const filtered = status ? enriched.filter(a => a.status === status) : enriched;
  filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  res.json({ success: true, assignments: filtered, items: filtered });
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const getStudentNotifications = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  let notifications = await queryRecords('notifications', n =>
    n.target_users?.length === 0 || n.target_users?.includes(studentId)
  );

  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const unreadCount = notifications.filter(n => !n.read_by?.includes(studentId)).length;

  // Mark as read
  const unread = notifications.filter(n => !n.read_by?.includes(studentId));
  await Promise.all(unread.map(n =>
    updateRecord(`notifications/${n.id}`, {
      read_by: [...(n.read_by || []), studentId],
    })
  ));

  res.json({
    success: true,
    notifications: notifications.slice(0, 50),
    unreadCount,
  });
});

// ============================================================================
// TIMETABLE
// ============================================================================

export const getStudentTimetable = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const profile = await getRecord(`student_profiles/${studentId}`);
  const rawClassId = profile?.class_id || `${profile?.grade}_${profile?.section}`;
  const normalizeClassId = (id) => {
    if (!id) return id;
    const normalized = String(id).replace(/^(\d+)-([A-Z])$/i, 'class-$1-$2').toLowerCase();
    return normalized === String(id).toLowerCase() ? id : normalized;
  };

  const timetable = await getRecord(`timetables/${normalizeClassId(rawClassId)}`);

  res.json({ success: true, timetable: timetable || {}, entries: Object.values(timetable || {}) });
});

export default {
  getStudentProfile,
  updateStudentProfile,
  getStudentDashboard,
  getStudentGrades,
  getStudentAttendance,
  getStudentAssignments,
  getStudentNotifications,
  getStudentTimetable,
};
