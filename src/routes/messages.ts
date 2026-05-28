import { Router } from 'express';

const router = Router();

// GET /api/messages/:userId
router.get('/:userId', (req, res) => {
    res.json({ message: `Get messages for user ${req.params.userId} endpoint not implemented yet` });
});

// POST /api/messages
router.post('/', (req, res) => {
    res.json({ message: 'Send message endpoint not implemented yet' });
});

export default router;