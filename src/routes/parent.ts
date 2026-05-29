import { Request, Response, Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// GET /api/parent/children - Get all children linked to parent
router.get('/children', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const parent = await getData(`users/${parentId}`);
    if (!parent || parent.role !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - Only parents can access this endpoint' });
    }

    const allStudents = await listData('users');
    const children = allStudents.filter(user => user.parentId === parentId).map(child => ({
      id: child.id,
      name: child.name,
      class: child.class,
      rollNumber: child.rollNumber,
      profileImage: child.profileImage,
      dateOfBirth: child.dateOfBirth
    }));

    res.json({
      success: true,
      children,
      count: children.length
    });
  } catch (err) {
    console.error('[Parent] Get children error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/attendance - Get child's attendance
router.get('/children/:childId/attendance', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    const allAttendance = await listData('attendanceRecords');
    const childAttendance = allAttendance.filter(a => a.studentId === childId);
    
    const present = childAttendance.filter(a => a.status === 'present').length;
    const absent = childAttendance.filter(a => a.status === 'absent').length;
    const late = childAttendance.filter(a => a.status === 'late').length;
    const total = childAttendance.length;
    const attendanceRate = total > 0 ? (present / total) * 100 : 0;

    res.json({
      success: true,
      child: { id: childId, name: child.name, class: child.class },
      attendanceRecords: childAttendance.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
      summary: { present, absent, late, total, attendanceRate: attendanceRate.toFixed(2) }
    });
  } catch (err) {
    console.error('[Parent] Get child attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/grades - Get child's grades
router.get('/children/:childId/grades', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    const allGrades = await listData('gradeRecords');
    const childGrades = allGrades.filter(g => g.studentId === childId);
    
    const recentGrades = childGrades.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
    const bySubject = recentGrades.reduce((acc, grade) => {
      if (!acc[grade.subjectId]) acc[grade.subjectId] = [];
      acc[grade.subjectId].push(grade);
      return acc;
    }, {});

    res.json({
      success: true,
      child: { id: childId, name: child.name, class: child.class },
      recentGrades,
      bySubject
    });
  } catch (err) {
    console.error('[Parent] Get child grades error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/fees - Get child's fees
router.get('/children/:childId/fees', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    const allFees = await listData('feeRecords');
    const childFees = allFees.filter(f => f.studentId === childId);
    
    const pending = childFees.filter(f => f.status === 'pending');
    const paid = childFees.filter(f => f.status === 'paid');
    const totalPending = pending.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = paid.reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      child: { id: childId, name: child.name, class: child.class },
      pendingFees: pending.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
      paidHistory: paid.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
      summary: { totalPending, totalPaid }
    });
  } catch (err) {
    console.error('[Parent] Get child fees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/timetable - Get child's timetable
router.get('/children/:childId/timetable', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    const allTimetable = await listData('timetable');
    const childTimetable = allTimetable.filter(t => t.class === child.class);
    
    // Organize by day for easier frontend rendering
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const organized = days.reduce((acc, day) => {
      acc[day] = childTimetable.filter(t => t.day === day).sort((a, b) => a.period - b.period);
      return acc;
    }, {});

    res.json({
      success: true,
      child: { id: childId, name: child.name, class: child.class },
      timetable: organized
    });
  } catch (err) {
    console.error('[Parent] Get child timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/bus - Get child's bus tracking
router.get('/children/:childId/bus', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    const allAssignments = await listData('busAssignments');
    const assignment = allAssignments.find(a => a.studentId === childId);
    if (!assignment) {
      return res.json({ success: true, assignment: null, message: 'No bus assignment found' });
    }

    const currentLocation = await getData(`busLocations/${assignment.routeId}`);
    res.json({
      success: true,
      assignment,
      currentLocation
    });
  } catch (err) {
    console.error('[Parent] Get child bus error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/assignments - Get child's assignments
router.get('/children/:childId/assignments', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    const allAssignments = await listData('assignments');
    const classAssignments = allAssignments.filter(a => a.class === child.class);
    const submissions = await listData('assignmentSubmissions');
    const childSubmissions = submissions.filter(s => s.studentId === childId);

    // Add submission status to each assignment
    const assignmentsWithStatus = classAssignments.map(assignment => {
      const submission = childSubmissions.find(s => s.assignmentId === assignment.id);
      return {
        ...assignment,
        submitted: !!submission,
        submission: submission || null,
        grade: submission?.grade || null
      };
    });

    res.json({
      success: true,
      child: { id: childId, name: child.name, class: child.class },
      assignments: assignmentsWithStatus.sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    });
  } catch (err) {
    console.error('[Parent] Get child assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/children/:childId/report - Get comprehensive child report
router.get('/children/:childId/report', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { childId } = req.params;
    const child = await getData(`users/${childId}`);
    if (!child || child.parentId !== parentId) {
      return res.status(403).json({ error: 'Forbidden - Can only view your own children\'s data' });
    }

    // Aggregate all data for a comprehensive report
    const allGrades = await listData('gradeRecords');
    const childGrades = allGrades.filter(g => g.studentId === childId);
    const allAttendance = await listData('attendanceRecords');
    const childAttendance = allAttendance.filter(a => a.studentId === childId);
    const allFees = await listData('feeRecords');
    const childFees = allFees.filter(f => f.studentId === childId);

    // Calculate summary metrics
    const attendanceRate = childAttendance.length > 0 
      ? (childAttendance.filter(a => a.status === 'present').length / childAttendance.length) * 100 
      : 0;
    const averageGrade = childGrades.length > 0
      ? childGrades.reduce((sum, g) => sum + (g.percentage || 0), 0) / childGrades.length
      : 0;
    const outstandingFees = childFees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);

    res.json({
      success: true,
      child: {
        id: childId,
        name: child.name,
        class: child.class,
        rollNumber: child.rollNumber,
        email: child.email,
        profileImage: child.profileImage
      },
      summary: {
        attendanceRate: attendanceRate.toFixed(2),
        averageGrade: averageGrade.toFixed(2),
        outstandingFees,
        totalGrades: childGrades.length,
        totalAttendanceDays: childAttendance.length
      },
      recentGrades: childGrades.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
      recentAttendance: childAttendance.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
    });
  } catch (err) {
    console.error('[Parent] Get child report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/parent/notifications - Get parent-specific notifications
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const parentId = req.headers['x-user-id'] as string;
    if (!parentId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const parent = await getData(`users/${parentId}`);
    if (!parent || parent.role !== 'parent') {
      return res.status(403).json({ error: 'Forbidden - Only parents can access this endpoint' });
    }

    // Get all children IDs
    const allStudents = await listData('users');
    const childIds = allStudents.filter(user => user.parentId === parentId).map(c => c.id);
    
    // Get notifications for all children + parent's own notifications
    const allNotifications = await listData('notifications');
    const parentNotifications = allNotifications.filter(n => 
      childIds.includes(n.recipientId) || n.recipientId === parentId
    );

    const unread = parentNotifications.filter(n => !n.read).length;
    res.json({
      success: true,
      notifications: parentNotifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      unreadCount: unread
    });
  } catch (err) {
    console.error('[Parent] Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;