import { Router } from 'express';
import { getData, safeUser } from '../firebase';

const router = Router();

// GET /api/teachers
router.get('/', async (req, res) => {
  try {
    const usersData = await getData('users') as any;
    const teachers = usersData ? Object.values(usersData).filter((u: any) => u.role === 'teacher') : [];
    res.json(teachers.map(safeUser));
  } catch (error) {
    console.error('[Teachers] Get all error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// GET /api/teachers/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await getData(`users/${req.params.id}`);
    if (!user || user.role !== 'teacher') return res.status(404).json({ error: 'Teacher not found' });
    res.json(safeUser(user));
  } catch (error) {
    console.error(`[Teachers] Get ${req.params.id} error:`, error);
    res.status(500).json({ error: 'Failed to fetch teacher' });
  }
});

// GET /api/teachers/:id/classes
router.get('/:id/classes', async (req, res) => {
  try {
    const teacher = await getData(`users/${req.params.id}`);
    if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ error: 'Teacher not found' });
    const usersData = await getData('users') as any;
    const students = usersData ? Object.values(usersData).filter((u: any) => u.role === 'student' && teacher.classes?.includes(u.class)) : [];
    res.json({
      classes: teacher.classes || [],
      subjects: teacher.subjects || [],
      students: students.map(safeUser),
      studentCount: students.length
    });
  } catch (error) {
    console.error(`[Teachers] Get classes for ${req.params.id} error:`, error);
    res.status(500).json({ error: 'Failed to fetch teacher classes' });
  }
});

export default router;
