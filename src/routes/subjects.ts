import { Router } from 'express';
import { getData } from '../firebase';

const router = Router();

// GET /api/subjects
router.get('/', async (req, res) => {
  try {
    const subjects = await getData('subjects');
    res.json(subjects ? Object.values(subjects) : []);
  } catch (error) {
    console.error('[Subjects] Get all error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// GET /api/subjects/:id
router.get('/:id', async (req, res) => {
  try {
    const subject = await getData(`subjects/${req.params.id}`);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json(subject);
  } catch (error) {
    console.error(`[Subjects] Get ${req.params.id} error:`, error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

export default router;
