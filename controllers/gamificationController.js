import { getRecord, queryRecords, updateRecord } from '../utils/firebaseDb.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

const XP_ACTIONS = {
  assignment_submit: 10,
  assignment_ontime: 5,
  grade_earned_A: 25,
  grade_earned_B: 15,
  grade_earned_C: 5,
  attendance: 3,
  streak_7: 20,
  streak_30: 100,
  challenge_complete: 50,
};

const LEVELS = [
  { level: 1, title: 'Beginner', minXP: 0 },
  { level: 2, title: 'Explorer', minXP: 100 },
  { level: 3, title: 'Scholar', minXP: 300 },
  { level: 4, title: 'Achiever', minXP: 600 },
  { level: 5, title: 'Expert', minXP: 1000 },
  { level: 6, title: 'Master', minXP: 1500 },
  { level: 7, title: 'Legend', minXP: 2500 },
];

const getLevelFromXP = (xp) => {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
  }
  const nextIdx = LEVELS.findIndex(l => l.level === current.level) + 1;
  const next = LEVELS[nextIdx] || null;
  return { ...current, nextLevel: next, xpToNext: next ? next.minXP - xp : 0 };
};

export const awardXP = asyncHandler(async (req, res) => {
  const { userId, action, amount } = req.body;
  if (!userId || !action) throw new ApiError(400, 'userId and action are required');

  const xpAmount = amount || XP_ACTIONS[action] || 0;
  if (xpAmount <= 0) throw new ApiError(400, 'Invalid XP action or amount');

  const profile = await getRecord(`student_profiles/${userId}`);
  if (!profile) throw new ApiError(404, 'Student profile not found');

  const newXP = (profile.xp || 0) + xpAmount;
  const oldLevel = getLevelFromXP(profile.xp || 0);
  const newLevel = getLevelFromXP(newXP);
  const levelUp = newLevel.level > oldLevel.level;

  // Check badge unlocks
  const badges = Array.isArray(profile.badges) ? [...profile.badges] : [];
  if (newXP >= 100 && !badges.includes('First Steps')) badges.push('First Steps');
  if (newXP >= 500 && !badges.includes('Rising Star')) badges.push('Rising Star');
  if (newXP >= 1000 && !badges.includes('Scholar')) badges.push('Scholar');
  if (newXP >= 2500 && !badges.includes('Legend')) badges.push('Legend');

  await updateRecord(`student_profiles/${userId}`, { xp: newXP, badges });

  res.json({ success: true, xpAwarded: xpAmount, newTotal: newXP, levelUp, newLevel, badges });
});

export const getStudentStats = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const profile = await getRecord(`student_profiles/${studentId}`);
  if (!profile) throw new ApiError(404, 'Student profile not found');

  // Get class rank
  const classmates = await queryRecords('student_profiles', (s) => 
    s.grade === profile.grade && s.section === profile.section
  );
  classmates.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const rank = classmates.findIndex(c => c.user_id === studentId) + 1;
  const classTotal = classmates.length;

  // Weekly challenge: submit 3 assignments this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const submissions = await queryRecords('submissions', (s) => 
    s.student_id === studentId && new Date(s.submitted_at) >= weekStart
  );

  const level = getLevelFromXP(profile.xp || 0);

  res.json({
    success: true,
    data: {
      xp: profile.xp || 0,
      level: level.level,
      levelTitle: level.title,
      xpToNext: level.xpToNext,
      nextLevelTitle: level.nextLevel?.title || null,
      badges: profile.badges || [],
      rank,
      classTotal,
      weeklyChallenge: {
        progress: Math.min(submissions.length, 3),
        target: 3,
        reward: 50,
        completed: submissions.length >= 3,
      },
      streak: profile.attendance_streak || 0,
      attendancePercent: profile.attendance_percent || 0,
    },
  });
});

export const getLeaderboard = asyncHandler(async (req, res) => {
  const { classId } = req.params;

  const classRoom = await getRecord(`class_rooms/${classId}`);
  if (!classRoom) throw new ApiError(404, 'Class not found');
  if (!classRoom.privacy_leaderboard_enabled && req.user.role === 'student') {
    throw new ApiError(403, 'Leaderboard is disabled for this class');
  }

  const enrollments = await queryRecords('classroom_students', (e) => e.classroom_id === classId);
  const studentIds = enrollments.map(e => e.student_id);

  if (!studentIds.length) return res.json({ success: true, leaderboard: [] });

  let profiles = await queryRecords('student_profiles', (p) => studentIds.includes(p.user_id));
  profiles.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  profiles = profiles.slice(0, 50);

  const leaderboard = await Promise.all(
    profiles.map(async (p, idx) => {
      const user = await getRecord(`users/${p.user_id}`);
      const level = getLevelFromXP(p.xp || 0);
      return {
        rank: idx + 1,
        userId: p.user_id,
        name: user?.name || 'Unknown',
        xp: p.xp || 0,
        level: level.level,
        levelTitle: level.title,
        badges: p.badges || [],
        attendancePercent: p.attendance_percent || 0,
      };
    })
  );

  res.json({ success: true, leaderboard });
});

export const getSubjectHealth = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  // Get marks grouped by subject
  const marks = await queryRecords('marks', (m) => m.student_id === studentId);

  // Get attendance
  const attendance = await queryRecords('attendance_records', (a) => a.student_id === studentId);

  const totalAttendance = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const overallAttendance = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 100;

  // Group marks by subject
  const subjectMap = {};
  for (const mark of marks) {
    if (!subjectMap[mark.subject]) subjectMap[mark.subject] = [];
    subjectMap[mark.subject].push(Number(mark.score));
  }

  const subjectHealth = Object.entries(subjectMap).map(([subject, scores]) => {
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    // Health = 60% grade + 40% attendance
    const health = Math.round(avgScore * 0.6 + overallAttendance * 0.4);
    const trend = scores.length >= 2
      ? scores[scores.length - 1] > scores[scores.length - 2] ? 'up' : 'down'
      : 'stable';

    return {
      subject,
      health,
      avgScore,
      attendance: overallAttendance,
      trend,
      status: health >= 75 ? 'good' : health >= 50 ? 'warning' : 'critical',
    };
  });

  res.json({ success: true, data: subjectHealth });
});
