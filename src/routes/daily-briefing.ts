import { Request, Response, Router } from 'express';
import { getData, listData } from '../firebase';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const router = Router();

// GET /api/daily-briefing
router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }

        const user = await getData(`users/${userId}`);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const today = new Date();
        const todayStart = startOfDay(today);
        const todayEnd = endOfDay(today);
        const dayOfWeek = today.getDay();

        // 1. Get Today's Timetable
        const timetables = await listData('timetables');
        const userTimetable = timetables.filter(t => t.classId === user.classId && t.dayOfWeek === dayOfWeek);

        // 2. Get Upcoming Assignments (due in the next 7 days)
        const assignments = await listData('assignments');
        const upcomingAssignments = assignments.filter(a => {
            const dueDate = parseISO(a.dueDate);
            return a.classId === user.classId && dueDate > today && dueDate < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        });

        // 3. Get Recent Notifications (last 24 hours)
        const notifications = await listData('notifications');
        const recentNotifications = notifications.filter(n => {
            const createdAt = parseISO(n.createdAt);
            return n.recipientIds.includes(userId) && createdAt >= todayStart && createdAt <= todayEnd;
        });

        // 4. Get Today's Attendance Status
        const attendanceRecords = await listData('attendanceRecords');
        const todayAttendance = attendanceRecords.find(a => a.studentId === userId && a.date === today.toISOString().split('T')[0]);

        // 5. Get Today's Uniform
        const uniformSchedules = await listData('uniformSchedules');
        const todayUniform = uniformSchedules.find(s => s.dayOfWeek === dayOfWeek && (!s.classId || s.classId === user.classId));

        res.json({
            success: true,
            briefing: {
                date: today.toISOString(),
                user: {
                    name: user.name,
                    role: user.role,
                    class: user.classId
                },
                schedule: userTimetable.sort((a, b) => a.startTime.localeCompare(b.startTime)),
                uniform: todayUniform ? `${todayUniform.uniformType} - ${todayUniform.description}` : 'Regular Uniform',
                attendance: todayAttendance ? `Your attendance is marked as: ${todayAttendance.status}` : 'Attendance not yet marked for today.',
                upcomingAssignments: upcomingAssignments.slice(0, 5),
                recentNotifications: recentNotifications.slice(0, 5)
            }
        });

    } catch (err) {
        console.error('[Briefing] Get daily briefing error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;