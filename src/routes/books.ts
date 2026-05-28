import { Router } from 'express';

const router = Router();

// GET /api/books
router.get('/', (req, res) => {
    res.json({ message: 'Get books endpoint not implemented yet' });
});

// POST /api/books/issue
router.post('/issue', (req, res) => {
    res.json({ message: 'Issue book endpoint not implemented yet' });
});

// POST /api/books/return
router.post('/return', (req, res) => {
    res.json({ message: 'Return book endpoint not implemented yet' });
});

export default router;