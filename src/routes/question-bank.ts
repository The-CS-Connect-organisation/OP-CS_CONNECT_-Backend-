import { Router } from 'express';

const router = Router();

// GET /api/question-bank
router.get('/', (req, res) => {
    res.json({ message: 'Get question bank endpoint not implemented yet' });
});

// POST /api/question-bank
router.post('/', (req, res) => {
    res.json({ message: 'Create question endpoint not implemented yet' });
});

export default router;