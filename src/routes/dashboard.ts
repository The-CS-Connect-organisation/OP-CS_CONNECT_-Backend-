import { Router } from 'express';
import { getData } from '../firebase';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const { role, userId } = req.query;
    const usersData = await getData('users') as any;
    const assignmentsData = await getData('assignments');
    const eventsData = await getData('events');

    const stats: any = {
      totalStudents: usersData ? Object.values(usersData).filter((u: any) => u.role === 'student').length : 0,
      totalTeachers: usersData ? Object.values(usersData).filter((u: any) => u.role === 'teacher').length : 0,
      totalAssignments: assignmentsData ? Object.values(assignmentsData).length : 0,
      upcomingEvents: eventsData ? Object.values(eventsData).filter((e: any) => new Date(e.date) >= new Date()).length : 0,
    };

    if (role === 'student' && userId) {
      const grades = await getData(`grades/${userId}`);
      const attendance = await getData(`attendance/${userId}`);
      const student = await getData(`users/${userId}`);
      stats.grades = grades || [];
      stats.attendance = attendance || [];
      stats.gpa = student?.gpa || 0;
      stats.studentClass = student?.class || '';
      const assignments = assignmentsData ? Object.values(assignmentsData).filter((a: any) => a.class === student?.class) : [];
      stats.pendingAssignments = assignments.filter((a: any) => !a.submissions?.some((s: any) => s.studentId === userId)).length;
    }

    res.json(stats);
  } catch (error) {
    console.error('[Dashboard] Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
