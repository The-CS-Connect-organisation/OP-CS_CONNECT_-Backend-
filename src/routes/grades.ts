import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, removeData } from '../firebase';

const router = Router();

// POST /api/grades/enter
router.post('/enter', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { studentId, subjectId, examType, marks, maxMarks, className } = req.body;
    if (!studentId || !subjectId || !examType || marks === undefined || maxMarks === undefined || !className) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const gradeId = id('grade');
    const percentage = ((marks / maxMarks) * 100).toFixed(2);
    const grade = {
      id: gradeId,
      studentId,
      studentName: student.name,
      subjectId,
      examType,
      marks,
      maxMarks,
      percentage: parseFloat(percentage),
      class: className,
      enteredBy: requesterId,
      enteredByName: requester.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setData(`grades/${gradeId}`, grade);
    
    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [studentId],
          title: 'New Grade Posted',
          message: `You received ${marks}/${maxMarks} in ${subjectId} (${examType})`,
          type: 'grade',
          link: `/grades/${gradeId}`
        })
      });
    } catch (notifyErr) {
      console.warn('[Grades] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, grade });
  } catch (err) {
    console.error('[Grades] Enter grades error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grades
router.get('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const user = await getData(`users/${requesterId}`);
    let grades = await listData('grades');
    
    if (user?.role === 'student') {
      grades = grades.filter(g => g.studentId === requesterId);
    } else if (user?.role === 'teacher') {
      grades = grades.filter(g => g.enteredBy === requesterId);
    }

    grades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, grades });
  } catch (err) {
    console.error('[Grades] Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grades/student/:studentId
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { studentId } = req.params;
    if (requesterId !== studentId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only view your own grades' });
      }
    }

    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const grades = await listData('grades');
    const studentGrades = grades.filter(g => g.studentId === studentId);
    studentGrades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    res.json({ success: true, student: { id: studentId, name: student.name, class: student.class }, grades: studentGrades });
  } catch (err) {
    console.error('[Grades] Get student grades error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grades/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const grade = await getData(`grades/${id}`);
    
    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    if (grade.studentId !== requesterId && grade.enteredBy !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Access denied' });
      }
    }

    res.json({ success: true, grade });
  } catch (err) {
    console.error('[Grades] Get single grade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/grades/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const existing = await getData(`grades/${id}`);
    
    if (!existing) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    if (existing.enteredBy !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only update grades you entered' });
      }
    }

    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    if (req.body.marks !== undefined && req.body.maxMarks !== undefined) {
      updated.percentage = parseFloat(((req.body.marks / req.body.maxMarks) * 100).toFixed(2));
    }
    await setData(`grades/${id}`, updated);
    res.json({ success: true, grade: updated });
  } catch (err) {
    console.error('[Grades] Update grade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/grades/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const existing = await getData(`grades/${id}`);
    
    if (!existing) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    if (existing.enteredBy !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only delete grades you entered' });
      }
    }

    await removeData(`grades/${id}`);
    res.json({ success: true, message: 'Grade deleted successfully' });
  } catch (err) {
    console.error('[Grades] Delete grade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grades/report/class/:className
router.get('/report/class/:className', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { className } = req.params;
    const grades = await listData('grades');
    const classGrades = grades.filter(g => g.class === className);
    
    const students = await listData('users');
    const classStudents = students.filter(u => u.role === 'student' && u.class === className);
    
    const subjectWise: { [key: string]: { total: number, average: number, students: number } } = {};
    classGrades.forEach(g => {
      if (!subjectWise[g.subjectId]) {
        subjectWise[g.subjectId] = { total: 0, average: 0, students: 0 };
      }
      subjectWise[g.subjectId].total += g.percentage;
      subjectWise[g.subjectId].students += 1;
    });
    
    Object.keys(subjectWise).forEach(key => {
      subjectWise[key].average = subjectWise[key].total / subjectWise[key].students;
    });

    res.json({
      success: true,
      class: className,
      totalStudents: classStudents.length,
      subjectWise,
      grades: classGrades.sort((a, b) => a.studentName.localeCompare(b.studentName))
    });
  } catch (err) {
    console.error('[Grades] Class report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;