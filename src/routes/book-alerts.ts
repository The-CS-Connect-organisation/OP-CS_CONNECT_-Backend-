import { Router } from 'express';

const router = Router();

// GET /api/book-alerts
router.get('/', (req, res) => {
    res.json({ message: 'Get book alerts endpoint not implemented yet' });
});

// POST /api/book-alerts
router.post('/', (req, res) => {
    res.json({ message: 'Create book alert endpoint not implemented yet' });
});

export default router;