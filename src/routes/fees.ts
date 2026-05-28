import { Router } from 'express';

const router = Router();

// GET /api/fees/student/:studentId
router.get('/student/:studentId', (req, res) => {
    res.json({ message: `Get fees for student ${req.params.studentId} endpoint not implemented yet` });
});

// POST /api/fees/pay
router.post('/pay', (req, res) => {
    res.json({ message: 'Pay fees endpoint not implemented yet' });
});

export default router;