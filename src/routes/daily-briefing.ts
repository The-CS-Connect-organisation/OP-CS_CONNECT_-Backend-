import { Router } from 'express';

const router = Router();

// GET /api/daily-briefing/:userId
router.get('/:userId', (req, res) => {
    res.json({ message: `Get daily briefing for user ${req.params.userId} endpoint not implemented yet` });
});

export default router;