import { Router } from 'express';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
    res.json({ message: 'Get dashboard stats endpoint not implemented yet' });
});

export default router;