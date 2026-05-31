import { Router } from 'express';
import { getData, listData } from '../firebase';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const users = await listData('users');
    const students = users.filter(u => u.role === 'student');
    res.json(students);
  } catch (error) {
    console.error('Error in /api/students:', error);
    res.status(500).json({ message: 'Error reading database' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getData(`users/${req.params.id}`);
    if (user && user.role === 'student') {
      res.json(user);
    } else {
      res.status(404).json({ message: 'Student not found' });
    }
  } catch (error) {
    console.error(`Error in /api/students/${req.params.id}:`, error);
    res.status(500).json({ message: 'Error reading database' });
  }
});

router.get('/:id/grades', (req, res) => {
    res.json({ message: `Get student grades for ${req.params.id} endpoint not implemented yet` });
});

router.get('/:id/attendance', (req, res) => {
    res.json({ message: `Get student attendance for ${req.params.id} endpoint not implemented yet` });
});

router.get('/:id/fees', (req, res) => {
    res.json({ message: `Get student fees for ${req.params.id} endpoint not implemented yet` });
});

router.get('/:id/goals', (req, res) => {
    res.json({ message: `Get student goals for ${req.params.id} endpoint not implemented yet` });
});

router.post('/:id/goals', (req, res) => {
    res.json({ message: `Create goal for student ${req.params.id} endpoint not implemented yet` });
});

router.put('/:id/goals/:goalId', (req, res) => {
    res.json({ message: `Update goal ${req.params.goalId} for student ${req.params.id} endpoint not implemented yet` });
});

export default router;
