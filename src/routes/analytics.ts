import { Router } from 'express';

const router = Router();

// GET /api/analytics/admin
router.get('/admin', (req, res) => {
    res.json({ message: 'Get admin analytics endpoint not implemented yet' });
});

// GET /api/analytics/teacher
router.get('/teacher', (req, res) => {
    res.json({ message: 'Get teacher analytics endpoint not implemented yet' });
});

export default router;