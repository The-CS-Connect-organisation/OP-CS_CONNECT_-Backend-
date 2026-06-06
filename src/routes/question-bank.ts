import { Router } from 'express';
import { getData, setData } from '../firebase';

const router = Router();

// GET /api/question-bank
router.get('/', async (req, res) => {
  try {
    const questionsData = await getData('questionBank');
    const { subjectId, type, difficulty } = req.query;
    let questions = questionsData ? Object.values(questionsData) : [];
    if (subjectId) questions = questions.filter((q: any) => q.subjectId === subjectId);
    if (type) questions = questions.filter((q: any) => q.type === type);
    if (difficulty) questions = questions.filter((q: any) => q.difficulty === difficulty);
    res.json(questions);
  } catch (error) {
    console.error('[Question Bank] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /api/question-bank
router.post('/', async (req, res) => {
  try {
    const q = { id: `q${Date.now()}`, ...req.body };
    await setData(`questionBank/${q.id}`, q);
    res.status(201).json(q);
  } catch (error) {
    console.error('[Question Bank] Create error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

export default router;
