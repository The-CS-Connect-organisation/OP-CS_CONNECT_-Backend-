import { Router } from 'express';

const router = Router();

// GET /api/parent/children
router.get('/children', (req, res) => {
    res.json({ message: 'Get parent children endpoint not implemented yet' });
});

// GET /api/parent/children/:childId/report
router.get('/children/:childId/report', (req, res) => {
    res.json({ message: `Get child report for ${req.params.childId} endpoint not implemented yet` });
});

export default router;