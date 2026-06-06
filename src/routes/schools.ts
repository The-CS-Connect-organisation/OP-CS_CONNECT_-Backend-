import { Router } from 'express';
import { getData } from '../firebase';

const router = Router();

// GET /api/schools
router.get('/', async (req, res) => {
  try {
    const schools = await getData('schools');
    res.json(schools ? Object.values(schools) : []);
  } catch (error) {
    console.error('[Schools] Get all error:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

export default router;
