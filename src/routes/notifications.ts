import { Router } from 'express';

const router = Router();

// GET /api/notifications/:userId
router.get('/:userId', (req, res) => {
    res.json({ message: `Get notifications for user ${req.params.userId} endpoint not implemented yet` });
});

// POST /api/notifications
router.post('/', (req, res) => {
    res.json({ message: 'Create notification endpoint not implemented yet' });
});

// PUT /api/notifications/:userId/:id/read
router.put('/:userId/:id/read', (req, res) => {
    res.json({ message: `Mark notification ${req.params.id} as read for user ${req.params.userId} endpoint not implemented yet` });
});

export default router;