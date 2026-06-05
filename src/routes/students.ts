import { Router } from 'express';
import { getData, listData, setData, pushData } from '../firebase';

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

router.get('/:id/grades', async (req, res) => {
  try {
    const grades = await getData(`grades/${req.params.id}`);
    res.json(Array.isArray(grades) ? grades : (grades ? Object.values(grades) : []));
  } catch (error) {
    console.error(`Error in /api/students/${req.params.id}/grades:`, error);
    res.status(500).json({ message: 'Error reading grades' });
  }
});

router.get('/:id/attendance', async (req, res) => {
  try {
    const attendance = await getData(`attendance/${req.params.id}`);
    res.json(Array.isArray(attendance) ? attendance : (attendance ? Object.values(attendance) : []));
  } catch (error) {
    console.error(`Error in /api/students/${req.params.id}/attendance:`, error);
    res.status(500).json({ message: 'Error reading attendance' });
  }
});

router.get('/:id/fees', async (req, res) => {
  try {
    const fees = await getData(`fees/${req.params.id}`);
    res.json(Array.isArray(fees) ? fees : (fees ? Object.values(fees) : []));
  } catch (error) {
    console.error(`Error in /api/students/${req.params.id}/fees:`, error);
    res.status(500).json({ message: 'Error reading fees' });
  }
});

router.get('/:id/goals', async (req, res) => {
  try {
    const goals = await getData(`goals/${req.params.id}`);
    res.json(Array.isArray(goals) ? goals : (goals ? Object.values(goals) : []));
  } catch (error) {
    console.error(`Error in /api/students/${req.params.id}/goals:`, error);
    res.json([]);
  }
});

router.post('/:id/goals', async (req, res) => {
  try {
    const goal = { ...req.body, id: `goal_${Date.now()}`, createdAt: new Date().toISOString() };
    await pushData(`goals/${req.params.id}`, goal);
    res.json(goal);
  } catch (error) {
    console.error(`Error creating goal for ${req.params.id}:`, error);
    res.status(500).json({ message: 'Error creating goal' });
  }
});

router.put('/:id/goals/:goalId', async (req, res) => {
  try {
    await setData(`goals/${req.params.id}/${req.params.goalId}`, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error(`Error updating goal ${req.params.goalId}:`, error);
    res.status(500).json({ message: 'Error updating goal' });
  }
});

export default router;
