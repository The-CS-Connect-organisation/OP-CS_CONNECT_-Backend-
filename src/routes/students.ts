import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

// Define interfaces for our data structure to satisfy the strict compiler
interface User {
  id: string;
  role: string;
  [key: string]: any; // Allow other properties
}

interface DB {
  users: User[];
  [key: string]: any; // Allow other top-level keys
}

const router = Router();
const dbPath = path.join(__dirname, '../data/db.json');

async function readDB(): Promise<DB> {
  const dbData = await fs.readFile(dbPath, 'utf-8');
  return JSON.parse(dbData) as DB;
}

// GET /api/students
router.get('/', async (req, res) => {
  try {
    const db = await readDB();
    const students = db.users.filter(user => user.role === 'student');
    res.json(students);
  } catch (error) {
    console.error('Error in /api/students:', error);
    res.status(500).json({ message: 'Error reading database' });
  }
});

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await readDB();
    const student = db.users.find(user => user.id === req.params.id && user.role === 'student');
    if (student) {
      res.json(student);
    } else {
      res.status(404).json({ message: 'Student not found' });
    }
  } catch (error) {
    console.error(`Error in /api/students/${req.params.id}:`, error);
    res.status(500).json({ message: 'Error reading database' });
  }
});

// GET /api/students/:id/grades
router.get('/:id/grades', (req, res) => {
    res.json({ message: `Get student grades for ${req.params.id} endpoint not implemented yet` });
});

// GET /api/students/:id/attendance
router.get('/:id/attendance', (req, res) => {
    res.json({ message: `Get student attendance for ${req.params.id} endpoint not implemented yet` });
});

// GET /api/students/:id/fees
router.get('/:id/fees', (req, res) => {
    res.json({ message: `Get student fees for ${req.params.id} endpoint not implemented yet` });
});

// GET /api/students/:id/goals
router.get('/:id/goals', (req, res) => {
    res.json({ message: `Get student goals for ${req.params.id} endpoint not implemented yet` });
});

// POST /api/students/:id/goals
router.post('/:id/goals', (req, res) => {
    res.json({ message: `Create goal for student ${req.params.id} endpoint not implemented yet` });
});

// PUT /api/students/:id/goals/:goalId
router.put('/:id/goals/:goalId', (req, res) => {
    res.json({ message: `Update goal ${req.params.goalId} for student ${req.params.id} endpoint not implemented yet` });
});

export default router;